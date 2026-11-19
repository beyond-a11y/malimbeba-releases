import type { AuditResult, ComponentGuidance } from "./types.js";
/**
 * `reserve` raises the effective budget above CHARACTER_LIMIT for callers
 * that deliberately embedded a large, already-size-gated blob (e.g. a
 * screenshot data: URI up to MAX_INLINE_IMAGE_DATA_URI_LENGTH) \u2014 without it,
 * clamp's default 20,000-char budget would slice through the base64 partway
 * in, both corrupting the image into a broken data: URI and discarding
 * everything after it (the rest of the prompt). Ordinary text-only callers
 * pass no `reserve` and keep the original behavior exactly.
 */
export declare function clamp(text: string, reserve?: number): string;
import type { CrawlPage } from "./engine/fetch.js";
import type { Impact } from "./types.js";
export declare function urlAuditToMarkdown(url: string, finalUrl: string, result: AuditResult): string;
export interface CrawlAggregate {
    pagesRequested: number;
    pagesVisited: number;
    pagesAudited: number;
    pagesFailed: number;
    totalFindings: number;
    byImpact: Record<Impact, number>;
    pagesWithCritical: string[];
    topRules: Array<{
        ruleId: string;
        title: string;
        count: number;
    }>;
    /** BLOCKED: critical defects found. INCOMPLETE: no criticals among the pages
     *  audited, but some or all pages could not be audited, so the crawl proves
     *  nothing about them. PASS: every visited page was audited, none critical. */
    verdict: "PASS" | "BLOCKED" | "INCOMPLETE";
}
export declare function aggregateCrawl(pages: CrawlPage[], requested: number): CrawlAggregate;
export declare function crawlToMarkdown(startUrl: string, pages: CrawlPage[], agg: CrawlAggregate): string;
export declare function auditToMarkdown(result: AuditResult): string;
import type { GateResult } from "./engine/gate.js";
import type { ChecklistSection } from "./policy/policy.js";
export declare function checklistToMarkdown(sections: ChecklistSection[]): string;
export declare function gateToMarkdown(r: GateResult): string;
export declare function guidanceToMarkdown(g: ComponentGuidance): string;
