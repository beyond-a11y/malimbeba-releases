import { z } from "zod";
import { classifyTarget } from "../engine/axe.js";
import { runReadingOrderCheck } from "../engine/readingOrder.js";
const InputSchema = z
    .object({
    url: z.string().min(1).describe("The http(s) URL to check."),
    response_format: z.enum(["markdown", "json"]).default("markdown"),
})
    .strict();
function toMarkdown(result) {
    if (result.error)
        return `Could not complete the reading-order check for ${result.url}: ${result.error}`;
    const lines = [];
    lines.push(`# Reading order -- ${result.url}`);
    lines.push("");
    lines.push(`Checked ${result.itemCount} meaningful content elements (headings, text, links, controls, images with alt text).`);
    lines.push("");
    if (result.orderMismatches.length) {
        lines.push(`## Possible reading-order mismatches (${result.orderMismatches.length})`);
        lines.push("Heuristic, not a hard failure -- some backward jumps are intentional. Confirm each one reads sensibly both visually and to assistive tech reading the page linearly.");
        result.orderMismatches.forEach((m) => lines.push(`- ${m.detail} (from ${m.from} to ${m.to})`));
        lines.push("");
    }
    else {
        lines.push("No reading-order mismatches found by this check.");
        lines.push("");
    }
    lines.push("This checks DOM order against visual position (the WCAG 1.3.2-groundable proxy) -- it does not evaluate true F-pattern or Z-pattern eye-tracking conformance, which is a design heuristic about visual attention, not a programmatically checkable property.");
    return lines.join("\n");
}
export function registerReadingOrderAuditTool(server) {
    server.registerTool("a11y_audit_reading_order", {
        title: "Check a URL's DOM order against its visual reading order",
        description: `Compare the DOM order of a page's meaningful content (headings, text, links, form controls, images with alt text) against its rendered visual position, in a real browser.

Flags a heuristic mismatch (WCAG 1.3.2-adjacent) when content later in DOM order renders meaningfully ABOVE content earlier in DOM order -- the sequence a sighted user reads top-to-bottom and the sequence assistive tech reads linearly have diverged. Some jumps are intentional (a skip link, a sidebar that legitimately reads after the main content but sits first visually), so this is reported for review, not asserted as a hard failure.

This is NOT a check of true F-pattern or Z-pattern eye-tracking conformance -- that is a UX design heuristic about where sighted users' attention naturally goes, not something a tool can verify. It is the closest programmatically-checkable proxy: does the order assistive tech experiences match the order a sighted user sees.

Distinct from a11y_audit_keyboard's focus-order check: CSS layout that visually reorders content (flex/grid \`order\`, absolute positioning) does NOT reorder how assistive tech reads content linearly, even though modern browsers DO reorder sequential Tab focus to follow \`order\` -- these are two different sequences, each independently correct or wrong.

Requires a headless browser. Returns a clear error if Playwright/Chromium is unavailable rather than silently degrading.

Args:
  - url (string), response_format ('markdown'|'json').

Returns (json): { url, scope, itemCount, orderMismatches, findings }.`,
        inputSchema: InputSchema.shape,
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    }, async (args) => {
        const { url, response_format } = InputSchema.parse(args);
        const scope = classifyTarget(url);
        const result = await runReadingOrderCheck(url);
        if (result.error) {
            return {
                content: [{ type: "text", text: `Could not complete the reading-order check for ${url}: ${result.error}` }],
                structuredContent: { url, scope, ok: false, error: result.error },
            };
        }
        const structured = { ...result, scope };
        if (response_format === "json") {
            return {
                content: [{ type: "text", text: JSON.stringify(structured, null, 2) }],
                structuredContent: structured,
            };
        }
        return {
            content: [{ type: "text", text: toMarkdown(result) }],
            structuredContent: structured,
        };
    });
}
