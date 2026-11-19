/**
 * Platform and stack signatures, as data. The engine in stack.ts is generic:
 * adding a platform means adding an entry here, not changing the engine.
 *
 * Confidence comes from the strongest matcher that fired (see stack.ts):
 *   high   = a generator tag, a product-specific header, a product-only global
 *            or version constant, or a file path only that product serves
 *   medium = a script/stylesheet name, a DOM marker class, a cookie name
 *   low    = a generic hint shared with other products
 *
 * Lifecycle data is static, dated (`asOf`) and sourced. It is never fetched
 * at runtime.
 */
export type StackCategory = "platform" | "framework" | "ui-library" | "widget" | "overlay" | "document-accessibility" | "analytics" | "monitoring" | "feedback" | "media";
export type FixLayer = "native" | "template" | "custom-component" | "vendor";
export type Strength = "high" | "medium" | "low";
export interface Lifecycle {
    status: string;
    date?: string;
    asOf: string;
    source: string;
}
export type Matcher = {
    kind: "generator";
    pattern: RegExp;
    strength?: Strength;
} | {
    kind: "meta";
    name: RegExp;
    content?: RegExp;
    strength?: Strength;
} | {
    kind: "header";
    name: string;
    value?: RegExp;
    strength?: Strength;
} | {
    kind: "script";
    pattern: RegExp;
    strength?: Strength;
} | {
    kind: "stylesheet";
    pattern: RegExp;
    strength?: Strength;
} | {
    kind: "inline";
    pattern: RegExp;
    strength?: Strength;
} | {
    kind: "global";
    name: string;
    strength?: Strength;
} | {
    kind: "probe";
    key: string;
    strength?: Strength;
} | {
    kind: "selector";
    selector: string;
    strength?: Strength;
} | {
    kind: "cookie";
    pattern: RegExp;
    strength?: Strength;
} | {
    kind: "host";
    pattern: RegExp;
    strength?: Strength;
};
export type VersionSource = {
    from: "probe";
    key: string;
    pattern?: RegExp;
} | {
    from: "header";
    name: string;
    pattern?: RegExp;
} | {
    from: "generator";
    pattern: RegExp;
} | {
    from: "script";
    pattern: RegExp;
} | {
    from: "stylesheet";
    pattern: RegExp;
} | {
    from: "attr";
    selector: string;
    attr: string;
};
export interface Signature {
    id: string;
    name: string;
    category: StackCategory;
    match: Matcher[];
    version?: VersionSource[];
    fixLayer?: FixLayer;
    notes?: string[];
    lifecycle?: Lifecycle;
    /** Other detections this one proves (Next.js proves React). */
    implies?: string[];
    /** Selectors that attribute an axe finding to this detection when the
     *  failing element or one of its ancestors matches. Most specific first. */
    attribution?: Array<{
        selector: string;
        label: string;
    }>;
}
/**
 * Version probes evaluated in the page. Each one reads a single primitive
 * version constant or flag; nothing here reads user data, storage or cookies.
 * Keys are referenced by `probe` matchers and version sources below.
 */
export declare const VERSION_PROBES: Record<string, string>;
export declare const SIGNATURES: Signature[];
/** SharePoint on-premises build → product mapping (major.minor.build). */
export declare function sharePointProduct(version: string): {
    name: string;
    id: "2013" | "2016" | "2019" | "se" | "online" | "unknown";
};
export declare const SHAREPOINT_LIFECYCLE: Partial<Record<"2013" | "2016" | "2019", Lifecycle>>;
