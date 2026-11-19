import { z } from "zod";
import { loadManifest, saveManifest, summarize, upsertComponent, } from "../policy/manifest.js";
import { checkConsistency } from "../engine/consistency.js";
import { loadAuditEvidence } from "../engine/evidence.js";
import { clamp } from "../format.js";
const ApiSchema = z
    .object({
    props: z.array(z.object({ name: z.string(), type: z.string().optional(), values: z.array(z.string()).optional() })).optional(),
    events: z.array(z.string()).optional(),
    slots: z.array(z.string()).optional(),
    tokens: z.array(z.string()).optional(),
    rawValues: z.array(z.string()).optional(),
    parts: z.array(z.string()).optional(),
})
    .optional();
const RecordSchema = z
    .object({
    name: z.string().min(1).describe("Component name, unique within the library."),
    pattern: z.string().optional().describe("APG pattern implemented (dialog, tabs, combobox...)."),
    tier: z.number().int().min(1).max(3).optional().describe("Risk tier: 1 primitive, 2 composite, 3 high-risk composite."),
    status: z.enum(["pass", "blocked", "unknown"]).default("unknown").describe("Latest release-gate verdict."),
    critical_defects: z.number().int().min(0).optional(),
    provenance_kind: z.enum(["deployed", "package", "ci-build", "pasted", "unspecified"]).optional(),
    provenance_ref: z.string().optional(),
    api: ApiSchema.describe("Public API surface — used by the consistency checker."),
    evidence: z
        .object({
        auditEvidence: z.object({ auditId: z.string(), evidenceRef: z.string(), reportDigest: z.string(), policyVersion: z.string() }).optional(),
        attestations: z.array(z.object({ gateId: z.string(), reviewer: z.string(), reviewedAt: z.string(), auditId: z.string(), notes: z.string().optional() })).optional(),
        interactionTests: z.boolean().optional(),
        ariaAssertions: z.boolean().optional(),
        keyboardDocs: z.boolean().optional(),
        supportMatrix: z.boolean().optional(),
        knownLimitations: z.boolean().optional(),
    })
        .optional(),
    exceptions: z
        .array(z.object({
        id: z.string(),
        reason: z.string(),
        owner: z.string(),
        opened: z.string(),
        expires: z.string().describe("ISO date. Required — no open-ended waivers."),
        approved: z.boolean().default(false),
    }))
        .optional(),
    notes: z.string().optional(),
    manifest_path: z.string().optional().describe("Override the manifest location (default ./a11y-manifest.json or A11Y_MANIFEST_PATH)."),
    library: z.string().optional().describe("Library name, recorded on first write."),
})
    .strict();
export function registerManifestTools(server) {
    server.registerTool("a11y_manifest_record", {
        title: "Record a component in the library manifest",
        description: `Persist a component's accessibility state to the library manifest — tier, latest gate verdict, provenance, immutable audit evidence, reviewer attestations, public API surface, and any exceptions. The manifest is repo state: commit it.

This is what turns per-component verdicts into a governable library. Call it after a11y_release_gate so the verdict is retained, and record the API surface so a11y_consistency_check can compare components against each other.

Exceptions REQUIRE an owner and an expiry date; expiry is then enforced by a11y_library_status.

Returns (json): { path, component, total }.`,
        inputSchema: RecordSchema.shape,
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    }, async (args) => {
        const a = RecordSchema.parse(args);
        const m = loadManifest(a.manifest_path);
        if (a.library)
            m.library = a.library;
        // A "pass" claim must be re-verifiable from the manifest alone — the same
        // check a11y_release_gate already applies to evidenceRef, re-run here so a
        // deleted/expired evidence artifact or a fabricated claim can't sit in the
        // manifest as an unverified pass. Downgrade, don't reject: the component
        // record itself is still worth keeping.
        let status = a.status;
        let evidenceWarning;
        if (status === "pass") {
            const claimed = a.evidence?.auditEvidence;
            if (!claimed) {
                status = "unknown";
                evidenceWarning = `a "pass" status requires evidence.auditEvidence (the record a11y_release_gate verifies) so it can be re-checked; none was supplied.`;
            }
            else {
                try {
                    const verified = loadAuditEvidence(claimed.evidenceRef);
                    if (verified.auditId !== claimed.auditId || verified.reportDigest !== claimed.reportDigest) {
                        status = "unknown";
                        evidenceWarning = `the claimed audit evidence (auditId/reportDigest) does not match the verified artifact at "${claimed.evidenceRef}".`;
                    }
                }
                catch (error) {
                    status = "unknown";
                    evidenceWarning = `evidence re-verification failed for "${claimed.evidenceRef}" — ${error.message}`;
                }
            }
        }
        const rec = {
            name: a.name,
            status,
            verdictAt: new Date().toISOString(),
            ...(a.pattern ? { pattern: a.pattern } : {}),
            ...(a.tier ? { tier: a.tier } : {}),
            ...(a.critical_defects !== undefined ? { criticalDefects: a.critical_defects } : {}),
            ...(a.provenance_kind ? { provenance: { kind: a.provenance_kind, ref: a.provenance_ref ?? null } } : {}),
            ...(a.api ? { api: a.api } : {}),
            ...(a.evidence ? { evidence: a.evidence } : {}),
            ...(a.exceptions ? { exceptions: a.exceptions } : {}),
            ...(a.notes ? { notes: a.notes } : {}),
        };
        upsertComponent(m, rec);
        const path = saveManifest(m, a.manifest_path);
        const payload = {
            path,
            component: a.name,
            total: Object.keys(m.components).length,
            ...(evidenceWarning ? { statusDowngraded: true } : {}),
        };
        const warningText = evidenceWarning
            ? `\n\n⚠️ Recorded status downgraded from "pass" to "unknown": ${evidenceWarning}`
            : "";
        return {
            content: [{ type: "text", text: `Recorded **${a.name}** in ${path} (${payload.total} component(s) tracked).${warningText}` }],
            structuredContent: payload,
        };
    });
    const StatusSchema = z
        .object({
        manifest_path: z.string().optional(),
        response_format: z.enum(["markdown", "json"]).default("markdown"),
    })
        .strict();
    server.registerTool("a11y_library_status", {
        title: "Library-wide accessibility status",
        description: `Roll the component manifest up into a library-level view: how many components pass, are blocked, or are unassessed; distribution by risk tier; missing evidence (tests, ARIA assertions, keyboard docs, support matrix, known limitations); and exception health.

Enforces exception expiry — expired or unapproved exceptions become release blockers, which a stateless gate cannot do.

Also re-verifies every stored "pass" against its own recorded evidence on every call — not just once at the a11y_manifest_record write that set it. A pass can go stale after the fact (its evidence artifact deleted or expired) or may predate this check; either way it is treated as a blocker here, not trusted silently. This is a live check, not a mutation: it does not rewrite the manifest file, so call a11y_manifest_record again to persist the correction on disk.

Returns (json): { library, total, byStatus, byTier, releasable, blockers, expiredExceptions, expiringExceptions, unapprovedExceptions, missingEvidence, untiered, unverifiedPasses }.`,
        inputSchema: StatusSchema.shape,
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    }, async (args) => {
        const a = StatusSchema.parse(args);
        const m = loadManifest(a.manifest_path);
        const s = summarize(m);
        const structured = s;
        if (a.response_format === "json") {
            return { content: [{ type: "text", text: JSON.stringify(s, null, 2) }], structuredContent: structured };
        }
        const head = `# Library status${s.library ? ` — ${s.library}` : ""}\n\n` +
            `**${s.total}** component(s): ${s.byStatus.pass} passing · ${s.byStatus.blocked} blocked · ${s.byStatus.unknown} unassessed\n` +
            `Tiers: ${Object.entries(s.byTier).map(([k, v]) => `${k} ${v}`).join(" · ") || "none assigned"}\n\n` +
            (s.releasable ? `## ✅ Library is releasable\n` : `## ⛔ Library is NOT releasable — ${s.blockers.length} blocker(s)\n`) +
            (s.blockers.length ? s.blockers.map((b) => `- ${b}`).join("\n") + "\n" : "");
        const exc = (s.expiringExceptions.length
            ? `\n## Exceptions expiring within 30 days\n` + s.expiringExceptions.map((e) => `- ${e.component} · ${e.id} · owner ${e.owner} · expires ${e.expires}`).join("\n") + "\n"
            : "") +
            (s.unapprovedExceptions.length
                ? `\n## Unapproved exceptions\n` + s.unapprovedExceptions.map((e) => `- ${e.component} · ${e.id}`).join("\n") + "\n"
                : "");
        const ev = s.missingEvidence.length
            ? `\n## Missing evidence\n` + s.missingEvidence.map((x) => `- **${x.component}** — ${x.missing.join(", ")}`).join("\n") + "\n"
            : "";
        const un = s.untiered.length ? `\n## Untiered components\n${s.untiered.join(", ")}\n` : "";
        const uv = s.unverifiedPasses.length
            ? `\n## Stale or unverifiable pass claims\n` + s.unverifiedPasses.map((x) => `- **${x.component}** — ${x.reason}`).join("\n") + "\n"
            : "";
        return { content: [{ type: "text", text: clamp(head + exc + ev + un + uv) }], structuredContent: structured };
    });
    const ConsistencySchema = z
        .object({
        manifest_path: z.string().optional(),
        response_format: z.enum(["markdown", "json"]).default("markdown"),
    })
        .strict();
    server.registerTool("a11y_consistency_check", {
        title: "Check cross-component consistency",
        description: `Compare every component in the manifest against every other and report where the library diverges from itself: prop naming for the same concept, enumerated value scales, event-naming conventions, hard-coded values bypassing design tokens, token namespaces, focus styling hooks, disabled semantics, duplicate implementations of the same APG pattern, untiered components, and slot naming.

This is the design-system check that per-component audits cannot perform. A library of individually-compliant components that each behave differently still fails users, because the accessibility payoff of a design system is that a pattern learned once transfers everywhere.

Requires component API surfaces to be recorded via a11y_manifest_record.

Returns (json): { componentsChecked, consistent, bySeverity, findings: [{ ruleId, title, severity, detail, components, fix }] }.`,
        inputSchema: ConsistencySchema.shape,
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    }, async (args) => {
        const a = ConsistencySchema.parse(args);
        const m = loadManifest(a.manifest_path);
        const r = checkConsistency(m);
        const structured = r;
        if (a.response_format === "json") {
            return { content: [{ type: "text", text: JSON.stringify(r, null, 2) }], structuredContent: structured };
        }
        const head = r.consistent
            ? `# Consistency check — ✅ consistent\n\n${r.componentsChecked} component(s) compared; no divergence found.`
            : `# Consistency check — ${r.findings.length} divergence(s)\n\n${r.componentsChecked} component(s) compared · ` +
                `${r.bySeverity.high} high · ${r.bySeverity.medium} medium · ${r.bySeverity.low} low`;
        const body = r.findings
            .map((f) => `\n\n### [${f.severity}] ${f.title}\n\`${f.ruleId}\` · affects: ${f.components.join(", ")}\n\n${f.detail}\n\n**Fix:** ${f.fix}`)
            .join("");
        return { content: [{ type: "text", text: clamp(head + body) }], structuredContent: structured };
    });
}
