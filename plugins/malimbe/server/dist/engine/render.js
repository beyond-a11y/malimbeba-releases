import { resolveBrowser, launchOptionsFrom } from "./browser.js";
import { assertRedirectChainAllowed, isBlockedHost } from "./ssrfGuard.js";
import { collectStackEvidence } from "./stack.js";
/**
 * In-page script. Runs inside the browser context, so it has computed styles,
 * layout geometry, and shadow roots — none of which survive a static fetch.
 * Returns the flattened markup plus runtime-only findings.
 */
const EXTRACT = `(() => {
  const FOCUS_SEL = 'a[href],button,input,select,textarea,[tabindex]';
  const findings = [];
  const add = (impact, ruleId, title, wcag, el, detail, fix) => {
    const attrs = Array.from(el.attributes || []).map(a => a.value ? a.name + '="' + a.value.slice(0,40) + '"' : a.name).join(' ');
    findings.push({
      ruleId, title, wcag, level: 'AA', impact,
      selector: el.tagName.toLowerCase(),
      snippet: '<' + el.tagName.toLowerCase() + (attrs ? ' ' + attrs : '') + '>',
      detail, fix
    });
  };
  const lum = (c) => {
    const m = String(c).match(/[\\d.]+/g);
    if (!m || m.length < 3) return null;
    if (m.length > 3 && parseFloat(m[3]) === 0) return null;
    const f = m.slice(0,3).map(v => { const s = v/255; return s <= 0.03928 ? s/12.92 : Math.pow((s+0.055)/1.055, 2.4); });
    return 0.2126*f[0] + 0.7152*f[1] + 0.0722*f[2];
  };
  const effBg = (el) => {
    let n = el;
    while (n && n.nodeType === 1) {
      const b = getComputedStyle(n).backgroundColor;
      if (b && !/rgba\\(0, 0, 0, 0\\)|transparent/.test(b)) return b;
      n = n.parentElement || (n.getRootNode() && n.getRootNode().host);
    }
    return 'rgb(255,255,255)';
  };

  // Walk every element, descending into shadow roots.
  const all = [];
  (function walk(root) {
    root.querySelectorAll('*').forEach(e => { all.push(e); if (e.shadowRoot) walk(e.shadowRoot); });
  })(document);

  // Measure every target BEFORE the focus check below runs: el.focus() scrolls
  // the page, and getBoundingClientRect() is viewport-relative, so boxes taken
  // during that loop would sit at different scroll offsets and appear to
  // overlap. Per-line boxes are kept because a link wrapped over two lines has
  // a bounding box spanning everything between its fragments.
  // A closed menu often hides its items with opacity:0 on an ancestor; those
  // items are laid out but can't be seen or hit, so they are not targets.
  const transparent = (el) => {
    for (let n = el; n && n.nodeType === 1; n = n.parentElement || (n.getRootNode() && n.getRootNode().host)) {
      if (getComputedStyle(n).opacity === '0') return true;
    }
    return false;
  };
  const targets = [];
  for (const el of all) {
    if (!el.matches || !el.matches(FOCUS_SEL) || el.hasAttribute('disabled')) continue;
    let s; try { s = getComputedStyle(el); } catch { continue; }
    if (s.display === 'none' || s.visibility === 'hidden' || transparent(el)) continue;
    const r = el.getBoundingClientRect();
    if (!(r.width > 0 && r.height > 0)) continue;
    // Visually-hidden pattern (a 1×1 clipped skip link) or placed off-screen:
    // nothing a pointer user can see or hit until it takes focus.
    if ((r.width <= 1 && r.height <= 1) || r.right <= 0 || r.bottom <= 0) continue;
    const boxes = Array.from(el.getClientRects()).filter(b => b.width > 0 && b.height > 0);
    targets.push({ el, r, boxes: boxes.length ? boxes : [r] });
  }

  for (const el of all) {
    let cs; try { cs = getComputedStyle(el); } catch { continue; }
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;

    // Contrast — only meaningful with real computed colors.
    const ownText = Array.from(el.childNodes).some(n => n.nodeType === 3 && n.textContent.trim());
    if (ownText) {
      const fg = lum(cs.color), bg = lum(effBg(el));
      if (fg !== null && bg !== null) {
        const hi = Math.max(fg,bg), lo = Math.min(fg,bg);
        const ratio = (hi + 0.05) / (lo + 0.05);
        const size = parseFloat(cs.fontSize) || 16;
        const bold = (parseInt(cs.fontWeight,10) || 400) >= 700;
        const min = (size >= 24 || (size >= 18.66 && bold)) ? 3 : 4.5;
        if (ratio < min) add('serious','contrast-computed','Text must meet minimum contrast','1.4.3',el,
          'Computed contrast ' + ratio.toFixed(2) + ':1 is below the ' + min + ':1 minimum.',
          'Adjust the foreground or background colour, ideally in design tokens.');
      }
    }

    // Focus indicator — requires layout. An element collapsed to 0×0 (a closed
    // dropdown/disclosure panel's children, typically) isn't caught by the
    // display/visibility check above, but it isn't reachable or visible to a
    // real user either — skip it, same as display:none.
    if (el.matches && el.matches(FOCUS_SEL) && !el.hasAttribute('disabled')) {
      const r = el.getBoundingClientRect();
      const hasLayout = r.width > 0 && r.height > 0;
      if (hasLayout) {
        try {
          const prev = document.activeElement;
          el.focus();
          const f = getComputedStyle(el);
          const noOutline = f.outlineStyle === 'none' || parseFloat(f.outlineWidth) === 0;
          const noShadow = !f.boxShadow || f.boxShadow === 'none';
          if (noOutline && noShadow) add('serious','focus-visible-computed','Focus indicator must be visible','2.4.7',el,
            'No visible focus indicator when focused (no outline and no box-shadow).',
            'Provide a :focus-visible outline or ring with at least 3:1 contrast.');
          if (prev && prev.focus) prev.focus();
        } catch {}
      }
    }
  }

  // Target size (WCAG 2.5.8). An undersized target is reported only when
  // neither of the two exceptions that geometry can test applies:
  // - Inline: the target sits in a block of non-target text, so its size is
  //   set by the line height (a link in a sentence).
  // - Spacing: a 24px-diameter circle centred on the target meets no other
  //   target, and no other undersized target's circle.
  // The equivalent, user-agent-control and essential exceptions need human
  // judgment and are not applied.
  const small = (t) => t.r.width < 24 || t.r.height < 24;
  const inSentence = (el) => {
    if (getComputedStyle(el).display !== 'inline') return false;
    let b = el.parentElement;
    while (b && getComputedStyle(b).display === 'inline') b = b.parentElement;
    if (!b) return false;
    const w = document.createTreeWalker(b, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) {
      if (!n.textContent.trim()) continue;
      const t = n.parentElement && n.parentElement.closest(FOCUS_SEL);
      if (t && b.contains(t)) continue;
      return true;
    }
    return false;
  };
  for (const a of targets) {
    if (!small(a) || inSentence(a.el)) continue;
    const cx = a.r.left + a.r.width / 2, cy = a.r.top + a.r.height / 2;
    let near = null;
    for (const b of targets) {
      if (b === a || b.el.contains(a.el) || a.el.contains(b.el)) continue;
      const hitsRect = b.boxes.some(q => Math.hypot(
        Math.max(q.left - cx, 0, cx - q.right), Math.max(q.top - cy, 0, cy - q.bottom)) < 12);
      const hitsCircle = small(b) &&
        Math.hypot(cx - (b.r.left + b.r.width / 2), cy - (b.r.top + b.r.height / 2)) < 24;
      if (hitsRect || hitsCircle) { near = b; break; }
    }
    // One decimal, so a 23.9px side is never printed as "24 (below 24)".
    if (!near) continue;
    const px = (v) => String(Math.floor(v * 10) / 10);
    const cls = String(near.el.getAttribute('class') || '').trim().split(' ')[0];
    add('moderate','target-size','Interactive target is too small','2.5.8',a.el,
      'Rendered target is ' + px(a.r.width) + '×' + px(a.r.height) +
        'px (below 24×24), and a 24px circle centred on it overlaps the neighbouring <' +
        near.el.tagName.toLowerCase() + (cls ? ' class="' + cls.slice(0, 30) + '"' : '') + '> target.',
      'Increase the hit area to at least 24×24 CSS pixels (padding counts), or space it so no other target is within that circle.');
  }

  // Serialize the flattened tree so shadow content is auditable by static rules.
  const flatten = (node) => {
    if (node.nodeType === 3) return node.textContent;
    if (node.nodeType !== 1) return '';
    const tag = node.tagName.toLowerCase();
    if (tag === 'script' || tag === 'noscript') return '';
    const attrs = Array.from(node.attributes).map(a => ' ' + a.name + '="' + String(a.value).replace(/"/g,'&quot;') + '"').join('');
    const VOID = ['img','input','br','hr','meta','link','source','area','base','col','embed','track','wbr'];
    if (VOID.includes(tag)) return '<' + tag + attrs + '>';
    let inner = '';
    if (node.shadowRoot) inner += Array.from(node.shadowRoot.childNodes).map(flatten).join('');
    inner += Array.from(node.childNodes).map(flatten).join('');
    return '<' + tag + attrs + '>' + inner + '</' + tag + '>';
  };

  const html = '<html lang="' + (document.documentElement.getAttribute('lang') || '') + '">' +
    flatten(document.body) + '</html>';
  return { html, findings };
})()`;
const LAUNCH_TIMEOUT_MS = 15_000;
const OP_TIMEOUT_MS = 15_000;
const LOAD_GRACE_MS = 15_000;
const IDLE_CAP_MS = 10_000;
/**
 * Open an audit page. bypassCSP: axe-core is injected as an inline script, and
 * a strict Content-Security-Policy blocked it outright (seen on 8 of 865 pages
 * in a 2026-11-17 crawl, so those pages could not be audited at all). The page
 * runs in Malimbe's own headless session behind the SSRF route guard; relaxing
 * the site's CSP there changes nothing a visitor sees.
 */
async function openPage(browser) {
    return withTimeout(browser.newPage({ bypassCSP: true }), OP_TIMEOUT_MS, "newPage");
}
/**
 * Navigate, then give the full "load" event a bounded grace period. Some sites
 * never fire "load" (long-polling, endless trackers); waiting on it failed the
 * whole audit (6 of 865 pages, same crawl) even though the page had rendered.
 */
async function navigate(page, url, timeoutMs, settle = true) {
    const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    await page.waitForLoadState("load", { timeout: LOAD_GRACE_MS }).catch(() => { });
    // Callers that must watch what happens right after load (status-message
    // observation) skip the idle wait, or the changes happen before they look.
    if (!settle)
        return response;
    // Overlays and other widgets are often injected after "load" (consent
    // managers, tag managers, deferred app embeds). Detection at "load" missed
    // accessiBe on juliecare.co and UserWay on viome.com (2026-11-18); both
    // appeared within this window. Pages that go idle sooner aren't slowed.
    await page.waitForLoadState("networkidle", { timeout: IDLE_CAP_MS }).catch(() => { });
    return response;
}
/** True when the browser ended up on a different site than requested (www. ignored). */
export function offSiteHost(requested, landed) {
    if (!landed)
        return null;
    try {
        const bare = (h) => h.toLowerCase().replace(/^www\./, "");
        const a = bare(new URL(requested).hostname), b = bare(new URL(landed).hostname);
        return a === b || b.endsWith("." + a) || a.endsWith("." + b) ? null : b;
    }
    catch {
        return null;
    }
}
const CLOSE_TIMEOUT_MS = 5_000;
/** Reject if a promise doesn't settle in time, so no browser step hangs unbounded. */
export async function withTimeout(p, ms, label) {
    let timer;
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    });
    try {
        return await Promise.race([p, timeout]);
    }
    finally {
        clearTimeout(timer);
    }
}
/**
 * Abort any request the page makes to a blocked host — the initial
 * navigation URL and sub-resources (an <img src>, a fetch() the page's own
 * JS makes) the audited page's content requests directly.
 *
 * Does NOT cover a redirect the browser follows mid-navigation: confirmed
 * live that Chromium doesn't re-invoke Playwright's route handler for a
 * server-side redirect hop during a top-level navigation, so this alone
 * would let a same-origin-looking page that 302s to a blocked host sail
 * straight through. That gap is closed separately, before this function
 * ever runs — see assertRedirectChainAllowed()'s doc comment in
 * ssrfGuard.ts for the full investigation and why it has to live there
 * instead of here.
 */
async function guardPage(page) {
    await page.route("**/*", (route) => {
        let host;
        try {
            host = new URL(route.request().url()).hostname;
        }
        catch {
            route.continue();
            return;
        }
        if (isBlockedHost(host)) {
            route.abort("blockedbyclient");
            return;
        }
        route.continue();
    });
}
let cachedBrowser = null;
// Concurrent tool calls must share ONE launch. Without this, N parallel audits
// each launched their own browser and only the last was cached, leaking the
// rest (and keeping the process alive after closeBrowser()).
let launching = null;
/** Try to obtain a Playwright browser via the layered fallback. Null when none. */
async function getBrowser() {
    if (cachedBrowser)
        return cachedBrowser;
    if (!launching) {
        launching = launchBrowser().finally(() => {
            launching = null;
        });
    }
    return launching;
}
async function launchBrowser() {
    try {
        // Optional dependency — absent installs simply fall back to static mode.
        const pw = await import("playwright-core");
        // In-audit path degrades fast: resolve env → discovered → managed, but only
        // auto-install mid-audit when explicitly opted in (A11Y_AUTO_INSTALL=1), to
        // avoid a multi-minute install stalling a tool call. `malimbeba doctor --fix`
        // and a11y_browser_check{install:true} are the blessed provisioning surfaces.
        const res = await resolveBrowser({ autoInstall: process.env["A11Y_AUTO_INSTALL"] === "1" });
        if (!res.usable)
            return null;
        const browser = await pw.chromium.launch({ ...launchOptionsFrom(res), timeout: LAUNCH_TIMEOUT_MS });
        browser.on("disconnected", () => { cachedBrowser = null; });
        cachedBrowser = browser;
        return browser;
    }
    catch {
        return null;
    }
}
export async function closeBrowser() {
    const b = cachedBrowser;
    cachedBrowser = null;
    if (b && typeof b.close === "function") {
        try {
            await withTimeout(b.close(), CLOSE_TIMEOUT_MS, "browser close");
        }
        catch {
            // Close hung or failed; cachedBrowser is already null, so the next
            // getBrowser() launches fresh. A launched Playwright Browser exposes no
            // process handle, so there's nothing to force-kill here.
        }
    }
}
/**
 * Render a URL in a headless browser and return its flattened DOM.
 * Resolves with mode "static" and a reason when no browser is available —
 * the caller must report which mode produced the result.
 */
export async function renderPage(url, timeoutMs = 20000) {
    try {
        await assertRedirectChainAllowed(url);
    }
    catch (e) {
        return { mode: "static", html: "", runtimeFindings: [], degradedReason: e.message };
    }
    const browser = await getBrowser();
    if (!browser) {
        return {
            mode: "static",
            html: "",
            runtimeFindings: [],
            degradedReason: "No headless browser available. Install playwright-core and a Chromium build, or set A11Y_BROWSER_PATH to an existing Chrome/Edge binary.",
        };
    }
    let page = null;
    try {
        page = await openPage(browser);
        await guardPage(page);
        await page.setViewportSize({ width: 1280, height: 900 });
        const response = await navigate(page, url, timeoutMs);
        // Stack evidence first: EXTRACT moves focus around, which some widgets react to.
        const stackEvidence = await withTimeout(collectStackEvidence(page, url, response ? response.headers() : null), OP_TIMEOUT_MS, "stack evidence");
        const out = (await withTimeout(page.evaluate(EXTRACT), OP_TIMEOUT_MS, "evaluate"));
        return {
            mode: "browser", html: out.html, runtimeFindings: out.findings ?? [], stackEvidence,
            status: response ? response.status() : 200, finalUrl: page.url() || url,
        };
    }
    catch (e) {
        const msg = e?.message ?? "render failed";
        return { mode: "static", html: "", runtimeFindings: [], degradedReason: `Render failed: ${msg}` };
    }
    finally {
        if (page) {
            try {
                await page.close();
            }
            catch {
                /* ignore */
            }
        }
    }
}
/**
 * Open a live Playwright page for callers that need to execute in-page code
 * (e.g. injecting axe-core). The caller MUST call close().
 */
export async function renderPageRaw(url, timeoutMs = 25000, opts = {}) {
    try {
        await assertRedirectChainAllowed(url);
    }
    catch (e) {
        return { ok: false, page: null, error: e.message, close: async () => { } };
    }
    const browser = await getBrowser();
    if (!browser) {
        return {
            ok: false,
            page: null,
            error: "No headless browser available. Install playwright-core plus a Chromium build (npx playwright install chromium), or set A11Y_BROWSER_PATH to an existing Chrome/Edge binary.",
            close: async () => { },
        };
    }
    let page = null;
    try {
        page = await openPage(browser);
        await guardPage(page);
        await page.setViewportSize({ width: 1280, height: 900 });
        const response = await navigate(page, url, timeoutMs, opts.settle ?? true);
        const p = page;
        return {
            ok: true,
            page: p,
            responseHeaders: response ? response.headers() : null,
            status: response ? response.status() : 200,
            finalUrl: p.url() || url,
            close: async () => {
                try {
                    await p.close();
                }
                catch {
                    /* ignore */
                }
            },
        };
    }
    catch (e) {
        if (page) {
            try {
                await page.close();
            }
            catch {
                /* ignore */
            }
        }
        return { ok: false, page: null, error: `Could not load ${url}: ${e?.message ?? "navigation failed"}`, close: async () => { } };
    }
}
