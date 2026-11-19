import type { Agent, Platform, WcagLevel } from "./promptBuilder.js";
export type AuditKind = "repo" | "internal" | "external";
export type ProvenanceKind = "deployed" | "package" | "ci-build" | "pasted";
export interface AuditPromptInput {
    /** URL or repo path to audit. */
    target: string;
    /** Force a classification instead of auto-detecting from `target`. */
    kind?: AuditKind;
    /** Crawl same-origin pages instead of auditing a single page. Ignored for kind "repo". */
    crawl?: boolean;
    /** 1-25. Only meaningful when crawl is true. */
    maxPages?: number;
    wcagLevel?: WcagLevel;
    platform?: Platform;
    /** Provenance for the release-gate step. */
    provenanceKind?: ProvenanceKind;
    provenanceRef?: string;
    /** Design-system source to check rendered widgets against (a11y_audit_axe's source_pattern), for internal/repo targets. */
    sourcePattern?: string;
    includeMcpSetup?: boolean;
    agent?: Agent;
}
/**
 * Classify an audit target the same way for both UIs: a filesystem-looking
 * path or bare `owner/repo` slug is "repo"; a loopback/RFC1918/.local/.test/
 * single-label host is "internal"; anything else is "external". Mirrors
 * (and is authoritative over) engine/axe.ts's classifyTarget, which only
 * distinguishes internal/external — this adds the "repo" case the UI needs
 * for its own STEPS branching, before there's even a URL to classify.
 */
export declare function classifyAuditTarget(target: string): AuditKind | null;
export declare function buildAuditPrompt(input: AuditPromptInput): string;
