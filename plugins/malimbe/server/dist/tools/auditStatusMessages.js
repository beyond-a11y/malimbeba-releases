import { z } from "zod";
import { classifyTarget } from "../engine/axe.js";
import { runStatusMessageCheck } from "../engine/statusMessages.js";
const InputSchema = z
    .object({
    url: z.string().min(1).describe("The http(s) URL to watch."),
    trigger_selector: z
        .string()
        .optional()
        .describe("Optional CSS selector to click after the passive observation window, then watch for further changes. Never auto-discovered -- omit it and only autonomous changes (timers, polling, server push) are checked, which needs no interaction at all."),
    observe_ms: z
        .number()
        .int()
        .min(500)
        .max(15000)
        .default(4000)
        .describe("How long to watch for changes, in each phase (passive, and again after the trigger if one is given). Longer windows catch slower async updates but take more time."),
    response_format: z.enum(["markdown", "json"]).default("markdown"),
})
    .strict();
function toMarkdown(result) {
    if (result.error)
        return `Could not complete the status-message check for ${result.url}: ${result.error}`;
    const lines = [];
    lines.push(`# Status messages -- ${result.url}`);
    lines.push("");
    lines.push(`Observed ${result.autonomousChanges} content change(s) with no interaction, ${result.triggered ? `and ${result.triggeredChanges} after the trigger` : "and no trigger was given"}.`);
    lines.push("");
    if (result.findings.length) {
        lines.push(`## Flagged for manual review (${result.findings.length})`);
        lines.push("Every item below is a content change not wrapped in a live region. Whether a user would actually miss it is a judgment call this check cannot make on its own -- the stated reason is the measurement offered to help a reviewer decide, not a verdict.");
        for (const finding of result.findings) {
            lines.push(`- **${finding.impact} / ${finding.ruleId}** -- ${finding.selector}: ${finding.detail} Fix: ${finding.fix}`);
        }
        lines.push("");
    }
    else {
        lines.push("No un-announced content changes were observed in this window.");
        lines.push("");
    }
    lines.push("This watches for a fixed window and cannot guarantee it caught every autonomous or delayed update -- a longer observe_ms may find more. It also cannot verify what is actually spoken by a screen reader, only whether a live region exists to carry the change to one.");
    return lines.join("\n");
}
export function registerStatusMessagesAuditTool(server) {
    server.registerTool("a11y_audit_status_messages", {
        title: "Watch a URL for un-announced content changes (WCAG 4.1.3)",
        description: `Watch a rendered page for content changes that are not wrapped in an ARIA live region -- the kind of update a screen-reader user would miss entirely if they are not focused on that part of the page when it happens.

Runs in two phases:
  - Passive (always runs, no interaction): watches for changes that happen on their own -- a timer, polling, an auto-rotating carousel, a server-pushed update. There is no clickable element to point at for these, so this phase needs no selector and never clicks anything.
  - Triggered (only if trigger_selector is given): clicks that one, caller-specified element and watches for changes afterward. Never auto-discovers something to click on its own, since guessing on a live external site risks a real side effect (a submission, a navigation, a logout).

For every change found outside a live region, states a measured reason rather than asserting a violation: whether it happened with no interaction at all (so a user's attention could have been anywhere), whether it rendered outside the visible viewport, or its geometric distance in pixels from the trigger that was clicked. Screen size, zoom, and layout all affect whether a given distance is actually noticeable, so this is flagged for manual review with the numbers stated, not a pass/fail claim.

Requires a headless browser. Returns a clear error if Playwright/Chromium is unavailable rather than silently degrading.

Args:
  - url (string), trigger_selector (string, optional), observe_ms (number, default 4000), response_format ('markdown'|'json').

Returns (json): { url, scope, triggered, autonomousChanges, triggeredChanges, findings }.`,
        inputSchema: InputSchema.shape,
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    }, async (args) => {
        const { url, trigger_selector, observe_ms, response_format } = InputSchema.parse(args);
        const scope = classifyTarget(url);
        const result = await runStatusMessageCheck(url, { triggerSelector: trigger_selector, observeMs: observe_ms });
        if (result.error) {
            return {
                content: [{ type: "text", text: `Could not complete the status-message check for ${url}: ${result.error}` }],
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
