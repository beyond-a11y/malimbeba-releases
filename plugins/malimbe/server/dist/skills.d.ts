import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
/**
 * The Skills, served by the server instead of shipped as loose files. They are available only
 * while the server runs, which means only during the trial or with a paid validation code.
 */
export interface Skill {
    name: string;
    description: string;
    files: Record<string, string>;
}
export declare function loadSkills(): Skill[];
export declare function registerSkills(server: McpServer): void;
