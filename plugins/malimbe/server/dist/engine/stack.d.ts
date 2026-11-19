import { type FixLayer, type Lifecycle, type Signature, type StackCategory, type Strength } from "./stackSignatures.js";
/**
 * Platform and stack detection. Every detection is backed by evidence
 * collected in the SAME page load as the audit (never a second navigation),
 * and confidence reflects how specific that evidence is. When nothing
 * matches, the report says so in `unknowns` instead of guessing.
 */
export interface Detection {
    id: string;
    name: string;
    category: StackCategory;
    version?: string;
    confidence: Strength;
    evidence: string[];
    fixLayer?: FixLayer;
    notes?: string[];
    lifecycle?: Lifecycle;
}
export interface StackReport {
    url: string;
    detectedAt: string;
    renderMode: string;
    detections: Detection[];
    unknowns: string[];
}
/** Raw evidence from one page load. Header and cookie VALUES other than the
 *  allowlisted product headers are never collected; cookies are names only. */
export interface StackEvidence {
    url: string;
    renderMode: "browser" | "static";
    headers: Record<string, string>;
    cookieNames: string[];
    metas: Array<{
        name: string;
        content: string;
    }>;
    scripts: string[];
    stylesheets: string[];
    inlineScripts: string[];
    globals: string[];
    probes: Record<string, string | number | boolean>;
    markers: Record<string, number>;
    attrs: Record<string, string>;
    overlayTriggers: Array<{
        tag: string;
        width: number;
        height: number;
    }>;
}
export interface FindingOrigin {
    detectionId: string;
    reason: string;
}
/** Product headers whose values are read. Everything else is ignored. */
export declare const HEADER_ALLOWLIST: string[];
export declare function emptyEvidence(url: string, renderMode: "browser" | "static"): StackEvidence;
export declare function pickHeaders(all: Record<string, string> | Headers | undefined | null): Record<string, string>;
export declare function cookieNamesFromSetCookie(values: string[]): string[];
/**
 * In-page collector. Runs in the audited page in the same load the audit
 * uses. It reads tag attributes, typeof for an allowlist of globals, a fixed
 * set of version constants, and marker counts. It never reads cookie values,
 * storage or form data.
 */
export declare function buildCollectorScript(): string;
/** Collect evidence from a live Playwright page plus its main response. */
export declare function collectStackEvidence(page: any, url: string, responseHeaders: Record<string, string> | null): Promise<StackEvidence>;
/** Collect evidence from delivered HTML and headers (no browser). */
export declare function staticStackEvidence(html: string, url: string, headers: Record<string, string> | Headers | null, setCookies?: string[]): StackEvidence;
export declare function detectStack(ev: StackEvidence, signatures?: Signature[]): StackReport;
/** Attribution selectors for the detections present on this page only. */
export declare function attributionMarkers(report: StackReport, signatures?: Signature[]): Array<{
    detectionId: string;
    selector: string;
    label: string;
}>;
/**
 * In-page attribution: for each axe target, find the first marker the
 * element or one of its ancestors matches. Unmatched or unresolvable
 * targets get null — never a guess.
 */
export declare const ATTRIBUTE_SCRIPT = "(args) => {\n  const out = [];\n  for (const target of args.targets) {\n    let el = null;\n    try { el = document.querySelector(target); } catch (e) {}\n    if (!el) { out.push(null); continue; }\n    let hit = null;\n    for (const m of args.markers) {\n      let anc = null;\n      try { anc = el.closest(m.selector); } catch (e) { continue; }\n      if (anc) { hit = { detectionId: m.detectionId, reason: (anc === el ? 'element matches ' : 'inside ') + m.label + ' (' + m.selector.split(',')[0].trim() + ')' }; break; }\n    }\n    out.push(hit);\n  }\n  return out;\n}";
export declare function attributeOrigins(page: any, targets: string[], report: StackReport): Promise<Array<FindingOrigin | null>>;
export declare function stackToMarkdown(r: StackReport, heading?: string): string;
export interface CrawlStackSummary {
    /** One report per origin: the first page audited on that origin. */
    origins: Array<{
        origin: string;
        stack: StackReport;
    }>;
    /** Pages whose detected stack differs from their origin's report. */
    differingPages: Array<{
        url: string;
        stack: StackReport;
    }>;
}
/** Crawl roll-up: detect once per origin, plus each path whose stack differs. */
export declare function summarizeCrawlStacks(pages: Array<{
    url: string;
    stack?: StackReport;
}>): CrawlStackSummary;
export declare function crawlStackToMarkdown(s: CrawlStackSummary): string;
