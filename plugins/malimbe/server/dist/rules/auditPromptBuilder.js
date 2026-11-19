// Single source of truth for "audit/test this for accessibility" prompts —
// the audit-side counterpart to promptBuilder.ts's buildPrompt(). Closes the
// second half of Finding 2: until now, audit-prompt assembly was two
// independent, hand-rolled implementations (ui/index.html's buildAudit(),
// ui/guided.html's checkPrompt()) with no shared source, the same shape of
// problem Finding 2 already found and fixed on the generate side.
//
// Consumed directly by the a11y_build_audit_prompt MCP tool, and — via the
// compiled JS, copied verbatim into ui/generated/ by
// scripts/build-ui-data.mjs — by both UI audit-prompt builders. No Node-only
// APIs: this runs unmodified in a browser, same constraint as
// promptBuilder.ts.
import { referencesFor } from "./sources.js";
import { mcpSetupBlock } from "./promptBuilder.js";
/**
 * Classify an audit target the same way for both UIs: a filesystem-looking
 * path or bare `owner/repo` slug is "repo"; a loopback/RFC1918/.local/.test/
 * single-label host is "internal"; anything else is "external". Mirrors
 * (and is authoritative over) engine/axe.ts's classifyTarget, which only
 * distinguishes internal/external — this adds the "repo" case the UI needs
 * for its own STEPS branching, before there's even a URL to classify.
 */
export function classifyAuditTarget(target) {
    const t = (target || "").trim().toLowerCase();
    if (!t)
        return null;
    if (/^\.{0,2}\//.test(t))
        return "repo";
    if (/^[a-z0-9_-]+\/[a-z0-9_.-]+$/.test(t) && !t.includes("."))
        return "repo";
    const host = t.replace(/^https?:\/\//, "").split("/")[0];
    if (!host)
        return null;
    if (/^localhost|^127\.|^10\.|^192\.168\.|^172\.(1[6-9]|2\d|3[01])\.|\.local$|\.internal$|\.test$/.test(host)) {
        return "internal";
    }
    if (!host.includes("."))
        return "internal";
    return "external";
}
const PLATFORM_NAMES = {
    web: "Web (all platforms)",
    ios: "iOS",
    android: "Android",
    windows: "Windows",
    macos: "macOS",
};
const PLATFORM_NOTES = {
    web: ["Support 400% zoom and reflow to a 320px-wide viewport with no loss of content.", "Honor prefers-reduced-motion and forced-colors.", "Verify against desktop screen-reader stacks."],
    ios: ["Minimum 44x44pt touch targets.", "Verify with VoiceOver; support Dynamic Type scaling.", "Respect Reduce Motion and Increase Contrast settings."],
    android: ["Minimum 48x48dp touch targets.", "Verify with TalkBack; support font-scale up to 200%.", "Respect the system reduced-motion setting."],
    windows: ["Verify keyboard operation and a screen-reader stack (Narrator/NVDA/JAWS).", "Support Windows High Contrast / forced-colors mode with visible borders and focus.", "Support OS text scaling to 200%."],
    macos: ["Verify with VoiceOver and full keyboard access.", "Respect Reduce Motion and Increase Contrast.", "Support display zoom without clipping."],
};
function sourcePatternArg(sourcePattern) {
    return sourcePattern ? ` and source_pattern="${sourcePattern}"` : "";
}
/** The numbered STEPS unique to each kind/crawl combination — everything after is shared. */
function leadingSteps(input, kind, crawl, maxPages) {
    const target = input.target || "<paste the URL or repo path to audit>";
    const spArg = sourcePatternArg(input.sourcePattern);
    if (kind === "repo") {
        return [
            "Build or start the component preview (Storybook, dev server, or this repo's test harness).",
            `Run a11y_audit_axe against that local URL with scope="internal"${spArg}. Internal scope also checks each component against the pattern it claims to implement.`,
            "For any component you cannot render, audit its rendered markup with a11y_audit_html.",
        ];
    }
    if (crawl) {
        return [
            `Run a11y_crawl_audit with url="${target}" and max_pages=${maxPages} to crawl same-origin pages and audit each.`,
            "Review the aggregated report: per-page issue counts, pages with critical defects, and the most common rules.",
        ];
    }
    // Single-page internal/external: a11y_audit_axe is the audit of record
    // (real axe-core in a browser, plus source-pattern conformance for
    // internal targets) — the default here, not a11y_audit_url's static
    // delivered-HTML fetch, which is weaker and belongs as the explicit
    // fallback when a browser genuinely isn't available.
    return [
        `Run a11y_audit_axe with url="${target}" and scope="${kind}"${kind === "internal" ? spArg : ""}.`,
        "If it cannot launch a browser, run: npx playwright install chromium — then try again, or fall back to a11y_audit_url (weaker: reads delivered HTML only, no source-pattern conformance).",
    ];
}
function toolsFor(kind, crawl) {
    if (kind === "repo")
        return ["a11y_audit_axe", "a11y_audit_html", "a11y_release_gate", "a11y_checklist"];
    if (crawl)
        return ["a11y_crawl_audit", "a11y_release_gate", "a11y_checklist"];
    return ["a11y_audit_axe", "a11y_audit_url", "a11y_release_gate", "a11y_checklist"];
}
export function buildAuditPrompt(input) {
    const target = input.target || "<paste the URL or repo path to audit>";
    const wcagLevel = input.wcagLevel ?? "A and AA";
    const platform = input.platform ?? "web";
    const agent = input.agent ?? "generic";
    const includeMcpSetup = input.includeMcpSetup ?? true;
    const kind = input.kind ?? classifyAuditTarget(input.target) ?? "external";
    const crawl = (input.crawl ?? false) && kind !== "repo";
    const maxPages = Math.max(1, Math.min(25, input.maxPages ?? 20));
    const lines = [];
    lines.push(kind === "repo"
        ? `Audit the accessibility of the components in ${target} against WCAG 2.2 Level ${wcagLevel}.`
        : `Audit the accessibility of ${target} against WCAG 2.2 Level ${wcagLevel}.`);
    lines.push("");
    lines.push("AUTHORITATIVE SOURCES: WCAG 2.2 " + wcagLevel + ", W3C HTML/WAI-ARIA specifications, and the WAI-ARIA Authoring Practices Guide.");
    lines.push(`Target platform: ${PLATFORM_NAMES[platform]}.`);
    lines.push("");
    lines.push("PRACTICAL REFERENCES (cross-check findings against these before reporting a fix):");
    referencesFor("test").forEach((r) => lines.push(`- ${r.name} — ${r.url}\n  ${r.note}`));
    lines.push("");
    const steps = [
        ...leadingSteps(input, kind, crawl, maxPages),
        "For every finding, report: the WCAG success criterion, severity, the offending element, and a concrete fix.",
        "Manually verify what static analysis cannot: name/role/value exposure, keyboard operability and focus order, visible focus, contrast, persistent labels, ARIA id-reference integrity, and meaning not conveyed by color alone.\n" +
            PLATFORM_NOTES[platform].map((n) => `     - ${n}`).join("\n"),
        "Produce a prioritized remediation list (critical -> serious -> moderate -> minor), grouping repeats — one shared component causing 40 errors is one fix, not 40.",
        "Use the evidence_ref and audit_id returned by the browser audit when calling a11y_release_gate. Include reviewer-attributed attestations for manual gates. The gate rejects markup-only claims and verifies the evidence SHA-256 digest before deciding PASS/BLOCKED.",
    ];
    lines.push("STEPS:");
    steps.forEach((s, i) => lines.push(`  ${i + 1}. ${s}`));
    lines.push("");
    if (includeMcpSetup) {
        lines.push("TOOLS IN THE PAYLOAD (use them):");
        lines.push(mcpSetupBlock(agent, toolsFor(kind, crawl)));
        lines.push("");
    }
    lines.push("SUCCESS CRITERIA: the audit ends in a release-gate verdict, and no critical accessibility defect may remain open. Treat any critical issue as a release blocker and say plainly whether this is shippable.");
    return lines.join("\n");
}
