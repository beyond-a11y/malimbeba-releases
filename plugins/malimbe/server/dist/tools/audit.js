import { z } from "zod";
import { auditHtml } from "../engine/audit.js";
import { auditToMarkdown } from "../format.js";
import { RULES } from "../rules/wcag-rules.js";
const InputSchema = z
    .object({
    html: z
        .string()
        .min(1, "Provide the HTML markup to audit.")
        .describe("The HTML document or fragment to audit."),
    rule_ids: z
        .array(z.string())
        .optional()
        .describe(`Optional subset of rule ids. Available: ${RULES.map((r) => r.id).join(", ")}.`),
    response_format: z
        .enum(["markdown", "json"])
        .default("markdown")
        .describe("Output format: 'markdown' for a readable report or 'json' for structured findings."),
})
    .strict();
export function registerAuditTool(server) {
    server.registerTool("a11y_audit_html", {
        title: "Audit HTML for accessibility",
        description: `Audit an HTML document or fragment against a WCAG 2.1 A/AA static ruleset and return violations with success-criteria references and concrete fixes.

Use this to TEST existing UI (a component's rendered output, a page's source, or generated markup) before shipping.

Args:
  - html (string): the markup to audit.
  - rule_ids (string[], optional): restrict to specific rules; omit to run all.
  - response_format ('markdown' | 'json'): default 'markdown'.

Returns (json): { summary: { total, byImpact, rulesChecked, passed }, findings: [{ ruleId, title, wcag, level, impact, selector, snippet, detail, fix }] }.

Scope: this is static analysis. It catches missing names, labels, roles, structure, and inline-color contrast, but cannot see computed styles, runtime state, or actual screen-reader output. A clean result is necessary, not sufficient.`,
        inputSchema: InputSchema.shape,
        annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false,
        },
    }, async (args) => {
        const { html, rule_ids, response_format } = InputSchema.parse(args);
        const result = auditHtml(html, rule_ids);
        const structured = result;
        if (response_format === "json") {
            return {
                content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
                structuredContent: structured,
            };
        }
        return {
            content: [{ type: "text", text: auditToMarkdown(result) }],
            structuredContent: structured,
        };
    });
}
