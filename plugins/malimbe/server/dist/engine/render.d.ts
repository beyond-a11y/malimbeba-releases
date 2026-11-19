import type { Finding } from "../types.js";
import { type StackEvidence } from "./stack.js";
export type RenderMode = "browser" | "static";
export interface RenderResult {
    mode: RenderMode;
    /** Flattened HTML: shadow roots inlined so the ruleset can see web components. */
    html: string;
    /** Findings only obtainable from a live render (computed styles, geometry). */
    runtimeFindings: Finding[];
    /** Why the browser was not used, when mode === "static". */
    degradedReason?: string;
    /** Platform/stack evidence from the same page load (browser mode only). */
    stackEvidence?: StackEvidence;
    /** HTTP status of the main document (browser mode). */
    status?: number;
    /** Where the browser actually landed after redirects (browser mode). */
    finalUrl?: string;
}
/** True when the browser ended up on a different site than requested (www. ignored). */
export declare function offSiteHost(requested: string, landed: string | undefined): string | null;
/** Reject if a promise doesn't settle in time, so no browser step hangs unbounded. */
export declare function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T>;
export declare function closeBrowser(): Promise<void>;
/**
 * Render a URL in a headless browser and return its flattened DOM.
 * Resolves with mode "static" and a reason when no browser is available —
 * the caller must report which mode produced the result.
 */
export declare function renderPage(url: string, timeoutMs?: number): Promise<RenderResult | null>;
export interface RawPage {
    ok: boolean;
    page: any | null;
    error?: string;
    /** Headers of the main document response, when the navigation produced one. */
    responseHeaders?: Record<string, string> | null;
    /** HTTP status of the main document (200 when the navigation produced no response). */
    status?: number;
    /** Where the browser actually landed after redirects. */
    finalUrl?: string;
    close: () => Promise<void>;
}
/**
 * Open a live Playwright page for callers that need to execute in-page code
 * (e.g. injecting axe-core). The caller MUST call close().
 */
export declare function renderPageRaw(url: string, timeoutMs?: number, opts?: {
    settle?: boolean;
}): Promise<RawPage>;
