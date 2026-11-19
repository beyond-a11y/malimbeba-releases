import { z } from "zod";
import { buildAuditPrompt, classifyAuditTarget } from "../rules/auditPromptBuilder.js";
import { clamp } from "../format.js";
const InputSchema = z
    .object({
    target: z.string().min(1).describe("The URL or repo path to audit."),
    kind: z
        .enum(["auto", "repo", "internal", "external"])
        .default("auto")
        .describe("Force a classification, or 'auto' to detect it from `target` (filesystem path/owner-repo slug = repo; loopback/RFC1918/.local/.internal/.test/single-label host = internal; otherwise external)."),
    crawl: z.boolean().default(false).describe("Crawl same-origin pages instead of auditing a single page. Ignored when kind resolves to 'repo'."),
    max_pages: z.number().int().min(1).max(20).default(20).describe("Only used when crawl is true."),
    wcag_level: z.enum(["A", "A and AA", "AAA"]).default("A and AA").describe("WCAG 2.2 conformance level to audit against."),
    platform: z
        .enum(["web", "ios", "android", "windows", "macos"])
        .default("web")
        .describe("Target platform — adds the relevant manual-verification considerations."),
    provenance_kind: z
        .enum(["deployed", "package", "ci-build", "pasted"])
        .optional()
        .describe("Provenance of the audited artifact, for the release-gate step. Omit if unknown — the prompt will ask the agent to supply one."),
    provenance_ref: z.string().optional().describe("Reference for the provenance (URL, pkg@version, or repo@SHA)."),
    source_pattern: z
        .string()
        .optional()
        .describe("Design-system source to check rendered widgets against (passed to a11y_audit_axe's source_pattern), for internal/repo targets."),
    include_mcp_setup: z.boolean().default(true).describe("Include MCP tool setup naming the specific tools this prompt calls."),
    agent: z
        .enum(["claude-code", "codex", "generic"])
        .default("generic")
        .describe("Target coding agent — only affects the MCP setup snippet's syntax."),
})
    .strict();
export function registerAuditPromptTool(server) {
    server.registerTool("a11y_build_audit_prompt", {
        title: "Build an accessibility-audit prompt",
        description: `Assemble a ready-to-paste prompt that primes any coding agent to AUDIT a URL or repo for accessibility — the test-side counterpart to a11y_build_prompt's build-side. Classifies the target (repo path, internal/intranet, or public-facing external), picks the right audit tool by default (a11y_audit_axe — the audit of record — for single pages; a11y_crawl_audit for multi-page crawls; a11y_audit_axe with scope="internal" plus a11y_audit_html for repo previews), and appends the mandatory release-gate step and the curated practical references. This is the same builder Malimbe's UI audit tools use — identical output either way.

Use this when a user is about to ask an agent to check something for accessibility and you want the request to name the right tool and end in a verdict, rather than an ad hoc scan.

Args:
  - target (string): URL or repo path to audit.
  - kind ('auto'|'repo'|'internal'|'external'): defaults to auto-detecting from target.
  - crawl, max_pages: multi-page crawl instead of a single page.
  - wcag_level, platform: conformance level and manual-verification considerations.
  - provenance_kind / provenance_ref / source_pattern: what's being audited and what design-system pattern it's checked against.
  - include_mcp_setup, agent: payload shaping.

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
        const kind = v.kind === "auto" ? (classifyAuditTarget(v.target) ?? "external") : v.kind;
        const prompt = clamp(buildAuditPrompt({
            target: v.target,
            kind,
            crawl: v.crawl,
            maxPages: v.max_pages,
            wcagLevel: v.wcag_level,
            platform: v.platform,
            provenanceKind: v.provenance_kind,
            provenanceRef: v.provenance_ref,
            sourcePattern: v.source_pattern,
            includeMcpSetup: v.include_mcp_setup,
            agent: v.agent,
        }));
        return {
            content: [{ type: "text", text: prompt }],
            structuredContent: { prompt, kind },
        };
    });
}
