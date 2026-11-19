import { z } from "zod";
import { CATALOG } from "../rules/catalog.js";
import { buildPrompt, MAX_INLINE_IMAGE_DATA_URI_LENGTH } from "../rules/promptBuilder.js";
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
        .describe("Source of truth to conform to, if any. 'figma'/'xd'/'screenshot' are design-file sources (visual/interaction spec) — never rendered artifacts, so they can never satisfy the automated release gate on their own; the built code still needs its own deployed/package/ci-build provenance. 'screenshot' is a single static image: no hover/focus/disabled/error/loading states or keyboard behavior can be inferred from it alone."),
    design_system_ref: z
        .string()
        .optional()
        .describe("Reference for the source (URL, pkg@version, repo@SHA, a Figma/Adobe XD file/frame link, or a screenshot file path/description). Required if design_system_kind is not 'none'."),
    design_system_image_data_uri: z
        .string()
        .startsWith("data:image/")
        .optional()
        .describe("Optional inline screenshot as a data: URI (small files only — large ones are dropped and only the filename/description in design_system_ref is kept). Only used when design_system_kind is 'screenshot'."),
    design_tokens: z
        .string()
        .optional()
        .describe("Raw design tokens (CSS custom properties, a token JSON blob, or plain name:value pairs) to use verbatim instead of inventing new ones."),
    include_tests: z.boolean().default(true).describe("Ask the agent to also produce interaction/focus/state tests."),
    include_mcp_setup: z
        .boolean()
        .default(true)
        .describe("Include MCP tool setup and the mandatory post-generation verify chain (audit → gate → manifest)."),
    agent: z
        .enum(["claude-code", "codex", "generic"])
        .default("generic")
        .describe("Target coding agent — only affects the MCP setup snippet's syntax."),
})
    .strict();
export function registerPromptTool(server) {
    server.registerTool("a11y_build_prompt", {
        title: "Build an accessibility-primed prompt",
        description: `Assemble a ready-to-paste prompt that primes any coding agent (Codex, Copilot, Claude Code, etc.) to GENERATE accessible code on the first try. It injects either a specific component's ARIA contract or the general WCAG ruleset, the framework/platform-specific requirements, and the mandatory post-generation verify chain (audit → release gate → manifest). This is the same builder Malimbe's UI prompt tools use — identical output either way.

Use this when a user is about to ask an agent to build UI and you want the request to bake in accessibility rather than bolt it on afterward.

Args:
  - task (string, optional): what to build. Required if component is omitted.
  - component (string, optional): a known pattern to inject its full contract. Available: ${CATALOG.map((c) => c.component).join(", ")}.
  - framework, platform, wcag_level: target environment and conformance level.
  - design_system_kind / design_system_ref: point the agent at an existing source of truth.
  - design_system_image_data_uri: optional inline screenshot (small files only) when design_system_kind is 'screenshot'.
  - design_tokens: raw tokens (CSS vars, JSON, or name:value pairs) to use verbatim instead of inventing new ones.
  - include_tests, include_mcp_setup, agent: payload shaping.

Returns: a single prompt string.`,
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
        const prompt = clamp(buildPrompt({
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
            includeTests: v.include_tests,
            includeMcpSetup: v.include_mcp_setup,
            agent: v.agent,
        }), 
        // The image is embedded twice (Markdown + raw data-URI fallback, see
        // promptBuilder.ts's sourceOfTruthBlock) — reserve room for both
        // copies so clamp never truncates into the base64 itself.
        embeddedImage ? embeddedImage.length * 2 + 500 : 0);
        return {
            content: [{ type: "text", text: prompt }],
            structuredContent: { prompt },
        };
    });
}
