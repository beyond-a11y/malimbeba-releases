import { z } from "zod";
import { GUIDANCE, GUIDANCE_INDEX } from "../rules/component-guidance.js";
import { guidanceToMarkdown } from "../format.js";
const InputSchema = z
    .object({
    component: z
        .string()
        .describe(`The component pattern to describe. Available: ${GUIDANCE.map((g) => g.component).join(", ")}.`),
    response_format: z
        .enum(["markdown", "json"])
        .default("markdown")
        .describe("Output format."),
})
    .strict();
export function registerGuidanceTool(server) {
    server.registerTool("a11y_component_guidance", {
        title: "Get accessible component guidance",
        description: `Return the accessibility contract for a UI component pattern — required roles, ARIA attributes, keyboard interactions, focus management, and common pitfalls — derived from the WAI-ARIA Authoring Practices Guide.

Use this BEFORE generating a component so the produced code meets the pattern's requirements.

Args:
  - component (string): pattern name (e.g. "dialog", "tabs", "combobox").
  - response_format ('markdown' | 'json'): default 'markdown'.

Returns (json): { component, roles, aria, keyboard: [{key, action}], focus, wcag, pitfalls }.
If the component is unknown, returns the list of available patterns.`,
        inputSchema: InputSchema.shape,
        annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false,
        },
    }, async (args) => {
        const { component, response_format } = InputSchema.parse(args);
        const g = GUIDANCE_INDEX.get(component.trim().toLowerCase());
        if (!g) {
            const available = GUIDANCE.map((x) => x.component).join(", ");
            return {
                content: [
                    {
                        type: "text",
                        text: `No guidance for "${component}". Available patterns: ${available}.`,
                    },
                ],
            };
        }
        const structured = g;
        if (response_format === "json") {
            return {
                content: [{ type: "text", text: JSON.stringify(g, null, 2) }],
                structuredContent: structured,
            };
        }
        return {
            content: [{ type: "text", text: guidanceToMarkdown(g) }],
            structuredContent: structured,
        };
    });
}
