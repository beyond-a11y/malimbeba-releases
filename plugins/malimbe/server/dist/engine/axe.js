import { offSiteHost, renderPageRaw } from "./render.js";
import { unauditableReason } from "./challenge.js";
import { GUIDANCE_INDEX } from "../rules/component-guidance.js";
import { createHash } from "node:crypto";
import { attributeOrigins, collectStackEvidence, detectStack } from "./stack.js";
/**
 * Tag set for full WCAG 2.2 conformance at Levels A and AA.
 * Includes every Level A and AA tag from 2.0, 2.1 and 2.2. "wcag22a" is
 * included for forward compatibility: WCAG 2.2 adds Level A criteria (3.2.6
 * Consistent Help, 3.3.7 Redundant Entry) that current axe builds do not yet
 * tag, because they are not reliably auto-testable.
 */
export const WCAG22_A_AA_TAGS = [
    "wcag2a", "wcag2aa",
    "wcag21a", "wcag21aa",
    "wcag22a", "wcag22aa",
];
/** @deprecated use WCAG22_A_AA_TAGS */
export const WCAG22AA_TAGS = WCAG22_A_AA_TAGS;
/**
 * Classify a target. Internal = loopback, RFC1918/CGNAT ranges, .local/.internal
 * style hosts, or an explicit non-public port-forwarded host. Everything else is
 * treated as public-facing.
 */
export function classifyTarget(url) {
    let h;
    try {
        h = new URL(url).hostname.toLowerCase();
    }
    catch {
        return "external";
    }
    if (h === "localhost" || h === "::1" || h.endsWith(".local") || h.endsWith(".internal") || h.endsWith(".test")) {
        return "internal";
    }
    const m = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
    if (m) {
        const a = Number(m[1]);
        const b = Number(m[2]);
        if (a === 127 || a === 10)
            return "internal";
        if (a === 192 && b === 168)
            return "internal";
        if (a === 172 && b >= 16 && b <= 31)
            return "internal";
        if (a === 100 && b >= 64 && b <= 127)
            return "internal";
        if (a === 169 && b === 254)
            return "internal";
    }
    // Single-label hosts (e.g. "intranet") are not publicly resolvable.
    if (!h.includes("."))
        return "internal";
    return "external";
}
/**
 * Heading/landmark structure rules worth surfacing even though axe-core tags
 * them "best-practice" rather than a specific WCAG success criterion —
 * heading hierarchy and landmark structure are foundational to WCAG 1.3.1
 * (Info and Relationships) and 2.4.1 (Bypass Blocks) even where axe itself
 * draws no direct SC line. Enabled explicitly via `rules[id].enabled`, which
 * axe-core's own rule-selection precedence honours over tag-based matching
 * (see `ruleShouldRun` in axe-core's source) — NOT by widening to the whole
 * "best-practice" tag, which also carries a lot of noisy, opinionated checks
 * with no bearing on document structure. Verified against the installed
 * axe-core's actual rule tags directly, not assumed:
 * `landmark-complementary-is-top-level` is excluded because axe-core itself
 * marks it deprecated.
 *
 * Split in two because "does this document have exactly one main landmark /
 * one h1 / all content inside a landmark" is a whole-PAGE question — asking
 * it of a11y_audit_demo's isolated component-in-a-wrapper-page would produce
 * false-positive noise having nothing to do with the component under test.
 * heading-order/empty-heading/landmark-unique stay meaningful at any scope
 * (a component embedding two identically-unlabeled <nav>s is a real bug
 * regardless of page context), so those run everywhere.
 */
export const STRUCTURE_RULE_IDS_ALWAYS = [
    "heading-order",
    "empty-heading",
    "landmark-unique",
];
/** Whole-document structure rules — see STRUCTURE_RULE_IDS_ALWAYS above. */
export const STRUCTURE_RULE_IDS_PAGE_ONLY = [
    "page-has-heading-one",
    "landmark-one-main",
    "landmark-no-duplicate-main",
    "landmark-no-duplicate-banner",
    "landmark-no-duplicate-contentinfo",
    "landmark-banner-is-top-level",
    "landmark-contentinfo-is-top-level",
    "landmark-main-is-top-level",
    "region",
];
/** Map axe tags to WCAG success-criterion numbers (tag form: wcag143 -> 1.4.3). */
export function criteriaFromTags(tags) {
    const out = [];
    for (const t of tags) {
        const m = t.match(/^wcag(\d)(\d)(\d+)$/);
        if (m)
            out.push(`${m[1]}.${m[2]}.${m[3]}`);
    }
    return [...new Set(out)];
}
/**
 * Source-pattern conformance: for internal targets we additionally check that
 * rendered widgets satisfy the ARIA contract of the pattern they claim to be.
 * axe checks WCAG; this checks "does this dialog actually behave like the
 * dialog pattern your design system says it is".
 *
 * Scope, deliberately. Most checks here run against the ONE element that
 * declares the pattern's role (the tablist, the dialog, the listbox...) and
 * only inspect that element's OWN attributes — that's `PATTERN_REQUIREMENTS`.
 * Two kinds of cross-element requirement are ALSO covered now, explicitly:
 *   - **Children**: tabs' aria-selected/aria-controls live on each
 *     descendant `role="tab"`, and each tab's linked panel (found by
 *     resolving its aria-controls) needs its own aria-labelledby. Only tabs
 *     has this today — listbox/grid/tree/treegrid's per-child requirements
 *     (aria-selected per option/row, aria-sort on sortable headers, etc.)
 *     are mostly CONDITIONAL (only when selection/sorting is supported), so
 *     asserting them unconditionally would manufacture false positives; not
 *     implemented.
 *   - **Trigger-side, via reverse lookup**: a menu button's
 *     aria-haspopup/aria-expanded belong to the trigger `<button>`, not the
 *     `role="menu"` popup — found by searching the SAME root (shadow-DOM
 *     safe: IDREFs don't cross shadow boundaries, so the search is scoped to
 *     `el.getRootNode()`) for an element whose aria-controls resolves to the
 *     menu's id. Tooltip works the same way via aria-describedby.
 * Still NOT covered:
 *   - accordion and date picker have no single self-declaring ARIA role to
 *     key detection off at all (see AUDIT-COVERAGE.md).
 *   - anything interaction-/state-dependent (aria-activedescendant only
 *     applies once an option is active, roving-tabindex correctness,
 *     keyboard operation, focus management) — that's what a11y_audit_demo's
 *     manual-gate disclosure and the accessible-component-authoring skill's
 *     interaction tests are for, not a static/rendered-markup check.
 * See AUDIT-COVERAGE.md for the full per-pattern matrix and which layer
 * legitimately owns each gap.
 */
const PATTERN_SCRIPT = `(() => {
  const CONTRACTS = __CONTRACTS__;
  const gaps = [];
  const all = [];
  (function walk(root){ root.querySelectorAll('*').forEach(e => { all.push(e); if (e.shadowRoot) walk(e.shadowRoot); }); })(document);
  const sel = (el) => {
    const t = el.tagName.toLowerCase();
    if (el.id) return t + '#' + el.id;
    const c = (el.getAttribute('class') || '').trim().split(/\\s+/)[0];
    if (c) return t + '.' + c;
    // No id or class to disambiguate siblings (e.g. two plain <button
    // role="tab"> elements) — fall back to a text snippet so a report
    // naming two different "tabs" gaps isn't identical, unreadable noise.
    const text = (el.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 30);
    return text ? t + ' "' + text + '"' : t;
  };
  // Find an element in the SAME root as target (shadow-safe) whose attr
  // (a space-separated IDREF list) includes target's id. Used for
  // trigger-side requirements that live on a different element than the
  // one that declares the pattern's role.
  const findReferrer = (target, attr) => {
    if (!target.id) return null;
    const root = target.getRootNode();
    for (const c of root.querySelectorAll('[' + attr + ']')) {
      const ids = (c.getAttribute(attr) || '').trim().split(/\\s+/);
      if (ids.includes(target.id)) return c;
    }
    return null;
  };
  for (const el of all) {
    const role = (el.getAttribute('role') || '').toLowerCase();
    const tag = el.tagName.toLowerCase();
    const key = role === 'dialog' || tag === 'dialog' ? 'dialog'
      : role === 'tablist' ? 'tabs'
      : role === 'menu' ? 'menu button'
      : role === 'combobox' ? 'combobox'
      : role === 'listbox' ? 'listbox'
      : role === 'grid' ? 'grid'
      : role === 'tree' ? 'tree view'
      : role === 'treegrid' ? 'tree grid'
      : role === 'tooltip' ? 'tooltip'
      : null;
    if (!key || !(key in CONTRACTS)) continue;
    // Native <dialog> supplies real modality itself; aria-modal is only
    // meaningful (and only required) when modal semantics are emulated via
    // role="dialog" on a non-native element — on native <dialog> it is
    // redundant, per the dialog contract's own caveat.
    const required = key === 'dialog' && tag !== 'dialog'
      ? CONTRACTS[key].concat(['aria-modal'])
      : CONTRACTS[key];
    const missing = [];
    for (const attr of required) {
      if (attr === 'accessible-name') {
        const named = (el.getAttribute('aria-label') || '').trim() ||
          (el.getAttribute('aria-labelledby') || '').split(/\\s+/).some(id => id && el.getRootNode().querySelector('[id="' + id + '"]'));
        if (!named) missing.push('accessible name (aria-label or a resolvable aria-labelledby)');
      } else if (attr === 'aria-modal') {
        if ((el.getAttribute('aria-modal') || '').toLowerCase() !== 'true') missing.push('aria-modal="true"');
      } else if (!el.hasAttribute(attr)) {
        missing.push(attr);
      }
    }
    // Tabs: each descendant role="tab" needs aria-selected and a resolvable
    // aria-controls; the panel it points at needs its own aria-labelledby.
    if (key === 'tabs') {
      const tabs = Array.from(el.querySelectorAll('[role="tab"]'));
      if (!tabs.length) missing.push('at least one descendant with role="tab"');
      for (const tab of tabs) {
        if (!tab.hasAttribute('aria-selected')) missing.push('aria-selected on tab ' + sel(tab));
        const controlsId = (tab.getAttribute('aria-controls') || '').trim().split(/\\s+/)[0];
        if (!controlsId) {
          missing.push('aria-controls on tab ' + sel(tab));
        } else {
          const panel = tab.getRootNode().querySelector('[id="' + controlsId + '"]');
          if (!panel) missing.push('aria-controls target #' + controlsId + ' for tab ' + sel(tab) + ' does not exist');
          else if (!panel.hasAttribute('aria-labelledby')) missing.push('aria-labelledby on the panel for tab ' + sel(tab) + ' (' + sel(panel) + ')');
        }
      }
    }
    // Menu button: aria-haspopup/aria-expanded belong to the trigger, found
    // by resolving which element's aria-controls points at this menu.
    if (key === 'menu button') {
      const trigger = findReferrer(el, 'aria-controls');
      if (!trigger) {
        missing.push('a trigger element referencing this menu via aria-controls (and this menu needs an id for that reference to resolve)');
      } else {
        if (!trigger.hasAttribute('aria-haspopup')) missing.push('aria-haspopup on the trigger (' + sel(trigger) + ')');
        if (!trigger.hasAttribute('aria-expanded')) missing.push('aria-expanded on the trigger (' + sel(trigger) + ')');
      }
    }
    // Tooltip: its only contract requirement is aria-describedby on ITS
    // trigger, found the same way.
    if (key === 'tooltip') {
      const trigger = findReferrer(el, 'aria-describedby');
      if (!trigger) missing.push('a trigger element referencing this tooltip via aria-describedby (and this tooltip needs an id for that reference to resolve)');
    }
    if (missing.length) gaps.push({ component: key, selector: sel(el), missing });
  }
  return gaps;
})()`;
/**
 * Attributes each pattern must expose on the element that declares its role,
 * per the APG contracts in component-guidance.ts. Keys must match GUIDANCE's
 * component names exactly (test/parity.test.js checks the ones it can).
 * An empty array means the pattern's ENTIRE requirement is handled by the
 * child- or trigger-side logic in PATTERN_SCRIPT, not a root attribute.
 */
const PATTERN_REQUIREMENTS = {
    dialog: ["accessible-name", "aria-describedby"],
    tabs: ["accessible-name"],
    "menu button": ["accessible-name"],
    combobox: ["aria-expanded", "aria-controls", "aria-autocomplete"],
    listbox: ["accessible-name"],
    grid: ["accessible-name"],
    "tree view": ["accessible-name"],
    "tree grid": ["accessible-name"],
    tooltip: [],
};
/**
 * Run an axe-core WCAG 2.2 AA scan against a URL in a real browser.
 * Internal targets additionally get source-pattern conformance analysis.
 *
 * @param opts.pageContext Defaults to `false` for component-safe behavior.
 *   Whole-document structure rules (page-has-heading-one,
 *   landmark-one-main, region, etc.) are only included for real pages that
 *   are meant to have page chrome. This avoids the false-positive findings
 *   that used to appear when the engine was called directly against an
 *   isolated component wrapper. Pass `pageContext: true` for a real page,
 *   including full-document structure audits (`a11y_audit_axe` does this
 *   by default). See `STRUCTURE_RULE_IDS_ALWAYS`/`STRUCTURE_RULE_IDS_PAGE_ONLY`
 *   above.
 */
export async function runAxeAudit(url, opts = {}) {
    const scope = opts.scope ?? classifyTarget(url);
    const base = {
        url,
        scope,
        engine: "axe-core",
        standard: "WCAG 2.2 Level A and AA",
        violations: [],
        passCount: 0,
        incompleteCount: 0,
        patternGaps: [],
    };
    const page = await renderPageRaw(url);
    if (!page.ok || !page.page) {
        return { ...base, error: page.error ?? "Could not open a browser page. Playwright/Chromium is required for axe audits." };
    }
    let docHtml = "";
    try {
        docHtml = await page.page.content();
    }
    catch {
        docHtml = "";
    }
    const blocked = unauditableReason(page.status, docHtml);
    if (blocked) {
        await page.close();
        return { ...base, error: blocked };
    }
    const landed = page.finalUrl && page.finalUrl !== url ? { finalUrl: page.finalUrl } : {};
    const away = offSiteHost(url, page.finalUrl);
    if (away)
        Object.assign(base, landed, { offSite: away });
    else
        Object.assign(base, landed);
    try {
        // axe-core exposes its injectable bundle on the DEFAULT export under ESM.
        // Never resolve it from process.cwd(): when launched by an editor or agent
        // the working directory is the user's workspace, not this package.
        const axeMod = (await import("axe-core"));
        const src = axeMod.default?.source ?? axeMod.source;
        if (!src) {
            return { ...base, error: "axe-core source unavailable — reinstall the axe-core dependency." };
        }
        // Stack evidence before axe is injected, from the same navigation.
        let stack;
        try {
            stack = detectStack(await collectStackEvidence(page.page, url, page.responseHeaders ?? null));
        }
        catch {
            stack = undefined;
        }
        await page.page.addScriptTag({ content: src });
        const renderedDomDigest = createHash("sha256").update(await page.page.content()).digest("hex");
        const browserVersion = page.page.context().browser()?.version?.();
        const structureRuleIds = opts.pageContext === true
            ? [...STRUCTURE_RULE_IDS_ALWAYS, ...STRUCTURE_RULE_IDS_PAGE_ONLY]
            : STRUCTURE_RULE_IDS_ALWAYS;
        const structureRules = Object.fromEntries(structureRuleIds.map((id) => [id, { enabled: true }]));
        const results = (await page.page.evaluate(`axe.run(document, { runOnly: { type: 'tag', values: ${JSON.stringify(WCAG22_A_AA_TAGS)} }, rules: ${JSON.stringify(structureRules)}, resultTypes: ['violations'] })`));
        const violations = (results.violations ?? []).map((v) => ({
            id: v.id,
            impact: (v.impact ?? "moderate"),
            help: v.help,
            helpUrl: v.helpUrl,
            criteria: criteriaFromTags(v.tags ?? []),
            tags: v.tags ?? [],
            nodes: (v.nodes ?? []).map((n) => ({
                target: Array.isArray(n.target) ? n.target.join(" ") : String(n.target),
                html: String(n.html ?? "").slice(0, 200),
                failureSummary: String(n.failureSummary ?? "").slice(0, 300),
            })),
        }));
        if (stack) {
            const flat = violations.flatMap((v) => v.nodes);
            const origins = await attributeOrigins(page.page, flat.map((n) => n.target), stack);
            flat.forEach((n, i) => {
                const o = origins[i];
                if (o)
                    n.origin = o;
            });
        }
        let patternGaps = [];
        if (scope === "internal") {
            const script = PATTERN_SCRIPT.replace("__CONTRACTS__", JSON.stringify(PATTERN_REQUIREMENTS));
            const raw = (await page.page.evaluate(script));
            patternGaps = raw.map((g) => ({
                ...g,
                source: opts.sourcePattern ?? null,
            }));
        }
        return {
            ...base,
            violations,
            passCount: (results.passes ?? []).length,
            incompleteCount: (results.incomplete ?? []).length,
            patternGaps,
            axeVersion: axeMod.default?.version,
            browserVersion,
            renderedDomDigest,
            ...(stack ? { stack } : {}),
        };
    }
    catch (e) {
        return { ...base, error: `axe run failed: ${e?.message ?? "unknown error"}` };
    }
    finally {
        try {
            await page.close();
        }
        catch {
            /* ignore */
        }
    }
}
/** Pattern contract text for a component, used when reporting gaps. */
export function contractSummary(component) {
    const g = GUIDANCE_INDEX.get(component);
    if (!g)
        return null;
    return `${g.roles.join(", ")} | ARIA: ${g.aria.join("; ")}`;
}
