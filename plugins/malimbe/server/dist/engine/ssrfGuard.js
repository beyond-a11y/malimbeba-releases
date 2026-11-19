// Blocks requests to cloud-provider instance-metadata services and other
// endpoints that should never legitimately be an accessibility-audit
// target — shared by the static-fetch path (fetch.ts, including redirect
// hops) and the real-browser path (render.ts, including redirects and
// in-page sub-resource requests the audited page itself makes).
//
// This is deliberately NOT a general "block private networks" filter:
// auditing localhost/intranet targets is a core, intentional feature (see
// engine/axe.ts's classifyTarget "internal" scope, and a11y_audit_axe's
// scope="internal"). It exists specifically to keep an agent-supplied URL
// — or a redirect, or content the audited page itself requests — from
// reaching cloud metadata services, which commonly expose credentials to
// whatever can reach them.
//
// Known remaining gap, disclosed rather than silently left: this checks
// the literal hostname/IP in the URL, not what it resolves to. A
// DNS-rebinding attack (a public-looking hostname whose A record resolves
// to 169.254.169.254) would not be caught here — closing that requires
// resolving DNS ourselves and pinning the connection to the checked IP,
// which is a larger change than this fix scope. Worth doing if this
// server is ever exposed to less-trusted input than "an agent the user is
// already running locally."
/** Exact hostnames/IPs used by cloud metadata services across major providers. */
const BLOCKED_HOSTNAMES = new Set([
    "169.254.169.254", // AWS, Azure (IMDS), DigitalOcean, Oracle Cloud, and most others
    "metadata.google.internal", // GCP
    "metadata.goog", // GCP alternate
    "100.100.100.200", // Alibaba Cloud
]);
/** The entire link-local block (169.254.0.0/16) — every major cloud's metadata
 * service lives inside it, and no legitimate "internal/intranet" audit target
 * is addressed this way. Catches variations on the canonical IP above. */
function isLinkLocalIPv4(hostname) {
    const m = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (!m)
        return false;
    return Number(m[1]) === 169 && Number(m[2]) === 254;
}
/** IPv6 link-local (fe80::/10) and AWS's IPv6 IMDS address. */
function isBlockedIPv6(hostname) {
    const h = hostname.replace(/^\[|\]$/g, "").toLowerCase();
    return h.startsWith("fe80:") || h === "fd00:ec2::254";
}
export function isBlockedHost(hostname) {
    const h = hostname.toLowerCase().replace(/\.$/, "");
    return BLOCKED_HOSTNAMES.has(h) || isLinkLocalIPv4(h) || isBlockedIPv6(h);
}
/** Throws if `url`'s host is blocked. Malformed URLs are left to the caller's own validation. */
export function assertUrlAllowed(url) {
    let parsed;
    try {
        parsed = new URL(url);
    }
    catch {
        return;
    }
    if (isBlockedHost(parsed.hostname)) {
        throw new Error(`Refused: ${parsed.hostname} is a cloud metadata / link-local endpoint and cannot be audited.`);
    }
}
const MAX_REDIRECT_HOPS = 10;
/**
 * Validates every hop of a URL's redirect chain against the blocklist above,
 * WITHOUT downloading any response body — a pre-flight check for the
 * real-browser path (render.ts), used before page.goto() ever runs.
 *
 * Why this exists on top of render.ts's guardPage() page.route()
 * interception: confirmed live (real Chromium 151 via playwright-core
 * 1.62.1, and separately real Microsoft Edge) that Chromium does not
 * re-invoke Playwright's route handler for a server-side redirect
 * encountered during a top-level navigation — route() fires once for the
 * original URL and never again for the hop the browser follows natively,
 * so a same-origin-looking page that 302s to a blocked host sails straight
 * through. Verified with three interception strategies before concluding
 * this isn't fixable purely at the JS-interception level: bare
 * page.route()+route.abort(), CDP Network.setBlockedURLs (also silently
 * doesn't apply to the main-frame redirect), and manually resolving each
 * hop via route.fetch()+route.fulfill() (blocks correctly, but breaks
 * page.url() and relative-resource resolution against the real final URL —
 * a worse bug for real sites that redirect into a different path, which is
 * common). Validating the whole chain out-of-band before ever calling
 * page.goto() sidesteps the gap entirely: the browser is never asked to
 * navigate toward a blocked host in the first place, and once cleared,
 * native navigation keeps URL/relative-resource semantics correct.
 * guardPage()'s route() check stays as defense-in-depth for the initial
 * URL and same-hop resource requests the page's own content issues
 * directly (not a redirect of an existing request).
 *
 * Known residual gap, same class as the DNS-rebinding one disclosed above:
 * this check and the real navigation are two separate connections, so a
 * server could in principle answer them differently (e.g. by User-Agent)
 * to redirect the check somewhere benign while redirecting the real
 * browser request to a blocked host. Narrower than having no redirect
 * protection at all, but not closed by this fix.
 */
export async function assertRedirectChainAllowed(url, timeoutMs = 10000) {
    let current;
    try {
        current = new URL(url);
    }
    catch {
        return; // malformed URL: left to the caller's own validation, same convention as assertUrlAllowed
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
        for (let i = 0; i <= MAX_REDIRECT_HOPS; i++) {
            assertUrlAllowed(current.href);
            const res = await fetch(current.href, {
                redirect: "manual",
                signal: ctrl.signal,
                headers: { "user-agent": "accessibility-mcp-server/0.2 (+a11y-audit)" },
            });
            try {
                await res.body?.cancel();
            }
            catch {
                /* best-effort — nothing more to validate once status/headers are read */
            }
            const isRedirect = res.status >= 300 && res.status < 400 && res.headers.has("location");
            if (!isRedirect)
                return;
            const next = new URL(res.headers.get("location"), current);
            if (next.protocol !== "http:" && next.protocol !== "https:") {
                throw new Error(`Redirected to unsupported protocol: ${next.protocol}`);
            }
            current = next;
        }
        throw new Error("Too many redirects");
    }
    finally {
        clearTimeout(timer);
    }
}
