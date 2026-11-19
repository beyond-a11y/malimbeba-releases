import { parse } from "node-html-parser";
import { SIGNATURES, VERSION_PROBES, SHAREPOINT_LIFECYCLE, sharePointProduct, } from "./stackSignatures.js";
const STRENGTH_RANK = { high: 3, medium: 2, low: 1 };
/** Product headers whose values are read. Everything else is ignored. */
export const HEADER_ALLOWLIST = [
    ...new Set([
        "x-powered-by", "server", "x-aspnet-version", "x-aspnetmvc-version", "microsoftsharepointteamservices",
        "x-generator", "link",
        ...SIGNATURES.flatMap((s) => s.match.filter((m) => m.kind === "header").map((m) => m.name)),
        ...SIGNATURES.flatMap((s) => (s.version ?? []).filter((v) => v.from === "header").map((v) => v.name)),
    ].map((h) => h.toLowerCase())),
];
const GLOBAL_NAMES = [...new Set(SIGNATURES.flatMap((s) => s.match.filter((m) => m.kind === "global").map((m) => m.name)))];
const MARKER_SELECTORS = [...new Set(SIGNATURES.flatMap((s) => s.match.filter((m) => m.kind === "selector").map((m) => m.selector)))];
const ATTR_PROBES = SIGNATURES.flatMap((s) => (s.version ?? []).filter((v) => v.from === "attr"));
export function emptyEvidence(url, renderMode) {
    return { url, renderMode, headers: {}, cookieNames: [], metas: [], scripts: [], stylesheets: [], inlineScripts: [], globals: [], probes: {}, markers: {}, attrs: {}, overlayTriggers: [] };
}
export function pickHeaders(all) {
    const out = {};
    if (!all)
        return out;
    const get = (k) => typeof all.get === "function" ? all.get(k) : all[k] ?? null;
    for (const h of HEADER_ALLOWLIST) {
        const v = get(h);
        if (v)
            out[h] = String(v).slice(0, 300);
    }
    return out;
}
export function cookieNamesFromSetCookie(values) {
    return [...new Set(values.map((v) => v.split(";")[0].split("=")[0].trim()).filter(Boolean))];
}
/**
 * In-page collector. Runs in the audited page in the same load the audit
 * uses. It reads tag attributes, typeof for an allowlist of globals, a fixed
 * set of version constants, and marker counts. It never reads cookie values,
 * storage or form data.
 */
export function buildCollectorScript() {
    const probes = Object.entries(VERSION_PROBES)
        .map(([k, expr]) => `try { var v = (${expr}); if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') out.probes[${JSON.stringify(k)}] = v; } catch (e) {}`)
        .join("\n");
    return `(() => {
  const out = { metas: [], scripts: [], stylesheets: [], inlineScripts: [], globals: [], probes: {}, markers: {}, attrs: {}, overlayTriggers: [] };
  document.querySelectorAll('meta[name], meta[property]').forEach(m => out.metas.push({ name: (m.getAttribute('name') || m.getAttribute('property') || '').slice(0, 80), content: (m.getAttribute('content') || '').slice(0, 200) }));
  document.querySelectorAll('script[src]').forEach(s => out.scripts.push(s.src.slice(0, 400)));
  document.querySelectorAll('link[rel=modulepreload][href], link[rel=preload][as=script][href]').forEach(l => out.scripts.push(l.href.slice(0, 400)));
  document.querySelectorAll('link[rel=stylesheet][href]').forEach(l => out.stylesheets.push(l.href.slice(0, 400)));
  document.querySelectorAll('script:not([src])').forEach(s => { const t = (s.textContent || '').trim(); if (t) out.inlineScripts.push(t.slice(0, 400)); });
  for (const n of ${JSON.stringify(GLOBAL_NAMES)}) { try { if (typeof window[n] !== 'undefined') out.globals.push(n); } catch (e) {} }
  ${probes}
  for (const sel of ${JSON.stringify(MARKER_SELECTORS)}) { try { const c = document.querySelectorAll(sel).length; if (c) out.markers[sel] = c; } catch (e) {} }
  for (const p of ${JSON.stringify(ATTR_PROBES)}) { try { const el = document.querySelector(p.selector); if (el) out.attrs[p.selector] = String(el.getAttribute(p.attr) || '').slice(0, 40); } catch (e) {} }
  try {
    const counted = ['[role="menubar"]'];
    for (const sel of counted) { const c = document.querySelectorAll(sel).length; if (c) out.markers[sel] = c; }
  } catch (e) {}
  document.querySelectorAll('access-widget-ui, .acsb-trigger, [data-acsb="trigger"]').forEach(el => {
    const r = el.getBoundingClientRect();
    out.overlayTriggers.push({ tag: el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.split(/\\s+/)[0] : ''), width: Math.round(r.width), height: Math.round(r.height) });
  });
  return out;
})()`;
}
/** Collect evidence from a live Playwright page plus its main response. */
export async function collectStackEvidence(page, url, responseHeaders) {
    const ev = emptyEvidence(url, "browser");
    ev.headers = pickHeaders(responseHeaders);
    const script = buildCollectorScript();
    try {
        const raw = (await page.evaluate(script));
        Object.assign(ev, raw);
    }
    catch {
        /* evidence stays partial; unknowns will say so */
    }
    // Overlays build their trigger after the load event. When an overlay script
    // is present but its trigger isn't yet, wait briefly in the SAME page load
    // so the report can say whether the trigger is visible.
    const overlayLoaded = ev.globals.includes("acsbJS") || ev.scripts.some((s) => /acsbapp?\.com/i.test(s));
    if (overlayLoaded && !ev.overlayTriggers.length) {
        try {
            await page.waitForSelector("access-widget-ui, .acsb-trigger", { state: "attached", timeout: 4000 });
            const again = (await page.evaluate(script));
            ev.overlayTriggers = again.overlayTriggers ?? [];
            for (const [k, v] of Object.entries(again.markers ?? {}))
                ev.markers[k] = v;
        }
        catch {
            /* trigger never appeared; reported as not observed */
        }
    }
    try {
        const cookies = (await page.context().cookies());
        ev.cookieNames = [...new Set(cookies.map((c) => c.name))];
    }
    catch {
        /* ignore */
    }
    try {
        ev.url = page.url() || url;
    }
    catch {
        /* ignore */
    }
    return ev;
}
/** Collect evidence from delivered HTML and headers (no browser). */
export function staticStackEvidence(html, url, headers, setCookies = []) {
    const ev = emptyEvidence(url, "static");
    ev.headers = pickHeaders(headers);
    ev.cookieNames = cookieNamesFromSetCookie(setCookies);
    let root;
    try {
        root = parse(html, { blockTextElements: { script: true, noscript: true, style: true, pre: true } });
    }
    catch {
        return ev;
    }
    const abs = (u) => {
        try {
            return new URL(u, url).href;
        }
        catch {
            return u;
        }
    };
    for (const m of root.querySelectorAll("meta")) {
        const name = m.getAttribute("name") || m.getAttribute("property");
        if (name)
            ev.metas.push({ name: name.slice(0, 80), content: (m.getAttribute("content") || "").slice(0, 200) });
    }
    for (const s of root.querySelectorAll("script")) {
        const src = s.getAttribute("src");
        if (src)
            ev.scripts.push(abs(src).slice(0, 400));
        else {
            const t = s.text.trim();
            if (t)
                ev.inlineScripts.push(t.slice(0, 400));
        }
    }
    for (const l of root.querySelectorAll("link")) {
        const rel = (l.getAttribute("rel") || "").toLowerCase();
        const href = l.getAttribute("href");
        if (!href)
            continue;
        if (rel === "stylesheet")
            ev.stylesheets.push(abs(href).slice(0, 400));
        if (rel === "modulepreload")
            ev.scripts.push(abs(href).slice(0, 400));
    }
    for (const sel of [...MARKER_SELECTORS, '[role="menubar"]']) {
        try {
            const c = root.querySelectorAll(sel).length;
            if (c)
                ev.markers[sel] = c;
        }
        catch {
            /* selector unsupported by the static parser */
        }
    }
    for (const p of ATTR_PROBES) {
        try {
            const el = root.querySelector(p.selector);
            if (el)
                ev.attrs[p.selector] = String(el.getAttribute(p.attr) || "").slice(0, 40);
        }
        catch {
            /* ignore */
        }
    }
    return ev;
}
function short(u) {
    try {
        const x = new URL(u);
        const path = x.pathname.length > 60 ? `…${x.pathname.slice(-57)}` : x.pathname;
        // Combo/bundle endpoints carry the real file names in the query string.
        const query = x.pathname.length < 12 && x.search ? decodeURIComponent(x.search).slice(0, 70) : "";
        return `${x.host}${path}${query}`;
    }
    catch {
        return u.slice(0, 80);
    }
}
function hostOf(u) {
    try {
        return new URL(u).hostname;
    }
    catch {
        return "";
    }
}
const PROBE_LABELS = {
    reactDom: "React internals found on rendered DOM nodes",
    slick: "jQuery plugin $.fn.slick is registered",
    bxslider: "jQuery plugin $.fn.bxSlider is registered",
    selectboxit: "jQuery plugin $.fn.selectBoxIt is registered",
    select2: "jQuery plugin $.fn.select2 is registered",
    chosen: "jQuery plugin $.fn.chosen is registered",
    owl: "jQuery plugin $.fn.owlCarousel is registered",
};
/** Evaluate one matcher; returns a human-readable evidence string or null. */
function evalMatcher(m, ev) {
    switch (m.kind) {
        case "generator": {
            const g = ev.metas.find((x) => x.name.toLowerCase() === "generator" && m.pattern.test(x.content));
            return g ? `generator meta "${g.content}"` : null;
        }
        case "meta": {
            const g = ev.metas.find((x) => m.name.test(x.name) && (!m.content || m.content.test(x.content)));
            return g ? `meta ${g.name}="${g.content.slice(0, 60)}"` : null;
        }
        case "header": {
            const v = ev.headers[m.name.toLowerCase()];
            if (v === undefined || (m.value && !m.value.test(v)))
                return null;
            return `response header ${m.name}: ${v.slice(0, 80)}`;
        }
        case "script": {
            const s = ev.scripts.find((x) => m.pattern.test(x));
            return s ? `script ${short(s)}` : null;
        }
        case "stylesheet": {
            const s = ev.stylesheets.find((x) => m.pattern.test(x));
            return s ? `stylesheet ${short(s)}` : null;
        }
        case "inline": {
            const s = ev.inlineScripts.find((x) => m.pattern.test(x));
            return s ? `inline script matching ${m.pattern.source.slice(0, 40)}` : null;
        }
        case "global":
            return ev.globals.includes(m.name) ? `global window.${m.name} is defined` : null;
        case "probe": {
            const v = ev.probes[m.key];
            if (v === undefined || v === false || v === "")
                return null;
            return typeof v === "boolean" ? (PROBE_LABELS[m.key] ?? `runtime check "${m.key}" is true`) : `runtime version constant ${m.key} = ${v}`;
        }
        case "selector": {
            const c = ev.markers[m.selector];
            return c ? `${c} element(s) match ${m.selector}` : null;
        }
        case "cookie": {
            const c = ev.cookieNames.find((x) => m.pattern.test(x));
            return c ? `cookie name ${c}` : null;
        }
        case "host":
            return m.pattern.test(hostOf(ev.url)) ? `host ${hostOf(ev.url)}` : null;
    }
}
function extractVersion(sig, ev) {
    for (const v of sig.version ?? []) {
        let raw;
        switch (v.from) {
            case "probe": {
                const p = ev.probes[v.key];
                raw = typeof p === "string" || typeof p === "number" ? String(p) : undefined;
                break;
            }
            case "header":
                raw = ev.headers[v.name.toLowerCase()];
                break;
            case "generator":
                raw = ev.metas.find((x) => x.name.toLowerCase() === "generator" && v.pattern.test(x.content))?.content;
                break;
            case "script":
                raw = ev.scripts.find((x) => v.pattern.test(x));
                break;
            case "stylesheet":
                raw = ev.stylesheets.find((x) => v.pattern.test(x));
                break;
            case "attr":
                raw = ev.attrs[v.selector];
                break;
        }
        if (!raw)
            continue;
        const pattern = "pattern" in v ? v.pattern : undefined;
        if (!pattern)
            return raw.trim() || undefined;
        const m = raw.match(pattern);
        if (m)
            return m.length > 2 && m[2] ? `${m[1]}.${m[2]}` : (m[1] ?? m[0]).trim();
    }
    return undefined;
}
/** Signature-specific refinements that can't be expressed as plain data. */
function refine(d, ev, all) {
    if (d.id === "sharepoint-server") {
        if (all.has("sharepoint-online"))
            return null;
        if (d.version) {
            const product = sharePointProduct(d.version);
            if (product.id === "online")
                return null;
            d.name = product.name;
            if (product.id === "2016" || product.id === "2019")
                d.lifecycle = SHAREPOINT_LIFECYCLE[product.id];
        }
        const ui = ev.probes["spUiVersion"];
        if (ui === 15) {
            d.evidence.push("runtime version constant spUiVersion = 15");
            d.notes = [...(d.notes ?? []), "The site uses the classic SharePoint UI (webUIVersion 15), not the modern experience."];
        }
    }
    if (d.id === "liferay-dxp") {
        const header = ev.headers["liferay-portal"];
        if (header && !/Digital Experience Platform|DXP/i.test(header))
            d.name = "Liferay Portal";
        const theme = ev.stylesheets.map((s) => s.match(/\/o\/([a-z0-9-]+-theme)\//i)?.[1]).find(Boolean);
        if (theme) {
            const pretty = theme.replace(/-theme$/i, "").replace(/(^|-)([a-z])/g, (_m, sep, c) => (sep ? " " : "") + c.toUpperCase());
            d.name = `${d.name} (${pretty} theme)`;
            d.evidence.push(`theme stylesheet path /o/${theme}/`);
        }
        const menubars = ev.markers['[role="menubar"]'];
        if (menubars)
            d.notes = [...(d.notes ?? []), `${menubars} navigation menu instance(s) are exposed as role="menubar".`];
    }
    if (d.id === "react-router") {
        if (ev.probes["reactRouterSsr"] === true && ev.probes["reactRouterSpaMode"] === false) {
            d.notes = [...(d.notes ?? []), "Server-rendered (ssr: true, isSpaMode: false)."];
            d.evidence.push("runtime flags ssr = true, isSpaMode = false");
        }
        else if (ev.probes["reactRouterSpaMode"] === true) {
            d.notes = [...(d.notes ?? []), "Client-rendered single-page app (isSpaMode: true)."];
        }
    }
    if (d.id === "overlay-unrecognized") {
        for (const other of all.values()) {
            if (other.category === "overlay" && other.id !== d.id)
                return null;
        }
    }
    if (d.id === "accessibe" && !ev.overlayTriggers.length && ev.renderMode === "browser") {
        d.notes = ["Trigger element not observed within 4 seconds of page load.", ...(d.notes ?? [])];
    }
    if (d.id === "accessibe" && ev.overlayTriggers.length) {
        const visible = ev.overlayTriggers.filter((t) => t.width > 0 && t.height > 0);
        const desc = visible.length
            ? `Trigger visible (${visible[0].width}×${visible[0].height}).`
            : `Trigger present but 0×0 on load (${ev.overlayTriggers.map((t) => t.tag).join(", ")}).`;
        d.notes = [desc, ...(d.notes ?? [])];
        d.evidence.push(`trigger size ${visible.length ? `${visible[0].width}×${visible[0].height}` : "0×0"}`);
    }
    return d;
}
export function detectStack(ev, signatures = SIGNATURES) {
    const found = new Map();
    for (const sig of signatures) {
        const evidence = [];
        let best = 0;
        let lows = 0;
        for (const m of sig.match) {
            const hit = evalMatcher(m, ev);
            if (!hit)
                continue;
            if (!evidence.includes(hit))
                evidence.push(hit);
            const s = STRENGTH_RANK[m.strength ?? "medium"];
            best = Math.max(best, s);
            if (s === 1)
                lows++;
        }
        if (!evidence.length)
            continue;
        // Two independent medium signals corroborate each other.
        const mediums = sig.match.filter((m) => (m.strength ?? "medium") === "medium" && evalMatcher(m, ev)).length;
        const confidence = best === 3 || mediums >= 2 ? "high" : best === 2 || lows >= 2 ? "medium" : "low";
        const version = extractVersion(sig, ev);
        found.set(sig.id, {
            id: sig.id,
            name: sig.name,
            category: sig.category,
            ...(version ? { version } : {}),
            confidence,
            evidence,
            ...(sig.fixLayer ? { fixLayer: sig.fixLayer } : {}),
            ...(sig.notes ? { notes: [...sig.notes] } : {}),
            ...(sig.lifecycle ? { lifecycle: sig.lifecycle } : {}),
        });
    }
    // Implications (Next.js proves React) — evidence names the parent.
    for (const sig of signatures) {
        const parent = found.get(sig.id);
        if (!parent || !sig.implies)
            continue;
        for (const childId of sig.implies) {
            const child = signatures.find((s) => s.id === childId);
            if (!child)
                continue;
            const existing = found.get(childId);
            const reason = `implied by ${parent.name}`;
            if (existing) {
                if (!existing.evidence.includes(reason))
                    existing.evidence.push(reason);
            }
            else {
                found.set(childId, {
                    id: child.id,
                    name: child.name,
                    category: child.category,
                    confidence: parent.confidence === "high" ? "high" : "medium",
                    evidence: [reason],
                    ...(child.fixLayer ? { fixLayer: child.fixLayer } : {}),
                    ...(child.notes ? { notes: [...child.notes] } : {}),
                });
            }
        }
    }
    const detections = [];
    for (const d of found.values()) {
        const r = refine(d, ev, found);
        if (r)
            detections.push(r);
    }
    const order = ["platform", "framework", "ui-library", "widget", "overlay", "document-accessibility", "feedback", "media", "analytics", "monitoring"];
    detections.sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category) || STRENGTH_RANK[b.confidence] - STRENGTH_RANK[a.confidence] || a.name.localeCompare(b.name));
    const unknowns = [];
    if (!detections.some((d) => d.category === "platform"))
        unknowns.push("No CMS or hosted platform signature matched.");
    if (!detections.some((d) => d.category === "framework"))
        unknowns.push("No front-end framework signature matched.");
    const gen = ev.metas.find((m) => m.name.toLowerCase() === "generator");
    if (gen && !detections.some((d) => d.evidence.some((e) => e.startsWith("generator meta")))) {
        unknowns.push(`Unrecognized generator meta: "${gen.content.slice(0, 80)}".`);
    }
    for (const h of ["x-powered-by", "server"]) {
        const v = ev.headers[h];
        if (v && !detections.some((d) => d.evidence.some((e) => e.startsWith(`response header ${h}`))) && !/^(cloudflare|nginx|apache|cloudfront|microsoft-iis[\d/.]*|asp\.net|akamaighost|envoy|gws|amazons3)$/i.test(v.trim())) {
            unknowns.push(`Unrecognized ${h} header: "${v.slice(0, 60)}".`);
        }
    }
    if (ev.renderMode === "static") {
        unknowns.push("Static mode: runtime globals, version constants and JavaScript-built markup were not checked, so frameworks and widgets may be missed.");
    }
    return { url: ev.url, detectedAt: new Date().toISOString(), renderMode: ev.renderMode, detections, unknowns };
}
/** Attribution selectors for the detections present on this page only. */
export function attributionMarkers(report, signatures = SIGNATURES) {
    const ids = new Set(report.detections.map((d) => d.id));
    // Overlays and widgets first: they sit inside platform chrome, and the more
    // specific owner is the useful answer.
    const rank = (c) => (c === "overlay" ? 0 : c === "widget" ? 1 : c === "media" || c === "feedback" ? 2 : c === "platform" ? 3 : 4);
    return signatures
        .filter((s) => ids.has(s.id) && s.attribution?.length)
        .sort((a, b) => rank(a.category) - rank(b.category))
        .flatMap((s) => s.attribution.map((a) => ({ detectionId: s.id, selector: a.selector, label: a.label })));
}
/**
 * In-page attribution: for each axe target, find the first marker the
 * element or one of its ancestors matches. Unmatched or unresolvable
 * targets get null — never a guess.
 */
export const ATTRIBUTE_SCRIPT = `(args) => {
  const out = [];
  for (const target of args.targets) {
    let el = null;
    try { el = document.querySelector(target); } catch (e) {}
    if (!el) { out.push(null); continue; }
    let hit = null;
    for (const m of args.markers) {
      let anc = null;
      try { anc = el.closest(m.selector); } catch (e) { continue; }
      if (anc) { hit = { detectionId: m.detectionId, reason: (anc === el ? 'element matches ' : 'inside ') + m.label + ' (' + m.selector.split(',')[0].trim() + ')' }; break; }
    }
    out.push(hit);
  }
  return out;
}`;
export async function attributeOrigins(page, targets, report) {
    const markers = attributionMarkers(report);
    if (!markers.length || !targets.length)
        return targets.map(() => null);
    try {
        // eslint-disable-next-line no-new-func
        const fn = new Function(`return (${ATTRIBUTE_SCRIPT})`)();
        return (await page.evaluate(fn, { targets, markers }));
    }
    catch {
        return targets.map(() => null);
    }
}
const LAYER_TEXT = {
    native: "Native markup — fix in the site's own HTML, CSS and scripts",
    template: "Platform template — fix through the platform's templates, themes or overrides",
    "custom-component": "Custom component — fix in the component's source",
    vendor: "Vendor — configure it, ask the vendor, or replace it",
};
export function stackToMarkdown(r, heading = "## Platform and what it means for fixes") {
    if (!r.detections.length) {
        return `${heading}\n\nNo platform, framework or third-party signatures were detected.${r.unknowns.length ? `\n\n${r.unknowns.map((u) => `- ${u}`).join("\n")}` : ""}`;
    }
    const rows = r.detections
        .map((d) => `| ${d.category} | ${d.name}${d.version ? ` ${d.version}` : ""} (${d.confidence}) | ${d.evidence.slice(0, 3).join("; ").replace(/\|/g, "\\|")} |`)
        .join("\n");
    const table = `| Layer | What we found | Evidence |\n|---|---|---|\n${rows}`;
    const byLayer = new Map();
    for (const d of r.detections) {
        if (!d.fixLayer || !d.notes?.length)
            continue;
        byLayer.set(d.fixLayer, [...(byLayer.get(d.fixLayer) ?? []), d]);
    }
    const layers = ["template", "custom-component", "native", "vendor"]
        .filter((l) => byLayer.has(l))
        .map((l) => `### ${LAYER_TEXT[l]}\n${byLayer.get(l).map((d) => `- **${d.name}:** ${d.notes.join(" ")}`).join("\n")}`)
        .join("\n\n");
    const life = r.detections.filter((d) => d.lifecycle);
    const lifecycle = life.length
        ? `### Lifecycle warnings\n${life.map((d) => `- **${d.name}:** ${d.lifecycle.status}${d.lifecycle.date ? ` (${d.lifecycle.date})` : ""} Source: ${d.lifecycle.source} (as of ${d.lifecycle.asOf}).`).join("\n")}`
        : "";
    const unknowns = r.unknowns.length ? `### Not determined\n${r.unknowns.map((u) => `- ${u}`).join("\n")}` : "";
    return [heading, `Detected from one page load (${r.renderMode} mode). Confidence is in parentheses.`, table, layers, lifecycle, unknowns].filter(Boolean).join("\n\n");
}
const idSet = (r) => [...new Set(r.detections.map((d) => d.id))].sort().join(",");
/** Crawl roll-up: detect once per origin, plus each path whose stack differs. */
export function summarizeCrawlStacks(pages) {
    const origins = [];
    const differingPages = [];
    for (const p of pages) {
        if (!p.stack)
            continue;
        let origin;
        try {
            origin = new URL(p.url).origin;
        }
        catch {
            continue;
        }
        const base = origins.find((o) => o.origin === origin);
        if (!base)
            origins.push({ origin, stack: p.stack });
        else if (idSet(base.stack) !== idSet(p.stack))
            differingPages.push({ url: p.url, stack: p.stack });
    }
    return { origins, differingPages };
}
export function crawlStackToMarkdown(s) {
    if (!s.origins.length)
        return "";
    const parts = s.origins.map((o) => stackToMarkdown(o.stack, `## Platform and what it means for fixes — ${o.origin}`));
    for (const d of s.differingPages) {
        const base = s.origins.find((o) => d.url.startsWith(o.origin))?.stack;
        const baseIds = new Set(base?.detections.map((x) => x.id) ?? []);
        const ids = new Set(d.stack.detections.map((x) => x.id));
        const added = d.stack.detections.filter((x) => !baseIds.has(x.id)).map((x) => x.name);
        const missing = (base?.detections ?? []).filter((x) => !ids.has(x.id)).map((x) => x.name);
        parts.push(`### Different stack on ${d.url}\n` +
            (added.length ? `- Adds: ${added.join(", ")}\n` : "") +
            (missing.length ? `- Not present: ${missing.join(", ")}` : ""));
    }
    return parts.join("\n\n");
}
