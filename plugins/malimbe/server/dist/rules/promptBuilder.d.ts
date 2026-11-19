import { CATALOG_INDEX, DESIGN_SYSTEM_COMPONENT, catalogLabel } from "./catalog.js";
export type Framework = "html" | "react" | "vue" | "angular" | "blazor" | "web-components";
export type Platform = "web" | "ios" | "android" | "windows" | "macos";
export type WcagLevel = "A" | "A and AA" | "AAA";
export type Agent = "claude-code" | "codex" | "generic";
export type DesignSystemKind = "none" | "deployed" | "package" | "ci-build" | "figma" | "xd" | "screenshot";
/** Design-file sources describe the intended visual/interaction spec — they are never rendered artifacts and can never satisfy the automated release gate. */
export declare const DESIGN_FILE_KINDS: DesignSystemKind[];
export interface DesignSystemSource {
    kind: DesignSystemKind;
    ref?: string;
    /** Optional inline `data:` URI for a screenshot source — small files only. UIs should stay under MAX_INLINE_IMAGE_DATA_URI_LENGTH and omit this field (falling back to `ref` as a filename) above that. */
    imageDataUri?: string;
}
/** ~150KB of base64 — large enough for a typical UI screenshot, small enough not to blow out a pasted prompt. */
export declare const MAX_INLINE_IMAGE_DATA_URI_LENGTH = 200000;
export interface BuildPromptInput {
    /** What to build, in the user's own words. If omitted, `component` must be set. */
    task?: string;
    /** A catalog component key (see catalog.ts). Injects its full contract when known. */
    component?: string;
    framework?: Framework;
    platform?: Platform;
    wcagLevel?: WcagLevel;
    designSystem?: DesignSystemSource;
    /** Raw design tokens (CSS custom properties, a token JSON blob, or plain name:value pairs) to use verbatim instead of inventing new ones. */
    designTokens?: string;
    /** Ask the agent to also produce interaction/focus/state tests. Default true. */
    includeTests?: boolean;
    /** Include MCP tool setup + the mandatory verify-chain instruction. Default true. */
    includeMcpSetup?: boolean;
    agent?: Agent;
}
export declare const FRAMEWORK_NAMES: Record<Framework, string>;
export declare const PLATFORM_NAMES: Record<Platform, string>;
export declare const PLATFORM_NOTES: Record<Platform, string[]>;
/**
 * MCP setup snippet for a given agent, naming the SPECIFIC tools this
 * prompt actually calls (not a fixed list) — exported so
 * auditPromptBuilder.ts can reuse it with the audit-relevant tool set
 * instead of re-declaring the setup boilerplate a third time.
 */
export declare function mcpSetupBlock(agent: Agent, tools?: string[]): string;
export declare function buildPrompt(input: BuildPromptInput): string;
/**
 * A standalone handoff document \u2014 for a ticket, a design review, or a
 * developer who isn't the one pasting buildPrompt()'s output into an agent.
 * Reuses the exact same contract/tokens/states/source facts as buildPrompt()
 * so the two can never disagree, but formatted to be read by a person, not
 * executed by an agent: no MCP setup, no verify-chain imperatives.
 */
export declare function buildHandoffSpec(input: BuildPromptInput): string;
export { CATALOG_INDEX, DESIGN_SYSTEM_COMPONENT, catalogLabel };
