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
/** Name of the bot-protection vendor whose challenge page this is, or null. */
export declare function detectChallenge(html: string): string | null;
/**
 * Why a loaded page must not be audited, or null when it can be. Checks the
 * challenge first so a 403 challenge names its vendor.
 */
export declare function unauditableReason(status: number | undefined, html: string): string | null;
