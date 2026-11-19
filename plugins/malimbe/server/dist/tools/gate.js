import { z } from "zod";
import { evaluateGate } from "../engine/gate.js";
import { gateToMarkdown } from "../format.js";
import { REQUIRED_GATES, RISK_TIERS } from "../policy/policy.js";
const InputSchema = z
    .object({
    component: z
        .string()
        .optional()
        .describe(`Component name to resolve its risk tier. Known: ${RISK_TIERS.map((t) => `T${t.tier}[${t.components.join("/")}]`).join(" ")}.`),
    tier: z
        .number()
        .int()
        .min(1)
        .max(3)
        .optional()
        .describe("Explicit risk tier (1-3) when the component name is not recognized."),
    evidence_ref: z
        .string()
        .optional()
        .describe("Evidence artifact returned by a browser audit, stored under .malimbeba/evidence/. The gate validates its SHA-256 digest before use."),
    attestations: z
        .array(z.object({ gate_id: z.string(), reviewer: z.string().min(1), reviewed_at: z.string(), audit_id: z.string(), evidence_ref: z.string().optional(), notes: z.string().optional() }))
        .default([])
        .describe(`Reviewer-attributed attestations tied to the audit ID. Gate ids: ${REQUIRED_GATES.map((g) => g.id).join(", ")}.`),
    min_impact: z
        .enum(["critical", "serious", "moderate", "minor"])
        .default("moderate")
        .describe("Blocking threshold (default 'moderate'). Critical defects always block regardless."),
    response_format: z.enum(["markdown", "json"]).default("markdown"),
})
    .strict();
export function registerGateTool(server) {
    server.registerTool("a11y_release_gate", {
        title: "Evaluate the enterprise accessibility release gate",
        description: `Evaluate a component against the seven Required Gates and return a PASS / BLOCKED verdict. Release proceeds only when ALL gates pass AND no critical defects remain.

Gates: Definition of Done, Automated accessibility (hash-verified browser audit clean), Interaction test, Manual accessibility review, Responsive accessibility, Cognitive review, Enterprise review. Automated and hybrid gates are computed from immutable browser-audit evidence; manual and hybrid gates require reviewer-attributed attestations bound to that evidence's audit ID.

Risk tier (from the component name) is informational. It does not change the verdict or which gates apply. It tells reviewers how much rigor the component warrants — T1 primitives, T2 composites, T3 high-risk composites.

PROVENANCE: the evidence record identifies WHICH artifact was audited. Automated gates only pass for a verifiable artifact (deployed / package / ci-build) with an identifier. Pasted snippets and undeclared provenance cannot satisfy the automated gate — a sandbox render has no build step, dependencies, design tokens, or page context.

This is the enforcement point: wire the verdict into CI (fail the build on BLOCKED).

Args:
  - component (string, optional): resolves the risk tier.
  - tier (1-3, optional): explicit tier when the component is unknown.
  - evidence_ref: immutable browser-audit artifact returned by a11y_audit_axe or a11y_audit_demo.
  - attestations: reviewer-attributed manual/hybrid gate records tied to the audit ID.
  - min_impact: blocking threshold (default 'moderate'); critical always blocks.

Returns (json): { verdict, tier, tierName, automatedEvaluated, provenance: { kind, rank, name, ref, satisfiesAutomatedGate, caveat }, criticalDefects, gates: [{ id, name, evidence, status, reason, findings? }], unmet, warnings }.`,
        inputSchema: InputSchema.shape,
        annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false,
        },
    }, async (args) => {
        const parsed = InputSchema.parse(args);
        const result = evaluateGate({
            evidenceRef: parsed.evidence_ref,
            component: parsed.component,
            tier: parsed.tier,
            attestations: parsed.attestations.map((attestation) => ({ gateId: attestation.gate_id, reviewer: attestation.reviewer, reviewedAt: attestation.reviewed_at, auditId: attestation.audit_id, evidenceRef: attestation.evidence_ref, notes: attestation.notes })),
            minImpact: parsed.min_impact,
        });
        const structured = result;
        if (parsed.response_format === "json") {
            return {
                content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
                structuredContent: structured,
            };
        }
        return {
            content: [{ type: "text", text: gateToMarkdown(result) }],
            structuredContent: structured,
        };
    });
}
