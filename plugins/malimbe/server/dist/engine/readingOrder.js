import { renderPageRaw, withTimeout } from "./render.js";
import { findOrderMismatches } from "./visualOrder.js";
/**
 * The gap this closes: WCAG 1.3.2 (Meaningful Sequence) requires that
 * when content has an order that affects its meaning, that order is
 * programmatically determinable -- in practice, that DOM order matches
 * the visual reading order. CSS layout (flex/grid `order`, absolute
 * positioning) can make the two diverge invisibly: a sighted user reads
 * top-to-bottom in the CSS-painted order, while a screen reader's linear
 * "read from here" navigation follows raw DOM order, unaffected by
 * `order` -- unlike sequential Tab focus, which modern browsers DO
 * reorder to match `order` (see keyboard.ts's own comment on this same
 * distinction, confirmed live). So this is a genuinely different bug
 * class from keyboard.ts's focus-order check, not a duplicate of it --
 * they happen to share the geometry-comparison technique (visualOrder.ts)
 * but diverge on what breaks them and how to fix them.
 *
 * This is the WCAG-groundable proxy for "reading order" -- it checks DOM
 * order against visual position. It does NOT evaluate true F-pattern or
 * Z-pattern conformance, which is a UX eye-tracking heuristic about where
 * sighted users' attention naturally goes, not a programmatically
 * checkable property. Flagged for review, never asserted as a hard fail:
 * some backward visual jumps are intentional (a skip link, a sidebar that
 * legitimately reads after the main content but sits first visually).
 */
const CONTENT_SELECTOR = "h1,h2,h3,h4,h5,h6,[role='heading'],p,li,a[href],button,input:not([type='hidden']),select,textarea,img[alt],td,th";
const OP_TIMEOUT_MS = 15_000;
const EXTRACT_SCRIPT = `(() => {
  const SEL = ${JSON.stringify(CONTENT_SELECTOR)};
  const isVisible = (el) => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.visibility === 'collapse') return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const all = [];
  (function walk(root) { root.querySelectorAll('*').forEach(e => { all.push(e); if (e.shadowRoot) walk(e.shadowRoot); }); })(document);
  const desc = (el) => {
    const t = el.tagName.toLowerCase();
    const id = el.id ? '#' + el.id : '';
    const cls = !id ? (el.getAttribute('class') || '').trim().split(/\s+/)[0] : '';
    const text = (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40);
    return t + id + (cls ? '.' + cls : '') + (text ? ' "' + text + '"' : '');
  };
  const raw = all.filter((el) => {
    if (!el.matches || !el.matches(SEL)) return false;
    if (el.hasAttribute('disabled')) return false;
    if (el.closest && el.closest('[aria-hidden="true"]')) return false;
    if (el.closest && el.closest('[inert]')) return false;
    if (el.tagName === 'IMG' && !(el.getAttribute('alt') || '').trim()) return false;
    return isVisible(el);
  });
  // Keep only the outermost meaningful element at each point -- an <li>
  // wrapping an <a>, or a <td> wrapping a <button>, would otherwise be
  // counted twice at nearly the same position, adding noise without
  // catching anything new.
  const rawSet = new Set(raw);
  const candidates = raw.filter((el) => {
    let p = el.parentElement;
    while (p) {
      if (rawSet.has(p)) return false;
      p = p.parentElement;
    }
    return true;
  });
  return candidates.map((el) => {
    const r = el.getBoundingClientRect();
    return {
      selector: desc(el),
      snippet: '<' + el.tagName.toLowerCase() + (el.id ? ' id="' + el.id + '"' : '') + '>',
      x: Math.round(r.left),
      y: Math.round(r.top),
    };
  });
})()`;
function emptyResult(url, error) {
    return { url, itemCount: 0, orderMismatches: [], findings: [], error };
}
/**
 * Compare DOM order of a page's meaningful content against its rendered
 * (visual) position, in a single static snapshot -- no interaction needed,
 * unlike keyboard.ts's walkthrough.
 */
export async function runReadingOrderCheck(url) {
    const page = await renderPageRaw(url);
    if (!page.ok || !page.page) {
        return emptyResult(url, page.error ?? "Could not open a browser page. Playwright/Chromium is required for a reading-order check.");
    }
    try {
        const items = (await withTimeout(page.page.evaluate(EXTRACT_SCRIPT), OP_TIMEOUT_MS, "extract content order"));
        const orderMismatches = findOrderMismatches(items, (item) => item.selector, "Reading order");
        const findings = orderMismatches.map((m) => ({
            ruleId: "reading-order-mismatch",
            title: "Content order does not follow the visual layout",
            wcag: ["1.3.2"],
            level: "A",
            impact: "moderate",
            selector: m.to,
            snippet: "",
            detail: `${m.detail} (from ${m.from} to ${m.to}). Some jumps are intentional (e.g. a skip link, or a sidebar that legitimately reads after the main content) -- confirm this one is not.`,
            fix: "Match DOM order to the intended reading order. CSS layout that visually reorders content (flex/grid `order`, absolute positioning) does not reorder how assistive tech reads it linearly, even though modern browsers DO reorder sequential Tab focus to follow `order` -- these are two different sequences that can each be right or wrong independently.",
        }));
        return { url, itemCount: items.length, orderMismatches, findings };
    }
    catch (e) {
        return emptyResult(url, `Reading-order check failed: ${e?.message ?? "unknown error"}`);
    }
    finally {
        await page.close();
    }
}
