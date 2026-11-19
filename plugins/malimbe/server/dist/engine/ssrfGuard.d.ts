export declare function isBlockedHost(hostname: string): boolean;
/** Throws if `url`'s host is blocked. Malformed URLs are left to the caller's own validation. */
export declare function assertUrlAllowed(url: string): void;
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
export declare function assertRedirectChainAllowed(url: string, timeoutMs?: number): Promise<void>;
