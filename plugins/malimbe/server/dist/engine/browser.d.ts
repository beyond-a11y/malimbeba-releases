/**
 * Chromium provisioning for Malimbe, resolved as a LAYERED FALLBACK so the
 * tool works out of the box for both individual devs and CI/locked-down setups:
 *
 *   1. A11Y_BROWSER_PATH   — explicit binary the user pointed at.
 *   2. A11Y_BROWSER_CHANNEL — reuse an installed Chrome/Edge by channel.
 *   3. Discovered           — probe the OS's usual Chrome/Edge locations (zero install).
 *   4. Playwright-managed    — a Chromium already installed via `playwright install`.
 *   5. Installed-now         — auto-run `playwright install chromium` (default; opt out with A11Y_AUTO_INSTALL=0).
 *   6. None                  — no browser; caller degrades to static and says so.
 *
 * Provisioning is LAZY (on first browser need), never at npm-install time — so
 * `npm i` stays fast and offline-safe, and the ~150MB download only happens for
 * users who actually run a browser-dependent audit.
 */
export type ResolveMethod = "path-env" | "channel-env" | "discovered" | "playwright-managed" | "installed-now" | "none";
export interface BrowserResolution {
    usable: boolean;
    method: ResolveMethod;
    executablePath?: string;
    channel?: string;
    detail: string;
    candidatesTried?: string[];
}
/**
 * Resolve a usable browser via the layered fallback.
 * @param opts.autoInstall default true unless A11Y_AUTO_INSTALL=0. Set false to
 *   report readiness WITHOUT triggering a download (used by the check tool).
 */
export declare function resolveBrowser(opts?: {
    autoInstall?: boolean;
}): Promise<BrowserResolution>;
/** Launch options for Playwright derived from a resolution. */
export declare function launchOptionsFrom(res: BrowserResolution): Record<string, unknown>;
