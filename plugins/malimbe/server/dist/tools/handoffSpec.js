import { z } from "zod";
import { CATALOG } from "../rules/catalog.js";
import { buildHandoffSpec, MAX_INLINE_IMAGE_DATA_URI_LENGTH } from "../rules/promptBuilder.js";
import { clamp } from "../format.js";
const InputSchema = z
    .object({
    task: z
        .string()
        .optional()
        .describe('What to build, e.g. "a searchable country picker". Optional if `component` is set.'),
    component: z
        .string()
        .optional()
        .describe(`Optional known pattern to inject its full contract. Available: ${CATALOG.map((c) => c.component).join(", ")}.`),
    framework: z
        .enum(["html", "react", "vue", "angular", "blazor", "web-components"])
        .default("html")
        .describe("Target framework for the generated code."),
    platform: z
        .enum(["web", "ios", "android", "windows", "macos"])
        .default("web")
        .describe("Target platform — adds the relevant touch-target/zoom/screen-reader considerations."),
    wcag_level: z
        .enum(["A", "A and AA", "AAA"])
        .default("A and AA")
        .describe("WCAG 2.2 conformance level to build to."),
    design_system_kind: z
        .enum(["none", "deployed", "package", "ci-build", "figma", "xd", "screenshot"])
        .default("none")
        .describe("Source of truth to conform to, if any. 'figma'/'xd'/'screenshot' are design-file sources — never rendered artifacts, so they can never satisfy the automated release gate on their own."),
    design_system_ref: z
        .string()
        .optional()
        .describe("Reference for the source (URL, pkg@version, repo@SHA, a Figma/Adobe XD file/frame link, or a screenshot file path/description). Required if design_system_kind is not 'none'."),
    design_system_image_data_uri: z
        .string()
        .startsWith("data:image/")
        .optional()
        .describe("Optional inline screenshot as a data: URI (small files only). Only used when design_system_kind is 'screenshot'."),
    design_tokens: z
        .string()
        .optional()
        .describe("Raw design tokens (CSS custom properties, a token JSON blob, or plain name:value pairs) to use verbatim instead of inventing new ones."),
})
    .strict();
export function registerHandoffSpecTool(server) {
    server.registerTool("a11y_build_handoff_spec", {
        title: "Build a designer-to-developer handoff spec",
        description: `Assemble a standalone, human-readable handoff document for a component — a spec sheet for a ticket or design review, not an agent instruction. Combines the same pattern contract, design-source, design-tokens, and states/variants facts as a11y_build_prompt, so the two can never disagree, but formatted to be read by a person: no MCP setup, no verify-chain imperatives.

Use this when a designer wants something to attach to a ticket or send to a developer directly, instead of (or alongside) a11y_build_prompt's agent-facing prompt.

Args: same shape as a11y_build_prompt's design/component fields (task, component, framework, platform, wcag_level, design_system_kind/ref/image_data_uri, design_tokens).

Returns: a single markdown document string. This is NOT a release verdict — it explicitly discloses which manual gates remain unverified.`,
        inputSchema: InputSchema.shape,
        annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false,
        },
    }, async (args) => {
        const v = InputSchema.parse(args);
        if (!(v.task && v.task.trim().length >= 3) && !v.component) {
            return {
                isError: true,
                content: [{ type: "text", text: "Provide either `task` (min 3 chars) or `component`." }],
            };
        }
        const embeddedImage = v.design_system_image_data_uri && v.design_system_image_data_uri.length <= MAX_INLINE_IMAGE_DATA_URI_LENGTH
            ? v.design_system_image_data_uri
            : undefined;
        const spec = clamp(buildHandoffSpec({
            task: v.task,
            component: v.component,
            framework: v.framework,
            platform: v.platform,
            wcagLevel: v.wcag_level,
            designSystem: {
                kind: v.design_system_kind,
                ref: v.design_system_ref,
                imageDataUri: embeddedImage,
            },
            designTokens: v.design_tokens,
        }), 
        // Same reasoning as a11y_build_prompt (src/tools/prompt.ts): the image
        // is embedded twice, so reserve room for both copies.
        embeddedImage ? embeddedImage.length * 2 + 500 : 0);
        return {
            content: [{ type: "text", text: spec }],
            structuredContent: { spec },
        };
    });
}
