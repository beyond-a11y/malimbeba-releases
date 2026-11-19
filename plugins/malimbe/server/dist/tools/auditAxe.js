import { z } from "zod";
import { classifyTarget, runAxeAudit } from "../engine/axe.js";
import { createAuditEvidence, persistAuditEvidence } from "../engine/evidence.js";
import { buildReport, reportToMarkdown } from "../engine/report.js";
const InputSchema = z
    .object({
    url: z.string().min(1).describe("The http(s) URL to audit."),
    scope: z
        .enum(["auto", "external", "internal"])
        .default("auto")
        .describe("'external' = public-facing site (WCAG 2.2 Level A and AA). 'internal' = intranet/localhost/repo preview — additionally checks rendered widgets against their source pattern contracts. 'auto' classifies by hostname (loopback, RFC1918, .local/.internal/.test, single-label hosts are internal)."),
    source_pattern: z
        .string()
        .optional()
        .describe("Provenance of the source pattern for internal audits: design-system URL, package@version, or repo@SHA. Recorded against any pattern gaps found."),
    response_format: z.enum(["markdown", "json"]).default("markdown"),
})
    .strict();
export function registerAxeAuditTool(server) {
    server.registerTool("a11y_audit_axe", {
        title: "Audit a URL with axe-core against WCAG 2.2 Level A and AA",
        description: `Run a full axe-core accessibility scan in a real browser (Playwright) against WCAG 2.2 Levels A and AA, and return a structured report.

Also checks document structure — heading hierarchy (no skipped levels, no empty headings, covers role="heading"/aria-level custom headings too) and landmark regions (exactly one main, no duplicate/unlabeled landmarks, page has an h1, all content inside a landmark). These are axe-core rules tagged "best-practice" rather than a specific WCAG success criterion, so they're reported without a WCAG citation — real findings, just not ones a specific SC number backs.

Report includes: scan metadata, violation totals (types and element instances), a breakdown BY SEVERITY (critical/serious/moderate/minor), a breakdown BY WCAG SUCCESS CRITERION, and a task-confidence rating estimating whether a user can navigate the page and complete basic tasks.

External vs internal:
  - external (public-facing): scanned against WCAG 2.2 Level A and AA.
  - internal (intranet, localhost, repo preview): scanned against WCAG 2.2 Level A and AA AND checked for source-pattern conformance — whether rendered widgets honour the ARIA contract of the pattern they claim (dialog, tabs, menu button, tooltip, combobox, listbox, grid, tree view, tree grid). Covers the pattern-declaring element's own attributes plus, for tabs/menu button/tooltip, the related child or trigger element the contract actually lives on — see AUDIT-COVERAGE.md for exact scope. Pass source_pattern to record which design-system artifact they were checked against.

Requires a headless browser. Returns a clear error if Playwright/Chromium is unavailable rather than silently degrading.

Args:
  - url (string), scope ('auto'|'external'|'internal'), source_pattern (string, optional), response_format ('markdown'|'json').

Also reports what the page is built on (CMS, framework, component libraries, overlays, third-party scripts) with evidence, and where each fix has to happen. When a failing element sits inside a detected widget or platform control, its rule entries carry an origin.

Returns (json): { url, scope, standard, engine, scannedAt, totals, bySeverity, byCriterion, patternGaps, confidence: { band, score, rationale, blockers, basis }, stack: { detections, unknowns } }.`,
        inputSchema: InputSchema.shape,
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    }, async (args) => {
        const { url, scope, source_pattern, response_format } = InputSchema.parse(args);
        const resolvedScope = scope === "auto" ? classifyTarget(url) : scope;
        const run = await runAxeAudit(url, {
            scope: resolvedScope,
            // This tool audits a real, complete page — explicit, not relying on
            // runAxeAudit's own default (which defaults to the component-safe,
            // reduced rule set as of the "Polish release defaults" pass, since
            // most callers of the bare engine function are NOT full-page
            // audits). Omitting this here would silently drop
            // page-has-heading-one/landmark-one-main/region etc. from THE
            // audit of record for every real page — a real regression once
            // reproduced, not a hypothetical.
            pageContext: true,
            ...(source_pattern ? { sourcePattern: source_pattern } : {}),
        });
        if (run.error) {
            return {
                content: [{ type: "text", text: `Could not audit ${url}: ${run.error}` }],
                structuredContent: { url, scope: resolvedScope, ok: false, error: run.error },
            };
        }
        const report = buildReport(run);
        const evidence = createAuditEvidence(report, run, { kind: "deployed", ref: url });
        const evidenceRef = persistAuditEvidence(evidence);
        // Say plainly when the audited page is not on the site that was asked for.
        const landedNote = run.offSite
            ? `> **Redirected off-site:** ${url} landed on ${run.finalUrl} (${run.offSite}). These results describe that page, not ${new URL(url).hostname}.\n\n`
            : run.finalUrl ? `Resolved to ${run.finalUrl}.\n\n` : "";
        const withEvidence = { ...report, ...(run.finalUrl ? { finalUrl: run.finalUrl } : {}), ...(run.offSite ? { offSite: run.offSite } : {}), evidence: { auditId: evidence.auditId, reportDigest: evidence.reportDigest, evidenceRef, policy: evidence.policy, malimbebaVersion: evidence.malimbebaVersion } };
        const structured = withEvidence;
        if (response_format === "json") {
            return {
                content: [{ type: "text", text: JSON.stringify(withEvidence, null, 2) }],
                structuredContent: structured,
            };
        }
        return {
            content: [{ type: "text", text: `${landedNote}${reportToMarkdown(report)}\n\n**Evidence:** \`${evidenceRef}\` · audit ID \`${evidence.auditId}\`` }],
            structuredContent: structured,
        };
    });
}
