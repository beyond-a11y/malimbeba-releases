import { existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { platform } from "node:os";
function envList(name) {
    const v = process.env[name];
    return v ? [v] : [];
}
/** Common Chrome / Edge / Chromium install locations by OS. */
function probePaths() {
    const p = platform();
    if (p === "win32") {
        const pf = process.env["ProgramFiles"] ?? "C:\\Program Files";
        const pf86 = process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)";
        const local = process.env["LOCALAPPDATA"] ?? "";
        return [
            `${pf}\\Google\\Chrome\\Application\\chrome.exe`,
            `${pf86}\\Google\\Chrome\\Application\\chrome.exe`,
            ...(local ? [`${local}\\Google\\Chrome\\Application\\chrome.exe`] : []),
            `${pf86}\\Microsoft\\Edge\\Application\\msedge.exe`,
            `${pf}\\Microsoft\\Edge\\Application\\msedge.exe`,
        ];
    }
    if (p === "darwin") {
        return [
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
            "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
            "/Applications/Chromium.app/Contents/MacOS/Chromium",
        ];
    }
    return [
        "/usr/bin/google-chrome",
        "/usr/bin/google-chrome-stable",
        "/usr/bin/chromium",
        "/usr/bin/chromium-browser",
        "/usr/bin/microsoft-edge",
        "/snap/bin/chromium",
    ];
}
function firstExisting(paths) {
    for (const p of paths) {
        try {
            if (p && existsSync(p))
                return p;
        }
        catch {
            /* ignore */
        }
    }
    return undefined;
}
/** Path to a Chromium already managed by Playwright, if installed. */
async function playwrightManaged() {
    try {
        const pw = await import("playwright-core");
        const p = pw.chromium.executablePath();
        return p && existsSync(p) ? p : undefined;
    }
    catch {
        return undefined;
    }
}
/** Attempt `playwright install chromium`. Returns the managed path on success. */
async function autoInstall() {
    try {
        execSync("npx --yes playwright install chromium", {
            stdio: "ignore",
            timeout: 180_000,
        });
    }
    catch {
        return undefined;
    }
    return playwrightManaged();
}
const SETUP_HELP = "No usable browser found. Options: (a) install Chrome or Edge; " +
    "(b) run `npx playwright install chromium`; " +
    "(c) set A11Y_BROWSER_CHANNEL=chrome (or msedge) to reuse an installed browser; " +
    "(d) set A11Y_BROWSER_PATH to a browser binary. Static (non-browser) audits still work.";
/**
 * Resolve a usable browser via the layered fallback.
 * @param opts.autoInstall default true unless A11Y_AUTO_INSTALL=0. Set false to
 *   report readiness WITHOUT triggering a download (used by the check tool).
 */
export async function resolveBrowser(opts = {}) {
    // 1. Explicit binary.
    for (const p of envList("A11Y_BROWSER_PATH")) {
        if (existsSync(p))
            return { usable: true, method: "path-env", executablePath: p, detail: `Using A11Y_BROWSER_PATH: ${p}` };
        return { usable: false, method: "none", detail: `A11Y_BROWSER_PATH is set but does not exist: ${p}` };
    }
    // 2. Channel.
    for (const ch of envList("A11Y_BROWSER_CHANNEL")) {
        return { usable: true, method: "channel-env", channel: ch, detail: `Using A11Y_BROWSER_CHANNEL: ${ch}` };
    }
    // 3. Discover an installed Chrome/Edge (zero install).
    const candidates = probePaths();
    const found = firstExisting(candidates);
    if (found)
        return { usable: true, method: "discovered", executablePath: found, detail: `Discovered a browser at ${found}` };
    // 4. Playwright-managed Chromium.
    const managed = await playwrightManaged();
    if (managed)
        return { usable: true, method: "playwright-managed", executablePath: managed, detail: `Using Playwright-managed Chromium at ${managed}` };
    // 5. Auto-install (default on).
    const doInstall = opts.autoInstall ?? process.env["A11Y_AUTO_INSTALL"] !== "0";
    if (doInstall) {
        const installed = await autoInstall();
        if (installed)
            return { usable: true, method: "installed-now", executablePath: installed, detail: `Installed Chromium via Playwright at ${installed}` };
    }
    // 6. Nothing.
    return { usable: false, method: "none", detail: SETUP_HELP, candidatesTried: candidates };
}
/** Launch options for Playwright derived from a resolution. */
export function launchOptionsFrom(res) {
    const opts = { args: ["--no-sandbox", "--disable-dev-shm-usage"] };
    if (res.executablePath)
        opts["executablePath"] = res.executablePath;
    else if (res.channel)
        opts["channel"] = res.channel;
    return opts;
}
