import { renderPageRaw, withTimeout } from "./render.js";
import { findOrderMismatches } from "./visualOrder.js";
import { FOCUSABLE_SELECTOR } from "./dom.js";
/**
 * The gap this closes: every existing audit tool inspects a single static
 * snapshot of the page (see axe.ts, render.ts's EXTRACT script). None of
 * them can answer "can a keyboard-only user actually reach every control,
 * in a sane order, without getting stuck?" -- that requires DRIVING the
 * page (real Tab/Shift+Tab key presses) and watching what happens, not
 * reading markup. Until now this was explicitly a manual gate (see
 * policy.ts's "keyboard-interaction" checklist item and
 * skills/accessibility-auditing/SKILL.md's "What automated checks cannot
 * do" -- "Keyboard interaction flows, focus order sensibility, and focus
 * trapping require manual operation").
 *
 * This does NOT verify a component's full keyboard CONTRACT (arrow keys
 * inside a tablist, Escape closing a dialog, etc. -- that's pattern-specific
 * and still belongs to a11y_audit_demo's manual-gate disclosure and
 * hand-written interaction tests). It verifies the three things that are
 * pattern-agnostic and apply to every interactive page: every visible,
 * enabled candidate is reachable by Tab; Tab (and Shift+Tab) never gets
 * stuck; and focus order roughly tracks visual (top-to-bottom) layout.
 */
/** Marks each focusable candidate with a stable id before walking, so a
 *  revisit is detected by identity, not by a selector guess that two
 *  similar-looking elements could collide on. */
const MARK_CANDIDATES_SCRIPT = `(() => {
  const SEL = ${JSON.stringify(FOCUSABLE_SELECTOR)};
  const isVisible = (el) => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.visibility === 'collapse') return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const all = [];
  (function walk(root) { root.querySelectorAll('*').forEach(e => { all.push(e); if (e.shadowRoot) walk(e.shadowRoot); }); })(document);
  const desc = (el) => {
    const t = el.tagName.toLowerCase();
    const id = el.id ? '#' + el.id : '';
    const cls = !id ? (el.getAttribute('class') || '').trim().split(/\s+/)[0] : '';
    const text = (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40);
    return t + id + (cls ? '.' + cls : '') + (text ? ' "' + text + '"' : '');
  };
  const candidates = all.filter((el) => {
    if (!el.matches || !el.matches(SEL)) return false;
    if (el.hasAttribute('disabled')) return false;
    if (el.closest && el.closest('[aria-hidden="true"]')) return false;
    if (el.closest && el.closest('[inert]')) return false;
    const t = el.getAttribute('tabindex');
    if (t !== null && parseInt(t, 10) < 0) return false;
    return isVisible(el);
  });
  candidates.forEach((el, i) => el.setAttribute('data-a11y-walk-id', String(i)));
  return candidates.map((el, i) => {
    const r = el.getBoundingClientRect();
    return {
      id: i,
      selector: desc(el),
      snippet: '<' + el.tagName.toLowerCase() + (el.id ? ' id="' + el.id + '"' : '') + '>',
      x: Math.round(r.left),
      y: Math.round(r.top),
    };
  });
})()`;
/** Reads the currently-focused element's walk id (if it's a marked
 *  candidate) plus its visual position, after one Tab/Shift+Tab press. */
const READ_ACTIVE_SCRIPT = `(() => {
  const el = document.activeElement;
  if (!el || el === document.body || el === document.documentElement) return null;
  const r = el.getBoundingClientRect();
  const idAttr = el.getAttribute && el.getAttribute('data-a11y-walk-id');
  return {
    id: idAttr !== null && idAttr !== undefined ? Number(idAttr) : null,
    x: Math.round(r.left),
    y: Math.round(r.top),
  };
})()`;
const OP_TIMEOUT_MS = 15_000;
function emptyResult(url, error) {
    return {
        url,
        expectedCount: 0,
        reachedCount: 0,
        unreachable: [],
        trapped: false,
        steps: 0,
        incomplete: false,
        orderMismatches: [],
        findings: [],
        error,
    };
}
/**
 * Drive real Tab/Shift+Tab key presses through a rendered page and report
 * what a keyboard-only user would actually experience: elements that are
 * visible and enabled but never reached, a Tab sequence that loops without
 * making progress (a trap), and focus order that jumps backward against
 * the visual layout (WCAG 2.4.3-adjacent heuristic -- flagged for review,
 * not asserted as a hard failure, since some backward jumps are
 * intentional, e.g. a "skip to content" link).
 */
export async function runKeyboardWalkthrough(url, opts = {}) {
    const maxSteps = opts.maxSteps ?? 150;
    const page = await renderPageRaw(url);
    if (!page.ok || !page.page) {
        return emptyResult(url, page.error ?? "Could not open a browser page. Playwright/Chromium is required for a keyboard walkthrough.");
    }
    try {
        const candidates = (await withTimeout(page.page.evaluate(MARK_CANDIDATES_SCRIPT), OP_TIMEOUT_MS, "mark candidates"));
        const byId = new Map(candidates.map((c) => [c.id, c]));
        await page.page.evaluate(() => {
            document.activeElement?.blur?.();
        });
        const order = [];
        const seen = new Set();
        let trapped = false;
        let trapAt;
        let stagnant = 0;
        let steps = 0;
        let consecutiveNull = 0;
        let firstId;
        for (; steps < maxSteps; steps++) {
            await page.page.keyboard.press("Tab");
            const cur = (await withTimeout(page.page.evaluate(READ_ACTIVE_SCRIPT), OP_TIMEOUT_MS, "read active element"));
            if (!cur) {
                consecutiveNull++;
                // Two Tabs in a row that leave the document is the natural end of
                // the page (focus wrapped past the last control) -- not a trap.
                if (consecutiveNull >= 2) {
                    steps++;
                    break;
                }
                continue;
            }
            consecutiveNull = 0;
            order.push(cur);
            if (cur.id === null)
                continue; // reached something outside the marked candidate set -- record position, can't dedupe by identity
            if (firstId === undefined) {
                firstId = cur.id;
                seen.add(cur.id);
                continue;
            }
            if (cur.id === firstId && seen.size >= candidates.length) {
                // Genuine full-lap wraparound: every expected candidate has been
                // reached at least once, and Tab has now cycled back to the first
                // one. Headless Chromium loops Tab within the page rather than
                // ever leaving the document, so without this check a perfectly
                // normal page would keep re-visiting already-seen elements forever
                // and eventually trip the stagnant-trap threshold below -- a false
                // positive, confirmed live (a plain 3-button fixture was
                // misreported as trapped before this check existed). This is the
                // clean, expected end of a walkthrough, not a trap.
                steps++;
                break;
            }
            if (seen.has(cur.id)) {
                stagnant++;
                if (stagnant >= 4) {
                    trapped = true;
                    trapAt = byId.get(cur.id)?.selector ?? `element ${cur.id}`;
                    steps++;
                    break;
                }
            }
            else {
                stagnant = 0;
                seen.add(cur.id);
            }
        }
        const reachedIds = new Set([...seen]);
        const unreachable = candidates.filter((c) => !reachedIds.has(c.id)).map((c) => ({ selector: c.selector, snippet: c.snippet }));
        const orderMismatches = findOrderMismatches(order, (item) => (item.id !== null ? byId.get(item.id)?.selector ?? `element ${item.id}` : `position (${item.x}, ${item.y})`), "Focus");
        const findings = [];
        for (const u of unreachable) {
            findings.push({
                ruleId: "keyboard-unreachable",
                title: "Interactive element is not reachable by keyboard",
                wcag: ["2.1.1"],
                level: "A",
                impact: "critical",
                selector: u.selector,
                snippet: u.snippet,
                detail: `${u.selector} is visible and enabled but the Tab walk never focused it.`,
                fix: "Confirm it is a natively focusable element, or has tabindex=\"0\" and is not aria-hidden, inert, or removed from the tab sequence by a script.",
            });
        }
        if (trapped) {
            findings.push({
                ruleId: "keyboard-trap",
                title: "Keyboard focus is trapped",
                wcag: ["2.1.2"],
                level: "A",
                impact: "critical",
                selector: trapAt ?? "unknown",
                snippet: "",
                detail: `Tab repeatedly returned to ${trapAt} without reaching a new control (checked ${stagnant} repeats before stopping).`,
                fix: "Ensure Tab/Shift+Tab can always move on. A deliberate trap (an open modal) must have an explicit, working escape route (Escape key, close button) back out.",
            });
        }
        for (const m of orderMismatches) {
            findings.push({
                ruleId: "focus-order-mismatch",
                title: "Focus order does not follow the visual layout",
                wcag: ["2.4.3"],
                level: "A",
                impact: "moderate",
                selector: m.to,
                snippet: "",
                detail: `${m.detail} (from ${m.from} to ${m.to}). Some jumps are intentional (e.g. a skip link) -- confirm this one reads sensibly to a keyboard user.`,
                fix: "Match DOM order to reading order, or use CSS that does not visually reorder focusable content away from its DOM position.",
            });
        }
        return {
            url,
            expectedCount: candidates.length,
            reachedCount: reachedIds.size,
            unreachable,
            trapped,
            trapAt,
            steps,
            incomplete: !trapped && steps >= maxSteps,
            orderMismatches,
            findings,
        };
    }
    catch (e) {
        return emptyResult(url, `Keyboard walkthrough failed: ${e?.message ?? "unknown error"}`);
    }
    finally {
        await page.close();
    }
}
