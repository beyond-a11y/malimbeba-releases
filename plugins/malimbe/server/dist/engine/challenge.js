/**
 * Bot-protection challenge detection.
 *
 * A challenge or block page can arrive with HTTP 200. Auditing it as the site
 * produces a confident, wrong result (a crawl of ryan.com's Imperva challenge
 * reported PASS). Each signature here is chosen to match the challenge page
 * only: several vendors inject scripts on every normal page too (Cloudflare's
 * /cdn-cgi/challenge-platform/ JS detections, Imperva's /_Incapsula_Resource
 * script), so those markers alone are deliberately NOT signatures.
 */
const SIGNATURES = [
    // Imperva: the challenge page is a full-height iframe onto _Incapsula_Resource.
    { vendor: "Imperva (Incapsula)", test: /<iframe[^>]+src=["']?\/_Incapsula_Resource|Incapsula incident ID/i },
    // Cloudflare: the challenge options object and title exist only on challenge pages.
    { vendor: "Cloudflare", test: /window\._cf_chl_opt|<title>\s*Just a moment\.\.\.\s*<\/title>|<title>\s*Attention Required! \| Cloudflare\s*<\/title>/i },
    // DataDome: block pages load the captcha from captcha-delivery.com.
    { vendor: "DataDome", test: /\bgeo\.captcha-delivery\.com|\bct\.captcha-delivery\.com/i },
    // HUMAN (PerimeterX): the block page renders a #px-captcha container.
    { vendor: "HUMAN (PerimeterX)", test: /id=["']px-captcha["']/i },
    // Akamai Bot Manager interstitial.
    { vendor: "Akamai", test: /id=["']sec-if-cpt-container["']|<title>\s*Access Denied\s*<\/title>[\s\S]*errors\.edgesuite\.net/i },
    // AWS WAF challenge / CAPTCHA action.
    { vendor: "AWS WAF", test: /window\.gokuProps\s*=/i },
    // Sucuri firewall block page.
    { vendor: "Sucuri", test: /<title>\s*Sucuri WebSite Firewall/i },
    // Shopify's edge challenge (seen 2026-11-18 after repeated requests).
    { vendor: "Shopify", test: /<title>[^<]*Verifying your connection/i },
];
/** Name of the bot-protection vendor whose challenge page this is, or null. */
export function detectChallenge(html) {
    if (!html)
        return null;
    for (const s of SIGNATURES)
        if (s.test.test(html))
            return s.vendor;
    return null;
}
/**
 * Why a loaded page must not be audited, or null when it can be. Checks the
 * challenge first so a 403 challenge names its vendor.
 */
export function unauditableReason(status, html) {
    const vendor = detectChallenge(html);
    if (vendor) {
        return `Bot protection (${vendor}) served a challenge page${status ? ` (HTTP ${status})` : ""} instead of the site, so it was not audited.`;
    }
    if ((status ?? 200) >= 400)
        return `HTTP ${status}: the page returned an error, so it was not audited.`;
    return null;
}
