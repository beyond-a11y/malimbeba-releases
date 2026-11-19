/**
 * The component manifest is the library's memory. Every other tool in this
 * server is stateless and evaluates one artifact; the manifest is what turns
 * those point-in-time verdicts into a library you can report on and govern.
 *
 * It is repo state: commit it. The default path is resolved against the
 * process working directory (the user's workspace), overridable with
 * A11Y_MANIFEST_PATH.
 */
export type ComponentStatus = "pass" | "blocked" | "unknown";
export interface ComponentApi {
    /** Public props/attributes, with the value set where it is enumerated. */
    props?: Array<{
        name: string;
        type?: string;
        values?: string[];
    }>;
    /** Public event names as consumers bind them. */
    events?: string[];
    /** Named slots / content projection points. */
    slots?: string[];
    /** Design tokens the component consumes. */
    tokens?: string[];
    /** Raw CSS values used where a token was expected (hex, px, rgb...). */
    rawValues?: string[];
    /** Exposed style parts (::part) or equivalent styling hooks. */
    parts?: string[];
}
export interface ComponentException {
    id: string;
    reason: string;
    owner: string;
    /** ISO date the exception was opened. */
    opened: string;
    /** ISO date the exception lapses. Required — no open-ended waivers. */
    expires: string;
    approved: boolean;
}
export interface ComponentEvidence {
    auditEvidence?: {
        auditId: string;
        evidenceRef: string;
        reportDigest: string;
        policyVersion: string;
    };
    attestations?: Array<{
        gateId: string;
        reviewer: string;
        reviewedAt: string;
        auditId: string;
        notes?: string;
    }>;
    interactionTests?: boolean;
    ariaAssertions?: boolean;
    keyboardDocs?: boolean;
    supportMatrix?: boolean;
    knownLimitations?: boolean;
}
export interface ComponentRecord {
    name: string;
    /** APG pattern this component implements, if any (dialog, tabs, combobox...). */
    pattern?: string;
    tier?: number;
    status: ComponentStatus;
    verdictAt?: string;
    criticalDefects?: number;
    provenance?: {
        kind: string;
        ref: string | null;
    };
    api?: ComponentApi;
    evidence?: ComponentEvidence;
    exceptions?: ComponentException[];
    notes?: string;
}
export interface Manifest {
    version: 1;
    library?: string;
    updatedAt: string;
    components: Record<string, ComponentRecord>;
}
export declare function manifestPath(explicit?: string): string;
export declare function emptyManifest(library?: string): Manifest;
export declare function loadManifest(path?: string): Manifest;
export declare function saveManifest(m: Manifest, path?: string): string;
/** Merge an update into a component record, preserving unspecified fields. */
export declare function upsertComponent(m: Manifest, rec: Partial<ComponentRecord> & {
    name: string;
}): ComponentRecord;
export type ExceptionState = "active" | "expiring" | "expired" | "unapproved";
export declare function exceptionState(e: ComponentException, now?: Date): ExceptionState;
export interface LibrarySummary {
    library: string | null;
    total: number;
    byStatus: Record<ComponentStatus, number>;
    byTier: Record<string, number>;
    releasable: boolean;
    blockers: string[];
    expiredExceptions: Array<{
        component: string;
        id: string;
        owner: string;
        expired: string;
    }>;
    expiringExceptions: Array<{
        component: string;
        id: string;
        owner: string;
        expires: string;
    }>;
    unapprovedExceptions: Array<{
        component: string;
        id: string;
    }>;
    missingEvidence: Array<{
        component: string;
        missing: string[];
    }>;
    untiered: string[];
    /** Stored status is "pass" but live re-verification of its audit evidence failed just now. */
    unverifiedPasses: Array<{
        component: string;
        reason: string;
    }>;
}
/** Roll the manifest up into a library-level status view. */
export declare function summarize(m: Manifest, now?: Date, root?: string): LibrarySummary;
