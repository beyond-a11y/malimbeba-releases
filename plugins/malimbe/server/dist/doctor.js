#!/usr/bin/env node
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { resolveBrowser } from "./engine/browser.js";
import { SERVER_VERSION } from "./constants.js";
/**
 * Preflight: report whether Malimbe by Beyond-A11y can run browser-dependent audits, and how
 * to fix it if not. Reports by default; pass --fix (or --install) to auto-run
 * `playwright install chromium`. --json for machine-readable output.
 *
 *   node dist/doctor.js            # status only
 *   node dist/doctor.js --fix      # provision a browser if none is found
 *   node dist/doctor.js --json
 *
 * Also prints a ready-to-paste MCP config using THIS install's own resolved
 * path — never a placeholder. A bare "command": "malimbeba" is NOT safe to
 * recommend generally: many MCP clients spawn commands directly (no shell),
 * and on Windows that fails outright — spawn('malimbeba') can't resolve the
 * .cmd wrapper (ENOENT), and spawn('malimbeba.cmd') can't be launched without
 * a shell either (EINVAL). "node" + an absolute path to dist/index.js is the
 * one form that works unconditionally, on every OS and every client.
 */
const args = new Set(process.argv.slice(2));
const fix = args.has("--fix") || args.has("--install");
const json = args.has("--json");
const entryPath = join(dirname(fileURLToPath(import.meta.url)), "index.js");
const mcpConfig = {
    mcpServers: {
        malimbeba: { command: "node", args: [entryPath] },
    },
};
const uiHint = "Prefer a browser only, with no coding agent? Run `malimbeba-ui` and open http://127.0.0.1:4173";
const res = await resolveBrowser({ autoInstall: fix });
if (json) {
    console.log(JSON.stringify({ version: SERVER_VERSION, mcpConfig, uiHint, ...res }, null, 2));
    process.exit(res.usable ? 0 : 1);
}
const mark = res.usable ? "✅" : "⚠️ ";
console.log(`Malimbe by Beyond-A11y ${SERVER_VERSION} — browser readiness\n`);
console.log(`${mark} ${res.usable ? "Ready" : "Not ready"} for browser-dependent audits (axe WCAG 2.2 A+AA, rendered audits).`);
console.log(`   Method: ${res.method}`);
console.log(`   ${res.detail}`);
if (res.usable) {
    console.log(`\nStatic (non-browser) audits are always available regardless.`);
}
else {
    if (!fix)
        console.log(`\nRe-run with --fix to auto-install Chromium, or follow one of the options above.`);
    if (res.candidatesTried?.length) {
        console.log(`\nLocations checked:`);
        for (const c of res.candidatesTried)
            console.log(`   - ${c}`);
    }
    console.log(`\nStatic (non-browser) audits still work in the meantime.`);
}
console.log(`\nYour MCP config (paste as-is — the path below is already resolved for this install):`);
console.log(JSON.stringify(mcpConfig, null, 2));
console.log(`\n${uiHint}`);
process.exit(res.usable ? 0 : 1);
