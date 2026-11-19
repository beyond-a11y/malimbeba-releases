export type Impact = "critical" | "serious" | "moderate" | "minor";
export type WcagLevel = "A" | "AA" | "AAA";
/** A single machine-checkable accessibility rule. */
export interface Rule {
    /** Stable slug, e.g. "img-alt". Used as the finding id and in dedup rules. */
    id: string;
    /** One-line human summary of what the rule enforces. */
    title: string;
    /** WCAG Success Criteria this rule maps to, e.g. ["1.1.1"]. */
    wcag: string[];
    level: WcagLevel;
    impact: Impact;
    /** Short remediation guidance shown with every finding. */
    fix: string;
}
/** A concrete violation found in a document. */
export interface Finding {
    ruleId: string;
    title: string;
    wcag: string[];
    level: WcagLevel;
    impact: Impact;
    fix: string;
    /** The offending element, serialized to a short opening-tag snippet. */
    selector: string;
    snippet: string;
    detail: string;
}
export interface AuditSummary {
    total: number;
    byImpact: Record<Impact, number>;
    rulesChecked: number;
    passed: boolean;
}
export interface AuditResult {
    summary: AuditSummary;
    findings: Finding[];
}
/** Keyboard interaction contract for a component pattern. */
export interface KeyboardInteraction {
    key: string;
    action: string;
}
/** An accessible-pattern spec used to guide generation. */
export interface ComponentGuidance {
    component: string;
    /** WAI-ARIA role(s) the root/children should expose. */
    roles: string[];
    /** Required or recommended aria-* attributes. */
    aria: string[];
    keyboard: KeyboardInteraction[];
    /** Focus-management requirements (e.g. focus trap, return focus). */
    focus: string[];
    wcag: string[];
    /** Common mistakes to steer generation away from. */
    pitfalls: string[];
}
