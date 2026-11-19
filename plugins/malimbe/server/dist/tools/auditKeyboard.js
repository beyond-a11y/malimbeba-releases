import { z } from "zod";
import { classifyTarget } from "../engine/axe.js";
import { runKeyboardWalkthrough } from "../engine/keyboard.js";
const InputSchema = z
    .object({
    url: z.string().min(1).describe("The http(s) URL to walk."),
    max_steps: z
        .number()
        .int()
        .min(10)
        .max(500)
        .default(150)
        .describe("Safety cap on Tab presses issued, so a page with runaway or infinite focusable content cannot hang the walkthrough. A result that hits the cap is reported as incomplete, not as a pass."),
    response_format: z.enum(["markdown", "json"]).default("markdown"),
})
    .strict();
function toMarkdown(result) {
    if (result.error)
        return `Could not complete the keyboard walkthrough for ${result.url}: ${result.error}`;
    const lines = [];
    lines.push(`# Keyboard walkthrough -- ${result.url}`);
    lines.push("");
    lines.push(`Reached ${result.reachedCount} of ${result.expectedCount} visible, enabled interactive elements in ${result.steps} Tab presses.`);
    if (result.incomplete)
        lines.push(`Stopped at the step cap (${result.steps}) without reaching a natural end -- this result is a lower bound, not exhaustive. Re-run with a higher max_steps if the page has many controls.`);
    lines.push("");
    if (result.trapped) {
        lines.push(`## Keyboard trap`);
        lines.push(`Tab stopped making progress and kept returning to **${result.trapAt}**. If this is a deliberate trap (an open modal), confirm Escape or a close control actually releases it -- this walkthrough cannot tell a deliberate, working trap apart from a broken one on its own.`);
        lines.push("");
    }
    if (result.unreachable.length) {
        lines.push(`## Unreachable by keyboard (${result.unreachable.length})`);
        result.unreachable.forEach((u) => lines.push(`- ${u.selector} -- ${u.snippet}`));
        lines.push("");
    }
    if (result.orderMismatches.length) {
        lines.push(`## Focus order vs. visual layout (${result.orderMismatches.length} possible mismatch${result.orderMismatches.length === 1 ? "" : "es"})`);
        lines.push("Heuristic, not a hard failure -- some backward jumps are intentional (e.g. a skip link). Confirm each one reads sensibly to a keyboard user.");
        result.orderMismatches.forEach((m) => lines.push(`- ${m.detail} (from ${m.from} to ${m.to})`));
        lines.push("");
    }
    if (!result.trapped && !result.unreachable.length && !result.orderMismatches.length) {
        lines.push("No keyboard-reachability, trap, or focus-order issues found by this walkthrough.");
        lines.push("");
    }
    lines.push("This covers reachability, traps, and visual focus order only -- it does not verify a component's specific keyboard CONTRACT (arrow keys in a tablist, Escape closing a dialog, etc.). That still needs a11y_component_guidance's contract plus a manual or hand-written interaction-test pass.");
    return lines.join("\n");
}
export function registerKeyboardAuditTool(server) {
    server.registerTool("a11y_audit_keyboard", {
        title: "Walk a URL by keyboard and report reachability, traps, and focus order",
        description: `Drive real Tab/Shift+Tab key presses through a rendered page in a headless browser and report what a keyboard-only user would actually experience -- not a static markup check.

Reports three pattern-agnostic things:
  - Reachability: every visible, enabled interactive element (links, buttons, form controls, anything with tabindex) that the Tab walk never focused.
  - Traps: Tab making no further progress, repeatedly landing on the same element instead of moving on.
  - Focus order vs. visual layout: a heuristic flag (WCAG 2.4.3-adjacent) when focus jumps backward against top-to-bottom visual position -- some jumps are intentional (a skip link), so this is reported for review, not asserted as a hard failure.

This does NOT verify a specific component's keyboard CONTRACT (arrow-key navigation inside a tablist, Escape closing a dialog, roving tabindex correctness) -- that stays pattern-specific and belongs to a11y_component_guidance's contract plus a manual or hand-written interaction test. Until this tool existed, keyboard reachability/traps/focus-order were entirely manual gates (see skills/accessibility-auditing/SKILL.md's "What automated checks cannot do") -- this closes the pattern-agnostic part of that gap, not all of it.

Requires a headless browser. Returns a clear error if Playwright/Chromium is unavailable rather than silently degrading.

Args:
  - url (string), max_steps (number, default 150 -- safety cap, not a target), response_format ('markdown'|'json').

Returns (json): { url, scope, expectedCount, reachedCount, unreachable, trapped, trapAt, steps, incomplete, orderMismatches, findings }.`,
        inputSchema: InputSchema.shape,
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    }, async (args) => {
        const { url, max_steps, response_format } = InputSchema.parse(args);
        const scope = classifyTarget(url);
        const result = await runKeyboardWalkthrough(url, { maxSteps: max_steps });
        if (result.error) {
            return {
                content: [{ type: "text", text: `Could not complete the keyboard walkthrough for ${url}: ${result.error}` }],
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
