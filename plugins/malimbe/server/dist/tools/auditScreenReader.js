import { z } from "zod";
import { runScreenReaderReview } from "../engine/screenReader.js";
const InputSchema = z.object({
    url: z.string().min(1).describe("The http(s) URL to inspect in Chromium's accessibility tree."),
    response_format: z.enum(["markdown", "json"]).default("markdown"),
}).strict();
function toMarkdown(result) {
    if (result.error)
        return `Could not inspect the accessibility tree for ${result.url}: ${result.error}`;
    const lines = [
        `# Accessible announcement review -- ${result.url}`,
        "",
        `Inspected ${result.entries.length} interactive accessibility-tree entries; found ${result.findings.length} item(s) for review.`,
        "",
        "This is a Chromium accessibility-tree snapshot, not a recording or prediction of VoiceOver/NVDA speech. Validate actual phrasing, timing, and task clarity with the target assistive technology.",
        "",
    ];
    if (result.findings.length) {
        lines.push("## Items to review");
        for (const finding of result.findings) {
            lines.push(`- **${finding.impact} / ${finding.ruleId}** -- ${finding.selector}: ${finding.detail} Fix: ${finding.fix}`);
        }
        lines.push("");
    }
    else {
        lines.push("No missing, generic, or repeated control names were detected by these heuristics.", "");
    }
    lines.push("## Accessibility tree entries");
    for (const entry of result.entries) {
        const name = entry.name ? `“${entry.name}”` : "(no name)";
        const description = entry.description ? `; description: “${entry.description}”` : "";
        const states = entry.states.length ? `; ${entry.states.join(", ")}` : "";
        lines.push(`- ${entry.selector}: ${entry.role} ${name}${description}${states}`);
    }
    lines.push("", result.note);
    return lines.join("\n");
}
export function registerScreenReaderAuditTool(server) {
    server.registerTool("a11y_audit_announcements", {
        title: "Review accessible names and states in the browser accessibility tree",
        description: `Inspect Chromium's computed accessibility tree for interactive roles, accessible names, descriptions, and exposed state. Flag unnamed controls, generic names, and repeated same-role names for human review.

This is NOT an actual VoiceOver/NVDA/TalkBack speech test. It cannot measure synthesized phrasing, announcement timing, verbosity preferences, or whether content makes sense to a person. Use it to prepare a targeted manual assistive-technology pass, not replace one.

Requires Chromium via Playwright. Returns the inspected role/name/description/state entries, heuristic findings, and the explicit manual-test limitation.

Args: url (string), response_format ('markdown'|'json').`,
        inputSchema: InputSchema.shape,
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    }, async (args) => {
        const { url, response_format } = InputSchema.parse(args);
        const result = await runScreenReaderReview(url);
        const structured = result;
        return {
            content: [{ type: "text", text: response_format === "json" ? JSON.stringify(result, null, 2) : toMarkdown(result) }],
            structuredContent: structured,
        };
    });
}
