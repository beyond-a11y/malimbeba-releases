import type { AxeRunResult } from "./axe.js";
import type { AuditReport, Severity } from "./report.js";
export type EvidenceProvenanceKind = "deployed" | "package" | "ci-build" | "pasted" | "unspecified";
export interface AuditArtifact {
    kind: EvidenceProvenanceKind;
    ref: string | null;
}
export interface EvidenceFinding {
    impact: Severity;
    ruleId: string;
    title: string;
    detail: string;
    evidence: string[];
}
export interface AuditEvidenceRecord {
    schemaVersion: number;
    auditId: string;
    reportDigest: string;
    recordedAt: string;
    policy: {
        version: string;
        fingerprint: string;
    };
    malimbebaVersion: string;
    artifact: AuditArtifact;
    report: AuditReport;
    automatedFindings: EvidenceFinding[];
}
export declare function sha256(value: unknown): string;
/** Stable identity for the executable accessibility policy, not a prose label. */
export declare function policyFingerprint(): string;
export declare function createAuditEvidence(report: AuditReport, run: AxeRunResult, artifact: AuditArtifact): AuditEvidenceRecord;
export declare function evidenceDirectory(root?: string): string;
export declare function persistAuditEvidence(record: AuditEvidenceRecord, root?: string): string;
export declare function loadAuditEvidence(reference: string, root?: string): AuditEvidenceRecord;
