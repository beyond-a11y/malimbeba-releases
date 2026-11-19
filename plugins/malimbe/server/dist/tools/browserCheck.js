import { z } from "zod";
import { resolveBrowser } from "../engine/browser.js";
const InputSchema = z
    .object({
    install: z
        .boolean()
        .default(false)
        .describe("If true and no browser is found, auto-run `playwright install chromium` (a ~150MB download). Default false = report only."),
    response_format: z.enum(["markdown", "json"]).default("markdown"),
})
    .strict();
export function registerBrowserCheckTool(server) {
    server.registerTool("a11y_browser_check", {
        title: "Check browser readiness for audits",
        description: `Report whether Malimbe can run browser-dependent audits (axe WCAG 2.2 A+AA, rendered audits, and a11y_audit_demo's rendered path), and how to fix it if not.

Resolves a browser via the layered fallback: A11Y_BROWSER_PATH → A11Y_BROWSER_CHANNEL → a discovered Chrome/Edge install → a Playwright-managed Chromium → (optionally) auto-install. Use this before a browser audit so the agent can tell the user 'ready' or give the one-line fix, instead of surfacing a mid-audit failure.

Set install=true to provision Chromium if none is found (~150MB download). Static (non-browser) audits work regardless of the result.

Returns (json): { usable, method, executablePath?, channel?, detail, candidatesTried? }.`,
        inputSchema: InputSchema.shape,
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    }, async (args) => {
        const { install, response_format } = InputSchema.parse(args);
        const res = await resolveBrowser({ autoInstall: install });
        if (response_format === "json") {
            return {
                content: [{ type: "text", text: JSON.stringify(res, null, 2) }],
                structuredContent: res,
            };
        }
        const head = res.usable
            ? `✅ Ready for browser audits (${res.method}). ${res.detail}`
            : `⚠️ Not ready for browser audits. ${res.detail}`;
        const tried = res.candidatesTried?.length ? `\n\nChecked:\n${res.candidatesTried.map((c) => `- ${c}`).join("\n")}` : "";
        return {
            content: [{ type: "text", text: head + tried + "\n\n_Static (non-browser) audits work regardless._" }],
            structuredContent: res,
        };
    });
}
