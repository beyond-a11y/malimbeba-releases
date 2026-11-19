import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { loadAuditEvidence } from "../engine/evidence.js";
export function manifestPath(explicit) {
    return resolve(explicit ?? process.env["A11Y_MANIFEST_PATH"] ?? "./a11y-manifest.json");
}
export function emptyManifest(library) {
    return {
        version: 1,
        ...(library ? { library } : {}),
        updatedAt: new Date().toISOString(),
        components: {},
    };
}
export function loadManifest(path) {
    const p = manifestPath(path);
    if (!existsSync(p))
        return emptyManifest();
    try {
        const parsed = JSON.parse(readFileSync(p, "utf8"));
        if (!parsed || typeof parsed !== "object" || !parsed.components)
            return emptyManifest();
        return parsed;
    }
    catch {
        return emptyManifest();
    }
}
export function saveManifest(m, path) {
    const p = manifestPath(path);
    mkdirSync(dirname(p), { recursive: true });
    m.updatedAt = new Date().toISOString();
    writeFileSync(p, JSON.stringify(m, null, 2) + "\n", "utf8");
    return p;
}
/** Merge an update into a component record, preserving unspecified fields. */
export function upsertComponent(m, rec) {
    const existing = m.components[rec.name];
    const merged = {
        ...(existing ?? { name: rec.name, status: "unknown" }),
        ...rec,
        api: { ...(existing?.api ?? {}), ...(rec.api ?? {}) },
        evidence: { ...(existing?.evidence ?? {}), ...(rec.evidence ?? {}) },
        exceptions: rec.exceptions ?? existing?.exceptions ?? [],
    };
    m.components[rec.name] = merged;
    return merged;
}
export function exceptionState(e, now = new Date()) {
    if (!e.approved)
        return "unapproved";
    const exp = new Date(e.expires);
    if (Number.isNaN(exp.getTime()))
        return "expired";
    if (exp.getTime() < now.getTime())
        return "expired";
    const days = (exp.getTime() - now.getTime()) / 86_400_000;
    return days <= 30 ? "expiring" : "active";
}
const EVIDENCE_LABELS = {
    auditEvidence: "immutable browser audit evidence",
    attestations: "reviewer attestations",
    interactionTests: "interaction tests",
    ariaAssertions: "ARIA state assertions",
    keyboardDocs: "keyboard/focus docs",
    supportMatrix: "support matrix",
    knownLimitations: "known limitations",
};
/**
 * Re-check a stored "pass" against its own recorded evidence, the same way
 * a11y_manifest_record does at write time. A manifest is long-lived repo
 * state — a pass claim can go stale after the write that recorded it (the
 * evidence artifact is deleted/expires, or the entry predates this check
 * entirely) — so a stored "pass" is re-verified every time the library is
 * summarized, not just once at write time. Returns null when it still
 * verifies, or the reason it no longer does.
 */
function unverifiedPassReason(c, root) {
    const claimed = c.evidence?.auditEvidence;
    if (!claimed)
        return `recorded as pass with no evidence.auditEvidence to re-verify`;
    try {
        const verified = loadAuditEvidence(claimed.evidenceRef, root);
        if (verified.auditId !== claimed.auditId || verified.reportDigest !== claimed.reportDigest) {
            return `claimed audit evidence (auditId/reportDigest) does not match the verified artifact at "${claimed.evidenceRef}"`;
        }
        return null;
    }
    catch (error) {
        return error.message;
    }
}
/** Roll the manifest up into a library-level status view. */
export function summarize(m, now = new Date(), root = process.cwd()) {
    const byStatus = { pass: 0, blocked: 0, unknown: 0 };
    const byTier = {};
    const expired = [];
    const expiring = [];
    const unapproved = [];
    const missingEvidence = [];
    const untiered = [];
    const blockers = [];
    const unverifiedPasses = [];
    const comps = Object.values(m.components);
    for (const c of comps) {
        byStatus[c.status]++;
        const tierKey = c.tier ? `tier${c.tier}` : "untiered";
        byTier[tierKey] = (byTier[tierKey] ?? 0) + 1;
        if (!c.tier)
            untiered.push(c.name);
        if (c.status === "blocked")
            blockers.push(`${c.name}: gate BLOCKED`);
        if ((c.criticalDefects ?? 0) > 0)
            blockers.push(`${c.name}: ${c.criticalDefects} critical defect(s) open`);
        if (c.status === "pass") {
            const reason = unverifiedPassReason(c, root);
            if (reason) {
                unverifiedPasses.push({ component: c.name, reason });
                blockers.push(`${c.name}: recorded as pass but evidence no longer re-verifies — ${reason}`);
            }
        }
        for (const e of c.exceptions ?? []) {
            const st = exceptionState(e, now);
            if (st === "expired") {
                expired.push({ component: c.name, id: e.id, owner: e.owner, expired: e.expires });
                blockers.push(`${c.name}: exception ${e.id} expired ${e.expires} (owner ${e.owner})`);
            }
            else if (st === "expiring") {
                expiring.push({ component: c.name, id: e.id, owner: e.owner, expires: e.expires });
            }
            else if (st === "unapproved") {
                unapproved.push({ component: c.name, id: e.id });
                blockers.push(`${c.name}: exception ${e.id} is not approved`);
            }
        }
        const miss = [];
        for (const k of Object.keys(EVIDENCE_LABELS)) {
            if (!c.evidence?.[k])
                miss.push(EVIDENCE_LABELS[k]);
        }
        if (miss.length)
            missingEvidence.push({ component: c.name, missing: miss });
    }
    return {
        library: m.library ?? null,
        total: comps.length,
        byStatus,
        byTier,
        releasable: blockers.length === 0 && comps.length > 0,
        blockers,
        expiredExceptions: expired,
        expiringExceptions: expiring,
        unapprovedExceptions: unapproved,
        missingEvidence,
        untiered,
        unverifiedPasses,
    };
}
