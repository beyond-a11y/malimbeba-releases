import { renderPageRaw, withTimeout } from "./render.js";
/**
 * The gap this closes: WCAG 4.1.3 (Status Messages) requires that a
 * content change communicating something to the user -- a result count,
 * a save confirmation, an error, a live update -- be programmatically
 * determinable (a live region) so it reaches a screen-reader user even
 * when they are not looking at (or focused on) that part of the page.
 * Every other audit tool in this codebase inspects one static snapshot;
 * this is the second tool (after keyboard.ts) that has to watch a page
 * over TIME rather than just read it once.
 *
 * Two design points came directly from the product owner, not assumed:
 *
 * 1. Not every change that should alert the user follows a click. An
 *    auto-rotating carousel, a polling counter, a session-timeout
 *    warning, or a server-push update (a chat message, a live score) all
 *    change the page with NO clickable trigger element at all -- there is
 *    nothing to hand a trigger_selector. So passive observation (watch
 *    what changes on its own, no interaction) is the DEFAULT and always
 *    runs; an explicit trigger is optional and additive, never required.
 *    This also sidesteps the safety question a click-based-only design
 *    would force: this tool never has to guess what is safe to click on
 *    a live external site, because clicking is opt-in only, via a
 *    caller-supplied selector, never auto-discovered.
 *
 * 2. Whether a change close to a trigger is close enough that a user
 *    would naturally notice it without an announcement is not something
 *    this tool can determine as fact -- screen size, zoom, layout, and
 *    attention all vary, and asserting a hard proximity cutoff would be
 *    a fabricated authority this tool does not have. So it computes the
 *    one thing that IS reliably computable -- the actual geometric
 *    distance and viewport visibility -- states that measurement plainly,
 *    and flags for MANUAL REVIEW rather than asserting a violation. The
 *    distance threshold below is a labeled, adjustable heuristic for what
 *    is worth surfacing prominently, not a WCAG-verified boundary; every
 *    un-announced change is reported regardless, with the reasoning
 *    stated so a human can judge it.
 */
const OP_TIMEOUT_MS = 20_000;
/** A heuristic default, not an authoritative cutoff -- see point 2 above.
 *  Roughly a generous "same general area of the screen" distance at the
 *  1280x900 viewport every render.ts caller uses. */
const DETACHED_DISTANCE_PX = 500;
const SETUP_OBSERVER_SCRIPT = `(() => {
  const isLive = (el) => {
    let n = el;
    while (n && n.nodeType === 1) {
      const role = (n.getAttribute && n.getAttribute('role') || '').toLowerCase();
      if (role === 'alert' || role === 'status' || role === 'log') return true;
      const live = n.getAttribute && n.getAttribute('aria-live');
      if (live && live.toLowerCase() !== 'off') return true;
      n = n.parentElement || (n.getRootNode && n.getRootNode().host);
    }
    return false;
  };
  const isVisible = (el) => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.visibility === 'collapse') return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const desc = (el) => {
    const t = el.tagName.toLowerCase();
    const id = el.id ? '#' + el.id : '';
    const cls = !id ? (el.getAttribute('class') || '').trim().split(/\s+/)[0] : '';
    const text = (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60);
    return t + id + (cls ? '.' + cls : '') + (text ? ' "' + text + '"' : '');
  };

  window.__a11yStatusPhase = 'passive';
  window.__a11yStatusEvents = [];
  const seenThisPhase = new Set();

  const record = (el) => {
    if (!el || el.nodeType !== 1 || !isVisible(el)) return;
    if (seenThisPhase.has(el)) return;
    seenThisPhase.add(el);
    const r = el.getBoundingClientRect();
    window.__a11yStatusEvents.push({
      phase: window.__a11yStatusPhase,
      selector: desc(el),
      snippet: '<' + el.tagName.toLowerCase() + (el.id ? ' id="' + el.id + '"' : '') + '>',
      live: isLive(el),
      x: Math.round(r.left + r.width / 2),
      y: Math.round(r.top + r.height / 2),
      inViewport: r.top < window.innerHeight && r.bottom > 0 && r.left < window.innerWidth && r.right > 0,
    });
  };

  window.__a11yStatusResetPhase = (phase) => {
    window.__a11yStatusPhase = phase;
    seenThisPhase.clear();
  };

  const observer = new MutationObserver((records) => {
    for (const rec of records) {
      if (rec.type === 'childList') {
        rec.addedNodes.forEach((node) => { if (node.nodeType === 1) record(node); else if (node.nodeType === 3) record(rec.target); });
      } else {
        const el = rec.target.nodeType === 1 ? rec.target : rec.target.parentElement;
        record(el);
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, characterData: true });
  window.__a11yStatusObserver = observer;
})()`;
const RESET_PHASE_SCRIPT = (phase) => `window.__a11yStatusResetPhase(${JSON.stringify(phase)})`;
const TRIGGER_RECT_SCRIPT = (selector) => `(() => {
  const el = document.querySelector(${JSON.stringify(selector)});
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
})()`;
const COLLECT_SCRIPT = `(() => {
  if (window.__a11yStatusObserver) window.__a11yStatusObserver.disconnect();
  return window.__a11yStatusEvents || [];
})()`;
function distance(a, b) {
    return Math.round(Math.hypot(a.x - b.x, a.y - b.y));
}
function emptyResult(url, error) {
    return { url, triggered: false, autonomousChanges: 0, triggeredChanges: 0, findings: [], error };
}
export async function runStatusMessageCheck(url, opts = {}) {
    const observeMs = Math.min(Math.max(opts.observeMs ?? 4000, 500), 15000);
    // No idle wait: autonomous changes right after load are what this check observes.
    const page = await renderPageRaw(url, undefined, { settle: false });
    if (!page.ok || !page.page) {
        return emptyResult(url, page.error ?? "Could not open a browser page. Playwright/Chromium is required for a status-message check.");
    }
    try {
        await withTimeout(page.page.evaluate(SETUP_OBSERVER_SCRIPT), OP_TIMEOUT_MS, "install mutation observer");
        await page.page.waitForTimeout(observeMs);
        let triggered = false;
        let triggerPoint = null;
        if (opts.triggerSelector) {
            triggerPoint = (await withTimeout(page.page.evaluate(TRIGGER_RECT_SCRIPT(opts.triggerSelector)), OP_TIMEOUT_MS, "locate trigger"));
            if (triggerPoint) {
                await withTimeout(page.page.evaluate(RESET_PHASE_SCRIPT("post-trigger")), OP_TIMEOUT_MS, "reset phase");
                await page.page.click(opts.triggerSelector, { timeout: OP_TIMEOUT_MS });
                triggered = true;
                await page.page.waitForTimeout(observeMs);
            }
        }
        const events = (await withTimeout(page.page.evaluate(COLLECT_SCRIPT), OP_TIMEOUT_MS, "collect observed events"));
        const findings = [];
        let autonomousChanges = 0;
        let triggeredChanges = 0;
        for (const event of events) {
            if (event.phase === "passive")
                autonomousChanges++;
            else
                triggeredChanges++;
            if (event.live)
                continue;
            if (event.phase === "passive") {
                findings.push({
                    ruleId: "status-message-autonomous-unannounced",
                    title: "Content changed on its own without a live region",
                    wcag: ["4.1.3"],
                    level: "AA",
                    impact: "serious",
                    selector: event.selector,
                    snippet: event.snippet,
                    detail: `${event.selector} changed during passive observation, with no preceding interaction (a timer, polling, animation, or server-pushed update, not a click) -- and is not inside a live region. A user could be looking anywhere on the page when this happens, so it cannot rely on being visually noticed. Flagged for manual review, not asserted as a violation.`,
                    fix: `If this change communicates something to the user (a result, an update, an error, a status), wrap it in role="status" (or "alert" for urgent/time-sensitive messages) or add aria-live so assistive tech announces it regardless of where attention is focused.`,
                });
                continue;
            }
            const dist = triggerPoint ? distance(triggerPoint, { x: event.x, y: event.y }) : null;
            const reasonParts = [];
            if (!event.inViewport) {
                reasonParts.push("it changed entirely outside the visible viewport at the time");
            }
            else if (dist !== null && dist > DETACHED_DISTANCE_PX) {
                reasonParts.push(`it is ${dist}px from the triggering element (beyond this tool default of ${DETACHED_DISTANCE_PX}px -- a heuristic worth a closer look, not a verified cutoff)`);
            }
            else {
                reasonParts.push(dist !== null ? `it is ${dist}px from the triggering element, on-screen` : "its distance from the trigger could not be measured");
            }
            findings.push({
                ruleId: "status-message-detached-unannounced",
                title: "Content changed after an interaction without a live region",
                wcag: ["4.1.3"],
                level: "AA",
                impact: !event.inViewport || (dist !== null && dist > DETACHED_DISTANCE_PX) ? "serious" : "moderate",
                selector: event.selector,
                snippet: event.snippet,
                detail: `${event.selector} changed after the trigger was activated, and is not inside a live region. Flagged for manual review because ${reasonParts.join("; ")} -- whether the change would actually be noticed without an announcement is a judgment call this check cannot make on its own; the measurement above is offered so a reviewer can.`,
                fix: `If this change communicates something to the user, wrap it in role="status"/"alert" or add aria-live. If it sits right next to the trigger (e.g. inline validation beside the field), a live region is still the more robust fix, since visual proximity alone does not guarantee assistive-tech users perceive it either.`,
            });
        }
        return { url, triggered, autonomousChanges, triggeredChanges, findings };
    }
    catch (e) {
        return emptyResult(url, `Status-message check failed: ${e?.message ?? "unknown error"}`);
    }
    finally {
        await page.close();
    }
}
