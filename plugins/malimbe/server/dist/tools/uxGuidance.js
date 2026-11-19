import { z } from "zod";
import { UX_REVIEW, UX_SOURCE_INDEX, UX_TOPICS, UX_TOPIC_INDEX, reviewStatus, selectTopics, } from "../rules/ux-guidance.js";
const TOPIC_IDS = UX_TOPICS.map((t) => t.id);
const InputSchema = z
    .object({
    task: z
        .string()
        .optional()
        .describe('What you are building or reviewing, e.g. "a checkout form" or "settings page". Used to pick the relevant topics.'),
    topic: z
        .string()
        .optional()
        .describe(`A specific topic to return instead of auto-selecting. Available: ${TOPIC_IDS.join(", ")}, or "all".`),
    mode: z
        .enum(["build", "review"])
        .default("build")
        .describe("'build' returns rules to apply before writing UI; 'review' adds questions to ask of an existing design or implementation."),
    response_format: z.enum(["markdown", "json"]).default("markdown"),
})
    .strict();
function topicToMarkdown(t, mode) {
    const lines = [`## ${t.title} [${t.confidence}]`, "", t.summary, "", ...t.rules.map((r) => `- ${r}`)];
    if (t.tensions?.length) {
        lines.push("", "**Where sources disagree or are incomplete:**", ...t.tensions.map((x) => `- ${x}`));
    }
    if (t.wcag?.length)
        lines.push("", `WCAG: ${t.wcag.join(", ")}`);
    if (mode === "review") {
        lines.push("", "**Review questions:**", ...t.reviewQuestions.map((q) => `- ${q}`));
    }
    const sources = t.sources
        .map((id) => UX_SOURCE_INDEX.get(id))
        .filter((s) => Boolean(s))
        .map((s) => `[${s.publisher}: ${s.title}](${s.url}) (${s.status === "fetched" ? "read in full" : "partly read"})`);
    lines.push("", `Sources: ${sources.join("; ")}`);
    return lines.join("\n");
}
export function registerUxGuidanceTool(server) {
    server.registerTool("a11y_ux_guidance", {
        title: "Get UX best-practice guidance",
        description: `Return current, source-cited UX best practices for what you are building or reviewing — usability heuristics, forms and validation, navigation, feedback and error recovery, WCAG 2.2 interaction requirements, performance, visual direction and responsive design systems, motion and animation, AI features, and research — so quality UI and accessibility come from one place. Complements a11y_component_guidance (which gives one component's ARIA contract).

Use this BEFORE designing a flow or screen, and again when reviewing UI for usability. Each topic carries a confidence label (stable / standard / emerging), the sources it rests on and whether they were read in full, and places where sources disagree. The guidance is reviewed on a 6-month cycle; the response states whether the review is overdue.

Args:
  - task (string, optional): what you are building or reviewing; relevant topics are selected from it.
  - topic (string, optional): one of ${TOPIC_IDS.join(", ")}, or "all". Overrides task selection.
  - mode ('build' | 'review'): default 'build'; 'review' adds review questions.
  - response_format ('markdown' | 'json'): default 'markdown'.

Returns (json): { review: { lastReviewed, nextReviewDue, stale, message }, topics: [{ id, title, confidence, summary, rules, tensions, reviewQuestions, wcag, sources }] }.

Automated and heuristic guidance is necessary, not sufficient: it does not replace testing with real users and assistive technology.`,
        inputSchema: InputSchema.shape,
        annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false,
        },
    }, async (args) => {
        const { task, topic, mode, response_format } = InputSchema.parse(args);
        let topics;
        if (topic) {
            const key = topic.trim().toLowerCase();
            if (key === "all") {
                topics = UX_TOPICS;
            }
            else {
                const found = UX_TOPIC_INDEX.get(key);
                if (!found) {
                    return {
                        content: [{ type: "text", text: `No UX topic "${topic}". Available: ${TOPIC_IDS.join(", ")}, or "all".` }],
                    };
                }
                topics = [found];
            }
        }
        else if (task && task.trim().length >= 2) {
            topics = selectTopics(task);
        }
        else {
            return {
                content: [
                    {
                        type: "text",
                        text: `Provide \`task\` or \`topic\`. Available topics: ${TOPIC_IDS.join(", ")}, or "all".`,
                    },
                ],
            };
        }
        const status = reviewStatus();
        const review = { ...UX_REVIEW, stale: status.stale, message: status.message };
        const payload = {
            review,
            topics: topics.map((t) => ({
                id: t.id,
                title: t.title,
                confidence: t.confidence,
                summary: t.summary,
                rules: t.rules,
                tensions: t.tensions ?? [],
                reviewQuestions: mode === "review" ? t.reviewQuestions : [],
                wcag: t.wcag ?? [],
                sources: t.sources
                    .map((id) => UX_SOURCE_INDEX.get(id))
                    .filter((s) => Boolean(s)),
            })),
        };
        const structured = payload;
        if (response_format === "json") {
            return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }], structuredContent: structured };
        }
        const header = `# UX guidance${task ? ` for: ${task.trim()}` : ""}\n\n${status.stale ? "**Warning:** " : ""}${status.message}\n`;
        const footer = "\n---\nThis is guidance, not proof of usability. Say which of keyboard-flow, screen-reader, cognitive, and real-user testing you did not perform.";
        return {
            content: [{ type: "text", text: header + "\n" + topics.map((t) => topicToMarkdown(t, mode)).join("\n\n") + footer }],
            structuredContent: structured,
        };
    });
}
