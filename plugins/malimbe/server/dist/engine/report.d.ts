import type { AxeRunResult, AxeViolation, PatternGap } from "./axe.js";
import { type StackReport } from "./stack.js";
export type Severity = "critical" | "serious" | "moderate" | "minor";
export interface CriterionRow {
    criterion: string;
    violations: number;
    instances: number;
    rules: string[];
    /** Instance counts by detected origin, when any element was attributed. */
    origins?: OriginCount[];
}
export interface OriginCount {
    detectionId: string;
    name: string;
    instances: number;
}
export interface RuleSummary {
    id: string;
    help: string;
    instances: number;
    criteria: string[];
    origins?: OriginCount[];
}
export type ConfidenceBand = "High" | "Moderate" | "Low" | "Very low";
export interface Confidence {
    band: ConfidenceBand;
    score: number;
    rationale: string;
    blockers: string[];
    basis: string;
}
export interface ComponentReview {
    component: string;
    severity: Severity;
    summary: string;
    issues: string[];
    evidence: string[];
    remediation: string[];
}
export interface AuditReport {
    url: string;
    scope: string;
    standard: string;
    engine: string;
    scannedAt: string;
    runtime: {
        axeVersion: string | null;
        browserVersion: string | null;
        renderedDomDigest: string | null;
    };
    executiveSummary: string;
    componentReviews: ComponentReview[];
    componentSummaries: Array<{
        component: string;
        summary: string;
        issues: string[];
    }>;
    totals: {
        violationTypes: number;
        instances: number;
        bySeverity: Record<Severity, number>;
        instancesBySeverity: Record<Severity, number>;
        patternGaps: number;
    };
    bySeverity: Array<{
        severity: Severity;
        rules: RuleSummary[];
    }>;
    byCriterion: CriterionRow[];
    patternGaps: PatternGap[];
    confidence: Confidence;
    /** What the page is built on and where fixes have to happen. */
    stack?: StackReport;
}
/**
 * Confidence that a user relying on assistive technology can navigate the page
 * and complete basic tasks. Derived from the count and severity of violations,
 * with task-blocking rules weighted heavily. This is a heuristic triage signal,
 * NOT a measurement of real user success.
 */
export declare function rateConfidence(violations: AxeViolation[], patternGaps: PatternGap[]): Confidence;
export declare function buildReport(run: AxeRunResult): AuditReport;
export declare function reportToMarkdown(r: AuditReport): string;
