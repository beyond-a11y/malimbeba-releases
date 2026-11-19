import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { EVIDENCE_SCHEMA_VERSION, POLICY_VERSION, SERVER_VERSION } from "../constants.js";
import { ENFORCEMENT_PRINCIPLES, NON_NEGOTIABLES, PROVENANCE_TIERS, REQUIRED_GATES, RISK_TIERS } from "../policy/policy.js";
function canonical(value) {
    if (value === null || typeof value !== "object")
        return JSON.stringify(value);
    if (Array.isArray(value))
        return `[${value.map(canonical).join(",")}]`;
    const object = value;
    return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonical(object[key])}`).join(",")}}`;
}
export function sha256(value) {
    return createHash("sha256").update(canonical(value)).digest("hex");
}
/** Stable identity for the executable accessibility policy, not a prose label. */
export function policyFingerprint() {
    return sha256({ policyVersion: POLICY_VERSION, enforcement: ENFORCEMENT_PRINCIPLES, nonNegotiables: NON_NEGOTIABLES, gates: REQUIRED_GATES, tiers: RISK_TIERS, provenance: PROVENANCE_TIERS });
}
function findingsFrom(run) {
    const axeFindings = run.violations.map((violation) => ({
        impact: violation.impact,
        ruleId: violation.id,
        title: violation.help,
        detail: violation.nodes.map((node) => node.failureSummary).filter(Boolean).join(" "),
        evidence: violation.nodes.map((node) => node.html),
    }));
    const patternFindings = run.patternGaps.map((gap) => ({
        impact: "moderate",
        ruleId: `pattern-${gap.component.replace(/\s+/g, "-")}`,
        title: `${gap.component} pattern contract gap`,
        detail: gap.missing.join(", "),
        evidence: [gap.selector],
    }));
    return [...axeFindings, ...patternFindings];
}
export function createAuditEvidence(report, run, artifact) {
    const payload = {
        schemaVersion: EVIDENCE_SCHEMA_VERSION,
        policy: { version: POLICY_VERSION, fingerprint: policyFingerprint() },
        malimbebaVersion: SERVER_VERSION,
        artifact,
        report,
        automatedFindings: findingsFrom(run),
    };
    const digest = sha256(payload);
    return { ...payload, auditId: digest, reportDigest: digest, recordedAt: new Date().toISOString() };
}
export function evidenceDirectory(root = process.cwd()) {
    return resolve(root, ".malimbeba", "evidence");
}
export function persistAuditEvidence(record, root = process.cwd()) {
    const directory = evidenceDirectory(root);
    const path = resolve(directory, `${record.auditId}.json`);
    mkdirSync(dirname(path), { recursive: true });
    if (!existsSync(path))
        writeFileSync(path, JSON.stringify(record, null, 2) + "\n", "utf8");
    return path;
}
export function loadAuditEvidence(reference, root = process.cwd()) {
    const directory = evidenceDirectory(root);
    const path = resolve(root, reference);
    const relation = relative(directory, path);
    if (relation.startsWith("..") || relation === "")
        throw new Error("Evidence reference must be stored under .malimbeba/evidence.");
    const record = JSON.parse(readFileSync(path, "utf8"));
    const payload = {
        schemaVersion: record.schemaVersion,
        policy: record.policy,
        malimbebaVersion: record.malimbebaVersion,
        artifact: record.artifact,
        report: record.report,
        automatedFindings: record.automatedFindings,
    };
    if (record.schemaVersion !== EVIDENCE_SCHEMA_VERSION || record.auditId !== sha256(payload) || record.reportDigest !== record.auditId) {
        throw new Error("Evidence integrity check failed.");
    }
    return record;
}
