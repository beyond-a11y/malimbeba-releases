import { z } from "zod";
import { obtainHtml } from "../engine/fetch.js";
import { auditHtml } from "../engine/audit.js";
import { urlAuditToMarkdown } from "../format.js";
import { RULES } from "../rules/wcag-rules.js";
const InputSchema = z
    .object({
    url: z.string().min(1).describe("The http(s) URL to fetch and audit."),
    render: z
        .enum(["auto", "browser", "static"])
        .default("auto")
        .describe("'browser' renders in a headless browser (sees JS-rendered DOM and shadow DOM); 'static' fetches delivered HTML only; 'auto' prefers the browser and falls back to static, always reporting which was used."),
    rule_ids: z
        .array(z.string())
        .optional()
        .describe(`Optional subset of rules. Available: ${RULES.map((r) => r.id).join(", ")}.`),
    response_format: z.enum(["markdown", "json"]).default("markdown"),
})
    .strict();
export function registerAuditUrlTool(server) {
    server.registerTool("a11y_audit_url", {
        title: "Audit a live URL for accessibility",
        description: `Fetch a URL and audit its delivered HTML against the WCAG ruleset — no need to paste markup. Runs entirely inside the agent's session.

Scope: with render='browser' (or 'auto' when a browser is available) this audits the JAVASCRIPT-RENDERED DOM including shadow DOM, and adds runtime-only checks (computed contrast, focus indicators, target size). With render='static' it reads only the server-delivered HTML — accurate for SSR/static pages, partial for client-only SPAs and blind to web components. The response always names the renderMode actually used. It is static analysis (see a11y_audit_html for the same caveats).

Args:
  - url (string): the http(s) page to audit.
  - rule_ids (string[], optional): restrict to specific rules.
  - response_format ('markdown'|'json'): default 'markdown'.

Returns (json): { url, finalUrl, status, ok, renderMode, degradedReason?, error?, result?: { summary, findings } }.`,
        inputSchema: InputSchema.shape,
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    }, async (args) => {
        const { url, rule_ids, response_format, render } = InputSchema.parse(args);
        const fetched = await obtainHtml(url, render);
        if (!fetched.ok || !fetched.html) {
            const payload = { url, finalUrl: fetched.finalUrl, status: fetched.status, ok: false, error: fetched.error };
            return {
                content: [{ type: "text", text: `Could not audit ${url}: ${fetched.error || "fetch failed"} (status ${fetched.status}).` }],
                structuredContent: payload,
            };
        }
        const result = auditHtml(fetched.html, rule_ids);
        if (fetched.runtime.length) {
            result.findings = result.findings.concat(fetched.runtime);
            result.summary.total = result.findings.length;
            for (const rf of fetched.runtime)
                result.summary.byImpact[rf.impact]++;
            result.summary.passed = result.summary.total === 0;
        }
        const payload = {
            url, finalUrl: fetched.finalUrl, status: fetched.status, ok: true,
            renderMode: fetched.mode,
            ...(fetched.degradedReason ? { degradedReason: fetched.degradedReason } : {}),
            result,
        };
        if (response_format === "json") {
            return {
                content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
                structuredContent: payload,
            };
        }
        return {
            content: [{ type: "text", text: urlAuditToMarkdown(url, fetched.finalUrl, result) }],
            structuredContent: payload,
        };
    });
}
