import type { Manifest } from "../policy/manifest.js";
/**
 * Consistency rules operate across the WHOLE library, not one component.
 * A library of individually-compliant components that each behave differently
 * still fails its users: the accessibility payoff of a design system is that a
 * pattern learned once transfers everywhere.
 */
export type ConsistencySeverity = "high" | "medium" | "low";
export interface ConsistencyFinding {
    ruleId: string;
    title: string;
    severity: ConsistencySeverity;
    detail: string;
    components: string[];
    fix: string;
}
export interface ConsistencyResult {
    componentsChecked: number;
    findings: ConsistencyFinding[];
    bySeverity: Record<ConsistencySeverity, number>;
    consistent: boolean;
}
export declare function checkConsistency(m: Manifest): ConsistencyResult;
