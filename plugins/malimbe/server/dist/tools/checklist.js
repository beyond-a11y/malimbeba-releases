import { z } from "zod";
import { IMPLEMENTATION_CHECKLIST } from "../policy/policy.js";
import { checklistToMarkdown } from "../format.js";
const InputSchema = z
    .object({
    section: z
        .enum(["A", "B", "C", "D", "E", "F", "COG", "G", "H"])
        .optional()
        .describe("Restrict to one section: A discovery/design, B contract, C implementation, D automated validation, E interaction test coverage, F manual validation, COG cognitive review, G documentation/supportability, H final release gate."),
    response_format: z.enum(["markdown", "json"]).default("markdown"),
})
    .strict();
export function registerChecklistTool(server) {
    server.registerTool("a11y_checklist", {
        title: "Get the implementation checklist",
        description: `Return the engineering-ready per-component accessibility checklist. Each item is tagged by how it is verified (auto / auto+manual / manual / design) and which Required Gate it rolls up to, so a team can work top-to-bottom while building a component.

Use this at the start of building a component, and to see which checklist items a given gate depends on.

Args:
  - section ('A'|'B'|'C'|'D', optional): restrict to one section.
  - response_format ('markdown'|'json'): default 'markdown'.

Returns (json): [{ id, name, items: [{ id, text, method, ruleIds, gate }] }].`,
        inputSchema: InputSchema.shape,
        annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false,
        },
    }, async (args) => {
        const { section, response_format } = InputSchema.parse(args);
        const sections = section
            ? IMPLEMENTATION_CHECKLIST.filter((s) => s.id === section)
            : IMPLEMENTATION_CHECKLIST;
        if (response_format === "json") {
            return {
                content: [{ type: "text", text: JSON.stringify(sections, null, 2) }],
                structuredContent: { sections },
            };
        }
        return {
            content: [{ type: "text", text: checklistToMarkdown(sections) }],
            structuredContent: { sections },
        };
    });
}
