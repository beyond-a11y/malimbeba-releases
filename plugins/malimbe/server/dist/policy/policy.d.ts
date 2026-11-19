export type Verification = "automated" | "manual" | "hybrid";
export type ComponentKind = "static" | "interactive" | "composite";
export interface NonNegotiable {
    id: string;
    title: string;
    verification: Verification;
    /** Ruleset rule ids that evidence the automated portion. */
    ruleIds: string[];
    /** What a human/agent must confirm for the manual portion. */
    manualCheck?: string;
    /** If set, only applies to these component kinds. */
    appliesTo?: ComponentKind[];
}
export declare const OBJECTIVE = "Ensure every shared component is accessible, consistent, testable, and supportable before release.";
export declare const ENFORCEMENT_PRINCIPLES: string[];
export interface DecisionStep {
    order: number;
    rule: string;
}
export declare const DECISION_HIERARCHY: DecisionStep[];
export declare const NON_NEGOTIABLES: NonNegotiable[];
export declare const NON_NEGOTIABLE_INDEX: Map<string, NonNegotiable>;
export interface LifecycleStage {
    order: number;
    name: string;
    requires: string[];
}
export declare const RELEASE_LIFECYCLE: LifecycleStage[];
/** Non-negotiables that apply to a given component kind. */
export declare function applicableNonNegotiables(kind: ComponentKind): NonNegotiable[];
export declare const DEFINITION_OF_DONE: string[];
export type GateEvidence = "automated" | "attested" | "hybrid";
export interface RequiredGate {
    id: string;
    name: string;
    evidence: GateEvidence;
    /** Ruleset rule ids evidencing the automated portion (empty = whole audit). */
    ruleIds: string[];
    /** Reviewer checklist: non-negotiable ids or literal Definition-of-Done items. */
    checklist: string[];
}
export declare const REQUIRED_GATES: RequiredGate[];
export declare const REQUIRED_GATE_INDEX: Map<string, RequiredGate>;
export interface RiskTier {
    tier: number;
    name: string;
    components: string[];
}
export declare const RISK_TIERS: RiskTier[];
/** Map a component name to its risk tier, or null if unrecognized. */
export declare function resolveTier(component: string): {
    tier: number;
    name: string;
} | null;
export declare const SUCCESS_CRITERIA = "Release proceeds only when all mandatory gates pass and no critical accessibility defects remain.";
export type CheckMethod = "automated" | "hybrid" | "attested" | "design-time";
export interface ChecklistItem {
    id: string;
    text: string;
    method: CheckMethod;
    /** Ruleset rule ids evidencing automated/hybrid items. */
    ruleIds: string[];
    /** Required Gate this item rolls up to. */
    gate: string;
}
export interface ChecklistSection {
    id: string;
    name: string;
    items: ChecklistItem[];
}
export declare const IMPLEMENTATION_CHECKLIST: ChecklistSection[];
export type ProvenanceKind = "deployed" | "package" | "ci-build" | "pasted" | "unspecified";
export interface ProvenanceTier {
    kind: ProvenanceKind;
    rank: number;
    name: string;
    /** May this provenance satisfy the automated accessibility gate? */
    satisfiesAutomatedGate: boolean;
    /** Identifier the submitter must supply for the claim to be verifiable. */
    requires: string;
    caveat: string;
}
export declare const PROVENANCE_TIERS: ProvenanceTier[];
export declare const PROVENANCE_INDEX: Map<ProvenanceKind, ProvenanceTier>;
