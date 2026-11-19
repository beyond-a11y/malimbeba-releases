import { z } from "zod";
import { serveDemo, loadSourceFiles } from "../engine/demo.js";
import { runAxeAudit } from "../engine/axe.js";
import { createAuditEvidence, persistAuditEvidence } from "../engine/evidence.js";
import { buildReport, reportToMarkdown } from "../engine/report.js";
import { auditHtml } from "../engine/audit.js";
const InputSchema = z
    .object({
    markup: z.string().min(1).describe("Body HTML that exercises the component(s), e.g. '<my-dialog label=\"Hi\">...</my-dialog>'."),
    files: z.array(z.string()).optional().describe("Local JS/CSS file paths (under the working directory) to load into the page. .js/.mjs files are AUTOMATICALLY loaded via <script type=\"module\">, .css via <link rel=\"stylesheet\"> — do not also list them in 'modules', that imports them a second time."),
    component_code: z.string().optional().describe("Inline component source to run in the page (alternative to files)."),
    styles: z.string().optional().describe("Inline CSS to include."),
    modules: z.array(z.string()).optional().describe("EXTERNAL ES module specifiers to import via <script type=\"module\">import '...'</script> — a full URL (e.g. a CDN package build like 'https://esm.sh/some-package') or another already-served absolute path. NOT for local files: those belong in 'files', which auto-loads them already."),
    title: z.string().optional(),
    lang: z.string().default("en"),
    source_pattern: z.string().optional().describe("Provenance of the code under test (repo@SHA, pkg@version); recorded against pattern gaps."),
    response_format: z.enum(["markdown", "json"]).default("markdown"),
})
    .strict();
export function registerAuditDemoTool(server) {
    server.registerTool("a11y_audit_demo", {
        title: "Audit unhosted component code via a local demo page",
        description: `Serve component code that is NOT yet hosted on an ephemeral http://127.0.0.1 page, then run the full axe-core WCAG 2.2 A+AA audit against it in a real browser — and tear the server down.

This closes the pre-production gap: it lets "Accessibility Review" work on code that only exists on disk, with no dev server, preview deploy, or promotion required. Because it produces a real localhost URL and a real render, the result is a genuine audit (computed contrast, focus indicators, rendered target size, shadow-scoped ARIA, source-pattern conformance) — not the paste-box smoke test. The target is classified 'internal', so source-pattern conformance is included.

Also checks heading hierarchy within the supplied markup (no skipped levels, no empty headings, covers role="heading"/aria-level too). Whole-PAGE structure checks (must have exactly one h1, must have a main landmark, all content inside a landmark) are deliberately NOT applied here — this serves an isolated component in a bare wrapper page, and those checks would just flag the wrapper for lacking chrome the component was never meant to provide. Use a11y_audit_axe against a real page for those.

Provide the component via 'files' (paths under the working directory), 'component_code' (inline), and/or 'modules', plus 'markup' that uses it. Requires a browser (Playwright/Chromium); if none is available it still serves the page and falls back to a static audit of the served HTML, and says so.

Args: markup, files[], component_code, styles, modules[], title, lang, source_pattern, response_format.

Returns (json): a full audit report { url, scope:'internal', standard, totals, bySeverity, byCriterion, patternGaps, confidence } plus servedFrom and renderMode.`,
        inputSchema: InputSchema.shape,
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    }, async (args) => {
        const a = InputSchema.parse(args);
        // Assemble the page spec from whatever the developer supplied.
        const scripts = [];
        const loadErrors = [];
        if (a.component_code)
            scripts.push(a.component_code);
        // Catch a real footgun, reproduced firsthand: a .js/.mjs file passed to
        // BOTH 'files' (which auto-loads it via <script type="module">, see
        // buildDemoHtml in engine/demo.ts) and 'modules' (which imports it
        // again) double-loads it. Many components tolerate this silently
        // (customElements.define guarded against re-registration), but a less
        // defensive one throws on the second load — surface it either way
        // rather than let it fail mysteriously or double-execute unnoticed.
        if (a.files && a.modules) {
            const autoLoadedUrls = new Set(a.files.filter((f) => /\.m?js$/.test(f)).map((f) => `/asset/${encodeURIComponent(f)}`));
            for (const m of a.modules) {
                if (autoLoadedUrls.has(m)) {
                    loadErrors.push(`'${m}' is in both 'files' and 'modules' — 'files' already auto-loads .js/.mjs files, so this imports it a second time. Remove it from 'modules'.`);
                }
            }
        }
        const spec = {
            markup: a.markup,
            ...(a.title ? { title: a.title } : {}),
            lang: a.lang,
            assets: {
                ...(a.files ? { files: a.files } : {}),
                ...(a.modules ? { modules: a.modules } : {}),
                ...(a.styles ? { styles: [a.styles] } : {}),
                scripts,
            },
        };
        let demo;
        try {
            demo = await serveDemo(spec);
        }
        catch (e) {
            return {
                content: [{ type: "text", text: `Could not start the local demo server: ${e.message}` }],
                structuredContent: { ok: false, error: e.message },
            };
        }
        try {
            const run = await runAxeAudit(demo.url, {
                scope: "internal",
                // Whole-page structure rules (one h1, one main landmark, all
                // content in a landmark, ...) don't apply to an isolated component
                // rendered in a bare wrapper page — see STRUCTURE_RULE_IDS_ALWAYS
                // in engine/axe.ts for why this is split from a11y_audit_axe.
                pageContext: false,
                ...(a.source_pattern ? { sourcePattern: a.source_pattern } : {}),
            });
            // Browser unavailable: still give a real (static) audit of the served page.
            if (run.error) {
                const staticAudit = auditHtml(spec.markup);
                const payload = {
                    ok: true,
                    servedFrom: demo.url,
                    renderMode: "static-fallback",
                    note: run.error,
                    result: staticAudit,
                    loadErrors,
                };
                const md = `# Demo audit (static fallback) — served at ${demo.url}\n\n` +
                    `A browser was not available, so this is a static audit of the supplied markup, not a rendered axe scan.\n` +
                    `_${run.error}_\n\n` +
                    `Findings: ${staticAudit.summary.total} (static ruleset). For the full WCAG 2.2 A+AA scan, install a browser: npx playwright install chromium.`;
                return {
                    content: [{ type: "text", text: a.response_format === "json" ? JSON.stringify(payload, null, 2) : md }],
                    structuredContent: payload,
                };
            }
            const report = buildReport(run);
            const evidence = createAuditEvidence(report, run, { kind: "pasted", ref: null });
            const evidenceRef = persistAuditEvidence(evidence);
            const withMeta = { ...report, servedFrom: demo.url, renderMode: "browser", loadErrors, evidence: { auditId: evidence.auditId, reportDigest: evidence.reportDigest, evidenceRef, policy: evidence.policy, malimbebaVersion: evidence.malimbebaVersion } };
            const md = `_Served unhosted code at ${demo.url} for this scan._\n\n` +
                reportToMarkdown(report) +
                `\n\n**Evidence:** \`${evidenceRef}\` · audit ID \`${evidence.auditId}\`` +
                (loadErrors.length ? `\n\n**Asset load warnings:**\n${loadErrors.map((e) => `- ${e}`).join("\n")}` : "");
            return {
                content: [{ type: "text", text: a.response_format === "json" ? JSON.stringify(withMeta, null, 2) : md }],
                structuredContent: withMeta,
            };
        }
        finally {
            await demo.close();
        }
    });
}
export { loadSourceFiles };
