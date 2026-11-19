import { parse } from "node-html-parser";
import he from "he"; // CommonJS: default import only
import { auditHtml } from "./audit.js";
import { offSiteHost, renderPage } from "./render.js";
import { assertUrlAllowed } from "./ssrfGuard.js";
import { detectChallenge, unauditableReason } from "./challenge.js";
import { detectStack, pickHeaders, staticStackEvidence } from "./stack.js";
const HARD_PAGE_CAP = 20;
const MAX_REDIRECTS = 10;
/**
 * fetch() with `redirect: "follow"` never lets the caller see intermediate
 * hops, so a public URL that redirects to a blocked host would sail
 * straight through a single pre-fetch check. This follows redirects
 * manually, validating EVERY hop before it's requested.
 */
async function fetchFollowingRedirects(start, init) {
    let current = start;
    for (let i = 0; i <= MAX_REDIRECTS; i++) {
        assertUrlAllowed(current.href);
        const res = await fetch(current.href, { ...init, redirect: "manual" });
        const isRedirect = res.status >= 300 && res.status < 400 && res.headers.has("location");
        if (!isRedirect)
            return { res, finalUrl: current.href };
        const next = new URL(res.headers.get("location"), current);
        if (next.protocol !== "http:" && next.protocol !== "https:") {
            throw new Error(`Redirected to unsupported protocol: ${next.protocol}`);
        }
        current = next;
    }
    throw new Error("Too many redirects");
}
function stripHash(u) {
    try {
        const x = new URL(u);
        x.hash = "";
        return x.href;
    }
    catch {
        return u;
    }
}
/** Fetch a URL and return its HTML (only for http/https, HTML content types). */
export async function fetchHtml(url, timeoutMs = 10000) {
    let parsed;
    try {
        parsed = new URL(url);
    }
    catch {
        return { url, finalUrl: url, status: 0, ok: false, html: "", error: "Invalid URL" };
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return { url, finalUrl: url, status: 0, ok: false, html: "", error: "Only http/https URLs are supported" };
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
        const { res, finalUrl } = await fetchFollowingRedirects(parsed, {
            signal: ctrl.signal,
            headers: { "user-agent": "accessibility-mcp-server/0.2 (+a11y-audit)" },
        });
        const ct = res.headers.get("content-type") || "";
        if (!/html/i.test(ct)) {
            return { url, finalUrl, status: res.status, ok: false, html: "", error: `Non-HTML content-type: ${ct || "unknown"}` };
        }
        const html = await res.text();
        // A bot-protection challenge is not the site, even with HTTP 200.
        if (detectChallenge(html)) {
            return { url, finalUrl, status: res.status, ok: false, html: "", error: unauditableReason(res.status, html) };
        }
        const h = res.headers;
        const setCookies = typeof h.getSetCookie === "function" ? h.getSetCookie() : (h.get("set-cookie") ? [h.get("set-cookie")] : []);
        return { url, finalUrl, status: res.status, ok: res.ok, html, headers: pickHeaders(res.headers), setCookies };
    }
    catch (e) {
        const err = e;
        return {
            url,
            finalUrl: url,
            status: 0,
            ok: false,
            html: "",
            error: err?.name === "AbortError" ? "Request timed out" : err?.message || "Fetch failed",
        };
    }
    finally {
        clearTimeout(timer);
    }
}
/** Extract same-origin, http(s), de-duplicated page links from a document. */
export function sameOriginLinks(html, baseUrl) {
    let base;
    try {
        base = new URL(baseUrl);
    }
    catch {
        return [];
    }
    const root = parse(html);
    const out = new Set();
    for (const a of root.querySelectorAll("a[href]")) {
        // getAttribute() decodes legacy entities without a semicolon even inside
        // attributes, so "?locale=en&region=US" became "?locale=en®ion=US". HTML
        // leaves "&reg" undecoded in an attribute when a letter, digit or "=" follows;
        // he's isAttributeValue mode applies exactly that rule to the raw value.
        const raw = a.rawAttributes["href"];
        if (!raw)
            continue;
        const href = he.decode(raw, { isAttributeValue: true });
        let u;
        try {
            u = new URL(href, base);
        }
        catch {
            continue;
        }
        if (u.protocol !== "http:" && u.protocol !== "https:")
            continue;
        if (u.host !== base.host)
            continue;
        u.hash = "";
        out.add(u.href);
    }
    return [...out];
}
/**
 * Obtain a page's markup, optionally via a headless browser so that
 * JS-rendered content and shadow DOM are visible.
 * Always reports which mode actually produced the markup.
 */
export async function obtainHtml(url, render) {
    if (render === "browser" || render === "auto") {
        const r = await renderPage(url);
        if (r && r.mode === "browser") {
            // Report the real status and landing URL. Hard-coding 200 and the
            // requested URL meant an error page, or a redirect to a different site,
            // was audited as if it were the page asked for.
            const status = r.status ?? 200;
            const finalUrl = r.finalUrl ?? url;
            // Error pages and bot-protection challenges (which can be HTTP 200)
            // are not the page asked for.
            const blocked = unauditableReason(status, r.html);
            if (blocked) {
                return { html: "", mode: "browser", status, ok: false, finalUrl, runtime: [], error: blocked };
            }
            return { html: r.html, mode: "browser", status, ok: true, finalUrl, runtime: r.runtimeFindings, ...(r.stackEvidence ? { stackEvidence: r.stackEvidence } : {}) };
        }
        if (render === "browser") {
            return {
                html: "", mode: "static", status: 0, ok: false, finalUrl: url, runtime: [],
                error: r?.degradedReason ?? "Headless render unavailable",
                degradedReason: r?.degradedReason,
            };
        }
        // auto: fall through to static, carrying the reason.
        const f = await fetchHtml(url);
        return { html: f.html, mode: "static", status: f.status, ok: f.ok, finalUrl: f.finalUrl, runtime: [], ...(f.error ? { error: f.error } : {}), degradedReason: r?.degradedReason, ...(f.ok ? { stackEvidence: staticStackEvidence(f.html, f.finalUrl, f.headers ?? null, f.setCookies) } : {}) };
    }
    const f = await fetchHtml(url);
    return { html: f.html, mode: "static", status: f.status, ok: f.ok, finalUrl: f.finalUrl, runtime: [], ...(f.error ? { error: f.error } : {}), ...(f.ok ? { stackEvidence: staticStackEvidence(f.html, f.finalUrl, f.headers ?? null, f.setCookies) } : {}) };
}
/**
 * Breadth-first crawl of same-origin pages starting at startUrl, auditing each.
 * @param maxPages Requested page cap (clamped to 1..20).
 */
export async function crawlAudit(startUrl, maxPages, ruleIds, render = "auto") {
    const cap = Math.max(1, Math.min(HARD_PAGE_CAP, Math.floor(maxPages) || 1));
    const start = stripHash(startUrl);
    const seen = new Set([start]);
    const queue = [start];
    const pages = [];
    // Landing URLs already audited. Keyed on where a request ended up, not what
    // was asked for: www.ryan.com redirects to ryan.com, and the crawl then
    // audited ryan.com/ again as a "second" page, counting the homepage twice.
    const auditedAt = new Set();
    while (queue.length > 0 && pages.length < cap) {
        const url = queue.shift();
        const f = await obtainHtml(url, render);
        if (!f.ok || !f.html) {
            pages.push({ url, status: f.status, ok: false, error: f.error || "Fetch failed" });
            continue;
        }
        // A page that lands on another site is not the site being crawled (a
        // lapsed domain now serving someone else, a brand move). Don't audit it
        // or follow its links; say where it went.
        const away = offSiteHost(start, f.finalUrl);
        if (away) {
            pages.push({ url, status: f.status, ok: false, error: `Redirected off-site to ${away}; not audited. Re-run on that domain if it is the same organization.` });
            continue;
        }
        const landed = stripHash(f.finalUrl || url);
        if (auditedAt.has(landed))
            continue; // the same page, reached again by a redirect
        auditedAt.add(landed);
        seen.add(landed);
        const audited = auditHtml(f.html, ruleIds);
        if (f.runtime.length) {
            audited.findings = audited.findings.concat(f.runtime);
            audited.summary.total = audited.findings.length;
            for (const rf of f.runtime)
                audited.summary.byImpact[rf.impact]++;
            audited.summary.passed = audited.summary.total === 0;
        }
        const stack = f.stackEvidence ? detectStack(f.stackEvidence) : undefined;
        pages.push({ url, status: f.status, ok: true, renderMode: f.mode, result: audited, ...(stack ? { stack } : {}), ...(landed !== url ? { finalUrl: landed } : {}) });
        if (pages.length < cap) {
            for (const link of sameOriginLinks(f.html, f.finalUrl)) {
                if (!seen.has(link) && seen.size < cap * 10) {
                    seen.add(link);
                    queue.push(link);
                }
            }
        }
    }
    return pages;
}
