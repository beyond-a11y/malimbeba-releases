import type { AuditResult } from "../types.js";
import { type RenderMode } from "./render.js";
import { type StackEvidence, type StackReport } from "./stack.js";
export interface FetchResult {
    url: string;
    finalUrl: string;
    status: number;
    ok: boolean;
    html: string;
    error?: string;
    /** Allowlisted product headers of the final response (see stack.ts). */
    headers?: Record<string, string>;
    /** Set-Cookie header values; callers keep cookie NAMES only. */
    setCookies?: string[];
}
/** Fetch a URL and return its HTML (only for http/https, HTML content types). */
export declare function fetchHtml(url: string, timeoutMs?: number): Promise<FetchResult>;
/** Extract same-origin, http(s), de-duplicated page links from a document. */
export declare function sameOriginLinks(html: string, baseUrl: string): string[];
export interface CrawlPage {
    url: string;
    status: number;
    ok: boolean;
    error?: string;
    renderMode?: RenderMode;
    result?: AuditResult;
    /** Detected stack for this page (same load as its audit). */
    stack?: StackReport;
    /** Where the page actually landed, when a redirect moved it. */
    finalUrl?: string;
}
export type RenderPreference = "auto" | "browser" | "static";
/**
 * Obtain a page's markup, optionally via a headless browser so that
 * JS-rendered content and shadow DOM are visible.
 * Always reports which mode actually produced the markup.
 */
export declare function obtainHtml(url: string, render: RenderPreference): Promise<{
    html: string;
    mode: RenderMode;
    status: number;
    ok: boolean;
    finalUrl: string;
    error?: string;
    runtime: import("../types.js").Finding[];
    degradedReason?: string;
    stackEvidence?: StackEvidence;
}>;
/**
 * Breadth-first crawl of same-origin pages starting at startUrl, auditing each.
 * @param maxPages Requested page cap (clamped to 1..20).
 */
export declare function crawlAudit(startUrl: string, maxPages: number, ruleIds?: string[], render?: RenderPreference): Promise<CrawlPage[]>;
