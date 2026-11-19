import { type FindingOrigin, type StackReport } from "./stack.js";
/**
 * Tag set for full WCAG 2.2 conformance at Levels A and AA.
 * Includes every Level A and AA tag from 2.0, 2.1 and 2.2. "wcag22a" is
 * included for forward compatibility: WCAG 2.2 adds Level A criteria (3.2.6
 * Consistent Help, 3.3.7 Redundant Entry) that current axe builds do not yet
 * tag, because they are not reliably auto-testable.
 */
export declare const WCAG22_A_AA_TAGS: string[];
/** @deprecated use WCAG22_A_AA_TAGS */
export declare const WCAG22AA_TAGS: string[];
export type TargetScope = "external" | "internal";
export interface AxeNode {
    target: string;
    html: string;
    failureSummary: string;
    /** Which detected platform/widget produced this element, when a marker proves it. */
    origin?: FindingOrigin;
}
export interface AxeViolation {
    id: string;
    impact: "critical" | "serious" | "moderate" | "minor";
    help: string;
    helpUrl: string;
    /** WCAG success criteria derived from axe tags, e.g. ["1.4.3"]. */
    criteria: string[];
    tags: string[];
    nodes: AxeNode[];
}
export interface PatternGap {
    component: string;
    selector: string;
    missing: string[];
    source: string | null;
}
export interface AxeRunResult {
    url: string;
    scope: TargetScope;
    engine: string;
    standard: string;
    violations: AxeViolation[];
    passCount: number;
    incompleteCount: number;
    patternGaps: PatternGap[];
    axeVersion?: string;
    browserVersion?: string;
    renderedDomDigest?: string;
    /** What the page is built on, detected in the same page load. */
    stack?: StackReport;
    /** Where the browser landed after redirects, when it differs from `url`. */
    finalUrl?: string;
    /** Set when `finalUrl` is on a different site than `url` (www. ignored). */
    offSite?: string;
    error?: string;
}
/**
 * Classify a target. Internal = loopback, RFC1918/CGNAT ranges, .local/.internal
 * style hosts, or an explicit non-public port-forwarded host. Everything else is
 * treated as public-facing.
 */
export declare function classifyTarget(url: string): TargetScope;
/**
 * Heading/landmark structure rules worth surfacing even though axe-core tags
 * them "best-practice" rather than a specific WCAG success criterion —
 * heading hierarchy and landmark structure are foundational to WCAG 1.3.1
 * (Info and Relationships) and 2.4.1 (Bypass Blocks) even where axe itself
 * draws no direct SC line. Enabled explicitly via `rules[id].enabled`, which
 * axe-core's own rule-selection precedence honours over tag-based matching
 * (see `ruleShouldRun` in axe-core's source) — NOT by widening to the whole
 * "best-practice" tag, which also carries a lot of noisy, opinionated checks
 * with no bearing on document structure. Verified against the installed
 * axe-core's actual rule tags directly, not assumed:
 * `landmark-complementary-is-top-level` is excluded because axe-core itself
 * marks it deprecated.
 *
 * Split in two because "does this document have exactly one main landmark /
 * one h1 / all content inside a landmark" is a whole-PAGE question — asking
 * it of a11y_audit_demo's isolated component-in-a-wrapper-page would produce
 * false-positive noise having nothing to do with the component under test.
 * heading-order/empty-heading/landmark-unique stay meaningful at any scope
 * (a component embedding two identically-unlabeled <nav>s is a real bug
 * regardless of page context), so those run everywhere.
 */
export declare const STRUCTURE_RULE_IDS_ALWAYS: string[];
/** Whole-document structure rules — see STRUCTURE_RULE_IDS_ALWAYS above. */
export declare const STRUCTURE_RULE_IDS_PAGE_ONLY: string[];
/** Map axe tags to WCAG success-criterion numbers (tag form: wcag143 -> 1.4.3). */
export declare function criteriaFromTags(tags: string[]): string[];
/**
 * Run an axe-core WCAG 2.2 AA scan against a URL in a real browser.
 * Internal targets additionally get source-pattern conformance analysis.
 *
 * @param opts.pageContext Defaults to `false` for component-safe behavior.
 *   Whole-document structure rules (page-has-heading-one,
 *   landmark-one-main, region, etc.) are only included for real pages that
 *   are meant to have page chrome. This avoids the false-positive findings
 *   that used to appear when the engine was called directly against an
 *   isolated component wrapper. Pass `pageContext: true` for a real page,
 *   including full-document structure audits (`a11y_audit_axe` does this
 *   by default). See `STRUCTURE_RULE_IDS_ALWAYS`/`STRUCTURE_RULE_IDS_PAGE_ONLY`
 *   above.
 */
export declare function runAxeAudit(url: string, opts?: {
    scope?: TargetScope;
    sourcePattern?: string;
    pageContext?: boolean;
}): Promise<AxeRunResult>;
/** Pattern contract text for a component, used when reporting gaps. */
export declare function contractSummary(component: string): string | null;
