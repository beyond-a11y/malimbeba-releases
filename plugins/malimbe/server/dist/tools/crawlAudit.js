import { z } from "zod";
import { crawlAudit } from "../engine/fetch.js";
import { aggregateCrawl, crawlToMarkdown } from "../format.js";
import { RULES } from "../rules/wcag-rules.js";
import { crawlStackToMarkdown, summarizeCrawlStacks } from "../engine/stack.js";
const InputSchema = z
    .object({
    url: z.string().min(1).describe("The starting http(s) URL to crawl from."),
    max_pages: z
        .number()
        .int()
        .min(1)
        .max(20)
        .default(20)
        .describe("Maximum pages to audit (1-20). Same-origin links are followed breadth-first."),
    render: z
        .enum(["auto", "browser", "static"])
        .default("auto")
        .describe("Render mode for every page: 'browser' (JS-rendered DOM + shadow DOM), 'static' (delivered HTML), or 'auto' (browser when available, else static). Each page reports the mode used."),
    rule_ids: z
        .array(z.string())
        .optional()
        .describe(`Optional subset of rules. Available: ${RULES.map((r) => r.id).join(", ")}.`),
    response_format: z.enum(["markdown", "json"]).default("markdown"),
})
    .strict();
export function registerCrawlAuditTool(server) {
    server.registerTool("a11y_crawl_audit", {
        title: "Crawl and audit a site (up to 20 pages)",
        description: `Crawl same-origin pages breadth-first from a starting URL and audit each one, then aggregate the results into a single site-level report with a verdict: BLOCKED (critical defects), INCOMPLETE (no criticals, but one or more pages could not be audited — never treat as a pass), or PASS. Runs inside the agent's session — no external service.

Use this to audit a whole flow or section of a site at once instead of page by page.

Scope: follows only same-origin <a href> links, up to max_pages (hard cap 20). With render='browser'/'auto' each page is rendered in a headless browser so JS-built content and shadow DOM are audited; with 'static' only delivered HTML is read. Every page reports its renderMode. Static analysis — a clean result is necessary, not sufficient.

Args:
  - url (string): starting page.
  - max_pages (1-20, default 20): page cap.
  - rule_ids (string[], optional): restrict to specific rules.
  - response_format ('markdown'|'json'): default 'markdown'.

Also reports what the site is built on (platform, framework, widgets, overlays), detected once per origin from the same page loads, plus any path whose stack differs (for example, a React app under one path of a CMS site).

Returns (json): { start, aggregate: { pagesAudited, pagesFailed, totalFindings, byImpact, pagesWithCritical, topRules, verdict }, stack: { origins: [{ origin, stack }], differingPages: [{ url, stack }] }, pages: [{ url, status, ok, error?, result? }] }.`,
        inputSchema: InputSchema.shape,
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    }, async (args) => {
        const { url, max_pages, rule_ids, response_format, render } = InputSchema.parse(args);
        const pages = await crawlAudit(url, max_pages, rule_ids, render);
        const aggregate = aggregateCrawl(pages, max_pages);
        const stack = summarizeCrawlStacks(pages);
        const payload = { start: url, aggregate, stack, pages: pages.map(({ stack: _s, ...rest }) => rest) };
        if (response_format === "json") {
            return {
                content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
                structuredContent: payload,
            };
        }
        return {
            content: [{ type: "text", text: [crawlToMarkdown(url, pages, aggregate), crawlStackToMarkdown(stack)].filter(Boolean).join("\n\n") }],
            structuredContent: payload,
        };
    });
}
