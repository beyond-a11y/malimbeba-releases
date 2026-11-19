import type { Impact } from "../types.js";
import { type AuditEvidenceRecord, type EvidenceFinding } from "./evidence.js";
import { type GateEvidence, type ProvenanceKind } from "../policy/policy.js";
export interface GateInput {
    /** Path to an integrity-checked browser audit artifact under .malimbeba/evidence/. */
    evidenceRef?: string;
    /** Internal/test-only form of the verified audit artifact. */
    evidence?: AuditEvidenceRecord;
    /** Component name used to resolve the risk tier (e.g. "combobox"). */
    component?: string;
    /** Explicit tier override when the component name is unknown. */
    tier?: number;
    /** Human review records tied to the immutable audit ID. */
    attestations: ReviewerAttestation[];
    /** Minimum impact that blocks release (default: moderate). Critical always blocks. */
    minImpact?: Impact;
}
export interface ReviewerAttestation {
    gateId: string;
    reviewer: string;
    reviewedAt: string;
    auditId: string;
    evidenceRef?: string;
    notes?: string;
}
export interface ProvenanceRecord {
    kind: ProvenanceKind;
    rank: number;
    name: string;
    ref: string | null;
    satisfiesAutomatedGate: boolean;
    caveat: string;
}
export interface GateStatus {
    id: string;
    name: string;
    evidence: GateEvidence;
    status: "pass" | "fail";
    reason: string;
    findings?: EvidenceFinding[];
    reviewers?: string[];
}
export interface GateResult {
    verdict: "PASS" | "BLOCKED";
    tier: number | null;
    tierName: string | null;
    automatedEvaluated: boolean;
    evidence: {
        auditId: string | null;
        evidenceRef: string | null;
        policyVersion: string | null;
        reportDigest: string | null;
    };
    provenance: ProvenanceRecord;
    criticalDefects: EvidenceFinding[];
    gates: GateStatus[];
    unmet: string[];
    warnings: string[];
}
export declare function evaluateGate(input: GateInput): GateResult;
