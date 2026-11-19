import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { type StackReport } from "../engine/stack.js";
/** Detect a page's stack from one load. Exported for tests and other tools. */
export declare function detectStackForUrl(url: string, render: "auto" | "browser" | "static"): Promise<{
    ok: boolean;
    report?: StackReport;
    error?: string;
    degradedReason?: string;
}>;
export declare function registerDetectStackTool(server: McpServer): void;
