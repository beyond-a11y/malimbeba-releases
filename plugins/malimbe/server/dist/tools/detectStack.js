import { z } from "zod";
import { fetchHtml } from "../engine/fetch.js";
import { renderPageRaw } from "../engine/render.js";
import { unauditableReason } from "../engine/challenge.js";
import { collectStackEvidence, detectStack, staticStackEvidence, stackToMarkdown } from "../engine/stack.js";
const InputSchema = z
    .object({
    url: z.string().min(1).describe("The http(s) page to inspect."),
    render: z
        .enum(["auto", "browser", "static"])
        .default("auto")
        .describe("'browser' loads the page in a headless browser (sees runtime globals, version constants and JavaScript-built markup); 'static' reads delivered HTML and headers only; 'auto' prefers the browser and falls back to static. The result names the mode used."),
    response_format: z.enum(["markdown", "json"]).default("markdown"),
})
    .strict();
/** Detect a page's stack from one load. Exported for tests and other tools. */
export async function detectStackForUrl(url, render) {
    let degradedReason;
    if (render !== "static") {
        const page = await renderPageRaw(url);
        if (page.ok && page.page) {
            try {
                // An error or challenge page has its own stack, not the site's.
                let docHtml = "";
                try {
                    docHtml = await page.page.content();
                }
                catch {
                    docHtml = "";
                }
                const blocked = unauditableReason(page.status, docHtml);
                if (blocked)
                    return { ok: false, error: blocked.replace("audited", "inspected") };
                const ev = await collectStackEvidence(page.page, url, page.responseHeaders ?? null);
                return { ok: true, report: detectStack(ev) };
            }
            finally {
                await page.close();
            }
        }
        if (render === "browser")
            return { ok: false, error: page.error ?? "Headless render unavailable" };
        degradedReason = page.error;
    }
    const f = await fetchHtml(url);
    if (!f.ok || !f.html)
        return { ok: false, error: f.error ?? `Fetch failed (status ${f.status})` };
    return { ok: true, report: detectStack(staticStackEvidence(f.html, f.finalUrl, f.headers ?? null, f.setCookies)), ...(degradedReason ? { degradedReason } : {}) };
}
export function registerDetectStackTool(server) {
    server.registerTool("a11y_detect_stack", {
        title: "Detect a page's platform, framework, widgets and overlays",
        description: `Report what a page is built on — CMS or hosted platform, front-end framework, component libraries and widgets, accessibility overlays, and other third-party scripts — with the evidence for each detection, and where fixes for each layer have to happen (native markup, platform template, custom component, or vendor).

Detection uses one page load: generator meta tags, script and stylesheet URLs, allowlisted product response headers, cookie NAMES (never values), typeof checks on a fixed list of globals, a fixed set of version constants, and DOM marker selectors. It never reads storage, form data or cookie values. Same fetch safety rules as a11y_audit_url.

Confidence reflects how specific the evidence is (a generator tag or product header is high; a single file name is lower). Anything it can't determine is listed under unknowns instead of guessed. Lifecycle warnings (for example, SharePoint Server 2016/2019 end of extended support) come from static, dated, sourced data.

Args:
  - url (string), render ('auto'|'browser'|'static'), response_format ('markdown'|'json').

Returns (json): { url, detectedAt, renderMode, detections: [{ id, name, category, version?, confidence, evidence, fixLayer?, notes?, lifecycle? }], unknowns, degradedReason? }.`,
        inputSchema: InputSchema.shape,
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    }, async (args) => {
        const { url, render, response_format } = InputSchema.parse(args);
        const r = await detectStackForUrl(url, render);
        if (!r.ok || !r.report) {
            return {
                content: [{ type: "text", text: `Could not inspect ${url}: ${r.error}` }],
                structuredContent: { url, ok: false, error: r.error },
            };
        }
        const payload = { ...r.report, ...(r.degradedReason ? { degradedReason: r.degradedReason } : {}) };
        if (response_format === "json") {
            return {
                content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
                structuredContent: payload,
            };
        }
        const note = r.degradedReason ? `\n\n_Browser unavailable, used static mode: ${r.degradedReason}_` : "";
        return {
            content: [{ type: "text", text: `# Stack detection — ${r.report.url}\n\n${stackToMarkdown(r.report, "## Platform and what it means for fixes")}${note}` }],
            structuredContent: payload,
        };
    });
}
