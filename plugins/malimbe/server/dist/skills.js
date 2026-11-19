import { gunzipSync } from "node:zlib";
import { z } from "zod";
import { SKILLS_BLOB } from "./generated/skillsData.js";
let cache;
export function loadSkills() {
    cache ??= JSON.parse(gunzipSync(Buffer.from(SKILLS_BLOB, "base64")).toString("utf8"));
    return cache;
}
const mime = (path) => (path.endsWith(".md") ? "text/markdown" : "text/plain");
const skillUri = (name, path = "SKILL.md") => path === "SKILL.md" ? `a11y://skills/${name}` : `a11y://skills/${name}/${path}`;
/** SKILL.md text with a note saying where its `references/...` files live on this server. */
function skillBody(skill) {
    const refs = Object.keys(skill.files).filter((p) => p !== "SKILL.md");
    if (refs.length === 0)
        return skill.files["SKILL.md"] ?? "";
    const note = [
        "",
        "---",
        "Reference files named in this skill are MCP resources on this server:",
        ...refs.map((p) => `- \`${p}\` -> \`${skillUri(skill.name, p)}\``),
    ].join("\n");
    return `${skill.files["SKILL.md"] ?? ""}\n${note}\n`;
}
export function registerSkills(server) {
    const skills = loadSkills();
    server.registerResource("skills", "a11y://skills", {
        title: "Malimbe Skills (index)",
        description: "The practitioner Skills this server provides, with the resource URI of each. Read a skill before doing the kind of work it covers.",
        mimeType: "application/json",
    }, async (uri) => ({
        contents: [
            {
                uri: uri.href,
                mimeType: "application/json",
                text: JSON.stringify(skills.map((s) => ({
                    name: s.name,
                    description: s.description,
                    uri: skillUri(s.name),
                    references: Object.keys(s.files).filter((p) => p !== "SKILL.md").map((p) => skillUri(s.name, p)),
                })), null, 2),
            },
        ],
    }));
    for (const skill of skills) {
        for (const path of Object.keys(skill.files)) {
            const isMain = path === "SKILL.md";
            server.registerResource(isMain ? `skill-${skill.name}` : `skill-${skill.name}-${path.replace(/[^a-z0-9]+/gi, "-")}`, skillUri(skill.name, path), {
                title: isMain ? `Skill: ${skill.name}` : `Skill reference: ${skill.name}/${path}`,
                description: isMain ? skill.description : `Reference file for the ${skill.name} skill.`,
                mimeType: mime(path),
            }, async (uri) => ({
                contents: [{ uri: uri.href, mimeType: mime(path), text: isMain ? skillBody(skill) : skill.files[path] ?? "" }],
            }));
        }
        // Prompts let a person load a skill by name from their client's prompt or slash-command menu.
        server.registerPrompt(skill.name, {
            title: `Skill: ${skill.name}`,
            description: skill.description,
            argsSchema: { task: z.string().optional().describe("What you want done with this skill (optional).") },
        }, ({ task }) => ({
            messages: [
                {
                    role: "user",
                    content: {
                        type: "text",
                        text: `Follow this Malimbe skill.\n\n${skillBody(skill)}${task ? `\n\nTask: ${task}` : ""}`,
                    },
                },
            ],
        }));
    }
}
