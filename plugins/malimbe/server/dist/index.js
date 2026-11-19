#!/usr/bin/env node
/*!
 * Malimbe by Beyond-A11y (malimbeba) — Copyright (c) 2026 Beyond-A11y, LLC. All rights reserved.
 * Proprietary and confidential. Licensed, not sold. See the LICENSE file for terms.
 * Redistribution or resale is prohibited except as expressly permitted in writing.
 * info@beyond-a11y.com — https://beyond-a11y.com
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { POLICY_VERSION, SERVER_NAME, SERVER_VERSION } from "./constants.js";
import { policyFingerprint } from "./engine/evidence.js";
import { registerAuditTool } from "./tools/audit.js";
import { registerGuidanceTool } from "./tools/guidance.js";
import { registerPromptTool } from "./tools/prompt.js";
import { registerUxGuidanceTool } from "./tools/uxGuidance.js";
import { UX_REVIEW, UX_SOURCES, UX_TOPICS } from "./rules/ux-guidance.js";
import { registerHandoffSpecTool } from "./tools/handoffSpec.js";
import { registerAuditPromptTool } from "./tools/auditPrompt.js";
import { registerGateTool } from "./tools/gate.js";
import { registerChecklistTool } from "./tools/checklist.js";
import { registerAuditUrlTool } from "./tools/auditUrl.js";
import { registerCrawlAuditTool } from "./tools/crawlAudit.js";
import { registerDetectStackTool } from "./tools/detectStack.js";
import { registerAxeAuditTool } from "./tools/auditAxe.js";
import { registerKeyboardAuditTool } from "./tools/auditKeyboard.js";
import { registerReadingOrderAuditTool } from "./tools/auditReadingOrder.js";
import { registerScreenReaderAuditTool } from "./tools/auditScreenReader.js";
import { registerStatusMessagesAuditTool } from "./tools/auditStatusMessages.js";
import { registerManifestTools } from "./tools/library.js";
import { registerAuditDemoTool } from "./tools/auditDemo.js";
import { registerBrowserCheckTool } from "./tools/browserCheck.js";
import { RULES } from "./rules/wcag-rules.js";
import { EXTERNAL_REFERENCES } from "./rules/sources.js";
import { closeBrowser } from "./engine/render.js";
import { getEntitlement } from "./trial.js";
import { registerSkills } from "./skills.js";
import { DECISION_HIERARCHY, DEFINITION_OF_DONE, ENFORCEMENT_PRINCIPLES, OBJECTIVE, IMPLEMENTATION_CHECKLIST, NON_NEGOTIABLES, RELEASE_LIFECYCLE, REQUIRED_GATES, RISK_TIERS, PROVENANCE_TIERS, SUCCESS_CRITERIA, } from "./policy/policy.js";
function createServer() {
    const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });
    registerAuditTool(server);
    registerGuidanceTool(server);
    registerUxGuidanceTool(server);
    registerPromptTool(server);
    registerHandoffSpecTool(server);
    registerAuditPromptTool(server);
    registerGateTool(server);
    registerChecklistTool(server);
    registerAuditUrlTool(server);
    registerCrawlAuditTool(server);
    registerDetectStackTool(server);
    registerAxeAuditTool(server);
    registerKeyboardAuditTool(server);
    registerReadingOrderAuditTool(server);
    registerScreenReaderAuditTool(server);
    registerStatusMessagesAuditTool(server);
    registerManifestTools(server);
    registerAuditDemoTool(server);
    registerBrowserCheckTool(server);
    // The Skills are served by the server (resources and prompts), not shipped as loose files,
    // so they sit behind the same trial and paid-code gate as the tools.
    registerSkills(server);
    // Expose the release policy so clients, CI, and the UI read one source of truth.
    server.registerResource("policy", "a11y://policy", {
        title: "Accessibility release policy",
        description: "Enforcement principles, decision hierarchy, non-negotiable rules, and release lifecycle.",
        mimeType: "application/json",
    }, async (uri) => ({
        contents: [
            {
                uri: uri.href,
                mimeType: "application/json",
                text: JSON.stringify({
                    policyVersion: POLICY_VERSION,
                    policyFingerprint: policyFingerprint(),
                    objective: OBJECTIVE,
                    enforcementPrinciples: ENFORCEMENT_PRINCIPLES,
                    decisionHierarchy: DECISION_HIERARCHY,
                    nonNegotiables: NON_NEGOTIABLES,
                    definitionOfDone: DEFINITION_OF_DONE,
                    requiredGates: REQUIRED_GATES,
                    riskTiers: RISK_TIERS,
                    provenanceTiers: PROVENANCE_TIERS,
                    successCriteria: SUCCESS_CRITERIA,
                    implementationChecklist: IMPLEMENTATION_CHECKLIST,
                    releaseLifecycle: RELEASE_LIFECYCLE,
                }, null, 2),
            },
        ],
    }));
    // Expose the ruleset itself so clients and the eventual UI can read/govern it.
    server.registerResource("ruleset", "a11y://ruleset", {
        title: "Accessibility ruleset",
        description: "The full WCAG 2.1 A/AA static ruleset this server enforces.",
        mimeType: "application/json",
    }, async (uri) => ({
        contents: [
            {
                uri: uri.href,
                mimeType: "application/json",
                text: JSON.stringify(RULES.map(({ check, ...meta }) => meta), null, 2),
            },
        ],
    }));
    // Curated practical references (working examples, technique guides,
    // content/design guidance) alongside the normative specs already cited in
    // generated prompts — so an agent that reads resources directly, not just
    // the prompts a11y_build_prompt produces, still gets pointed at them.
    server.registerResource("references", "a11y://references", {
        title: "Accessibility practical references",
        description: "Curated external references for building or testing accessible UI: working examples, technique guides, and content/design guidance — distinct from the normative specs (WCAG, WAI-ARIA, APG) cited elsewhere.",
        mimeType: "application/json",
    }, async (uri) => ({
        contents: [
            {
                uri: uri.href,
                mimeType: "application/json",
                text: JSON.stringify(EXTERNAL_REFERENCES, null, 2),
            },
        ],
    }));
    server.registerResource("ux-guidance", "a11y://ux-guidance", {
        title: "UX best-practice guidance",
        description: "Source-cited UX guidance (heuristics, forms, navigation, feedback, WCAG 2.2 interaction, performance, visual design, motion, AI, research) with confidence labels and a 6-month review date.",
        mimeType: "application/json",
    }, async (uri) => ({
        contents: [
            {
                uri: uri.href,
                mimeType: "application/json",
                text: JSON.stringify({ review: UX_REVIEW, topics: UX_TOPICS, sources: UX_SOURCES }, null, 2),
            },
        ],
    }));
    return server;
}
async function main() {
    const entitlement = getEntitlement();
    if (!entitlement.allowed) {
        console.error(entitlement.message);
        process.exitCode = 1;
        return;
    }
    if (!entitlement.licensed)
        console.error(entitlement.message);
    const server = createServer();
    const transport = new StdioServerTransport();
    const shutdown = async () => {
        try {
            await closeBrowser();
        }
        catch { /* best effort */ }
        process.exit(0);
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
    // When the client goes away, stdin closes. Launch wrappers (npx, cmd /c)
    // don't forward signals to this process, so without this the server and
    // its browser outlive the client.
    process.stdin.on("end", shutdown);
    process.stdin.on("close", shutdown);
    await server.connect(transport);
    // stderr is safe for logs; stdout is reserved for the JSON-RPC stream.
    console.error(`${SERVER_NAME} v${SERVER_VERSION} running on stdio`);
}
if (process.argv[2] === "doctor") {
    await import("./doctor.js");
}
else {
    main().catch((err) => {
        console.error("Fatal:", err);
        process.exit(1);
    });
}
