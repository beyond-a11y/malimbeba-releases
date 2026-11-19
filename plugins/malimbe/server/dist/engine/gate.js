import { loadAuditEvidence } from "./evidence.js";
import { PROVENANCE_INDEX, REQUIRED_GATES, RISK_TIERS, resolveTier, } from "../policy/policy.js";
const IMPACT_ORDER = {
    critical: 0,
    serious: 1,
    moderate: 2,
    minor: 3,
};
export function evaluateGate(input) {
    const minImpact = input.minImpact ?? "moderate";
    const threshold = IMPACT_ORDER[minImpact];
    let evidence = input.evidence;
    let evidenceError;
    if (!evidence && input.evidenceRef) {
        try {
            evidence = loadAuditEvidence(input.evidenceRef);
        }
        catch (error) {
            evidenceError = error.message;
        }
    }
    const validAttestations = input.attestations.filter((attestation) => !!evidence && attestation.auditId === evidence.auditId && attestation.reviewer.trim().length > 0 && !Number.isNaN(Date.parse(attestation.reviewedAt)));
    // Resolve tier from component name, falling back to an explicit override.
    let tier = null;
    let tierName = null;
    const warnings = [];
    if (input.component) {
        const resolved = resolveTier(input.component);
        if (resolved) {
            tier = resolved.tier;
            tierName = resolved.name;
        }
        else {
            const names = RISK_TIERS.flatMap((t) => t.components);
            const normalize = (value) => value.toLowerCase().replace(/[\s_-]+/g, "");
            const suggestion = names.find((name) => normalize(name) === normalize(input.component));
            const hint = suggestion
                ? `Did you mean "${suggestion}"?`
                : `Recognized names: ${names.join(", ")}.`;
            warnings.push(`Component "${input.component}" is not a recognized risk-tier name, so its tier was not resolved from it. This is most likely a misspelling. ${hint}`);
        }
    }
    if (tier === null && typeof input.tier === "number") {
        tier = input.tier;
        tierName = `Tier ${input.tier}`;
    }
    if (!input.component && tier === null) {
        warnings.push("No component name or explicit tier was supplied, so the risk tier is unresolved.");
    }
    // Resolve provenance — what artifact this verdict is actually about.
    const pKind = evidence?.artifact.kind ?? "unspecified";
    const pTier = PROVENANCE_INDEX.get(pKind) ?? PROVENANCE_INDEX.get("unspecified");
    const pRef = evidence?.artifact.ref ?? null;
    // A verifiable tier must carry an identifier; without one the claim is unbacked.
    const provenanceUsable = pTier.satisfiesAutomatedGate && pRef !== null;
    const provenance = {
        kind: pTier.kind,
        rank: pTier.rank,
        name: pTier.name,
        ref: pRef,
        satisfiesAutomatedGate: provenanceUsable,
        caveat: pTier.satisfiesAutomatedGate && pRef === null
            ? `${pTier.name} declared without an identifier (${pTier.requires}), so the audit cannot be tied to a specific artifact.`
            : pTier.caveat,
    };
    const automatedEvaluated = !!evidence;
    const allFindings = evidence?.automatedFindings ?? [];
    const criticalDefects = allFindings.filter((f) => f.impact === "critical");
    const blocking = allFindings.filter((f) => IMPACT_ORDER[f.impact] <= threshold);
    const gates = REQUIRED_GATES.map((gate) => {
        const needsAuto = gate.evidence === "automated" || gate.evidence === "hybrid";
        const needsAttest = gate.evidence === "attested" || gate.evidence === "hybrid";
        let autoPass = true;
        let autoFindings = [];
        let provenanceBlocked = false;
        if (needsAuto) {
            if (!automatedEvaluated) {
                autoPass = false;
            }
            else if (!provenanceUsable) {
                // Clean markup is not evidence unless it came from a verifiable artifact.
                autoPass = false;
                provenanceBlocked = true;
            }
            else if (gate.id === "automated-accessibility") {
                // Whole-audit gate: must be clean at/above threshold.
                autoFindings = blocking;
                autoPass = blocking.length === 0;
            }
            else if (gate.ruleIds.length) {
                autoFindings = blocking.filter((f) => gate.ruleIds.includes(f.ruleId));
                autoPass = autoFindings.length === 0;
            }
        }
        const gateAttestations = validAttestations.filter((attestation) => attestation.gateId.trim() === gate.id);
        const attestPass = needsAttest ? gateAttestations.length > 0 : true;
        const pass = autoPass && attestPass;
        const reasons = [];
        if (needsAuto && !automatedEvaluated)
            reasons.push(evidenceError ?? "verified browser audit evidence not provided");
        else if (provenanceBlocked)
            reasons.push(`insufficient provenance (${provenance.name}) — ${provenance.caveat}`);
        else if (autoFindings.length)
            reasons.push(`${autoFindings.length} automated violation(s)`);
        if (needsAttest && !attestPass)
            reasons.push("attestation not recorded");
        return {
            id: gate.id,
            name: gate.name,
            evidence: gate.evidence,
            status: pass ? "pass" : "fail",
            reason: pass ? "satisfied" : reasons.join("; "),
            ...(autoFindings.length ? { findings: autoFindings } : {}),
            ...(gateAttestations.length ? { reviewers: gateAttestations.map((attestation) => attestation.reviewer) } : {}),
        };
    });
    const unmet = gates.filter((g) => g.status === "fail").map((g) => g.id);
    // Success criteria: all gates pass AND no critical defects remain.
    const verdict = unmet.length === 0 && criticalDefects.length === 0 ? "PASS" : "BLOCKED";
    return {
        verdict,
        tier,
        tierName,
        automatedEvaluated,
        evidence: { auditId: evidence?.auditId ?? null, evidenceRef: input.evidenceRef ?? null, policyVersion: evidence?.policy.version ?? null, reportDigest: evidence?.reportDigest ?? null },
        provenance,
        criticalDefects,
        gates,
        unmet,
        warnings,
    };
}
