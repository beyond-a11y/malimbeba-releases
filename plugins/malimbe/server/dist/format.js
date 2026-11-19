import { CHARACTER_LIMIT } from "./constants.js";
/**
 * `reserve` raises the effective budget above CHARACTER_LIMIT for callers
 * that deliberately embedded a large, already-size-gated blob (e.g. a
 * screenshot data: URI up to MAX_INLINE_IMAGE_DATA_URI_LENGTH) \u2014 without it,
 * clamp's default 20,000-char budget would slice through the base64 partway
 * in, both corrupting the image into a broken data: URI and discarding
 * everything after it (the rest of the prompt). Ordinary text-only callers
 * pass no `reserve` and keep the original behavior exactly.
 */
export function clamp(text, reserve = 0) {
    const limit = CHARACTER_LIMIT + Math.max(0, reserve);
    return text.length > limit
        ? text.slice(0, limit) + "\n\n\u2026 (truncated)"
        : text;
}
export function urlAuditToMarkdown(url, finalUrl, result) {
    const head = `# Accessibility audit — ${url}` + (finalUrl && finalUrl !== url ? `\n(resolved to ${finalUrl})` : "");
    return clamp(head + "\n\n" + auditToMarkdown(result));
}
export function aggregateCrawl(pages, requested) {
    const byImpact = { critical: 0, serious: 0, moderate: 0, minor: 0 };
    const ruleCounts = new Map();
    const pagesWithCritical = [];
    let totalFindings = 0;
    let pagesAudited = 0;
    let pagesFailed = 0;
    for (const p of pages) {
        if (!p.ok || !p.result) {
            pagesFailed++;
            continue;
        }
        pagesAudited++;
        let critHere = 0;
        for (const f of p.result.findings) {
            totalFindings++;
            byImpact[f.impact]++;
            if (f.impact === "critical")
                critHere++;
            const rec = ruleCounts.get(f.ruleId) ?? { title: f.title, count: 0 };
            rec.count++;
            ruleCounts.set(f.ruleId, rec);
        }
        if (critHere > 0)
            pagesWithCritical.push(p.url);
    }
    const topRules = [...ruleCounts.entries()]
        .map(([ruleId, v]) => ({ ruleId, title: v.title, count: v.count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8);
    return {
        pagesRequested: requested,
        pagesVisited: pages.length,
        pagesAudited,
        pagesFailed,
        totalFindings,
        byImpact,
        pagesWithCritical,
        topRules,
        verdict: byImpact.critical > 0 ? "BLOCKED" : pagesAudited === 0 || pagesFailed > 0 ? "INCOMPLETE" : "PASS",
    };
}
export function crawlToMarkdown(startUrl, pages, agg) {
    const verdictLine = agg.verdict === "BLOCKED"
        ? `## ⛔ ${agg.byImpact.critical} critical defect(s) across the crawl — release BLOCKED`
        : agg.verdict === "INCOMPLETE"
            ? agg.pagesAudited === 0
                ? `## ⚠️ No pages could be audited — verdict INCOMPLETE, not a pass`
                : `## ⚠️ No critical defects on the ${agg.pagesAudited} page(s) audited, but ${agg.pagesFailed} could not be audited — verdict INCOMPLETE`
            : `## ✅ No critical defects found across the crawl`;
    const summary = `# Crawl audit — ${startUrl}\n\n${verdictLine}\n\n` +
        `Audited **${agg.pagesAudited}** page(s) (requested up to ${agg.pagesRequested}` +
        `${agg.pagesFailed ? `, ${agg.pagesFailed} unreachable` : ""}). ` +
        `**${agg.totalFindings}** total issue(s): ${agg.byImpact.critical} critical, ${agg.byImpact.serious} serious, ${agg.byImpact.moderate} moderate, ${agg.byImpact.minor} minor.`;
    const topRules = agg.topRules.length
        ? "\n\n**Most common issues:**\n" +
            agg.topRules.map((r) => `- ${r.title} (\`${r.ruleId}\`) — ${r.count}×`).join("\n")
        : "";
    const critPages = agg.pagesWithCritical.length
        ? "\n\n**Pages with critical defects:**\n" + agg.pagesWithCritical.map((u) => `- ${u}`).join("\n")
        : "";
    const perPage = "\n\n**Per page:**\n" +
        pages
            .map((p) => {
            if (!p.ok || !p.result)
                return `- ⚠️ ${p.url} — ${p.error || "unreachable"}`;
            const s = p.result.summary;
            const mark = s.byImpact.critical > 0 ? "⛔" : s.total > 0 ? "•" : "✅";
            const moved = p.finalUrl ? ` (landed on ${p.finalUrl})` : "";
            return `- ${mark} ${p.url}${moved} — ${s.total} issue(s) (${s.byImpact.critical}C/${s.byImpact.serious}S/${s.byImpact.moderate}M/${s.byImpact.minor}m)`;
        })
            .join("\n");
    return clamp(summary + topRules + critPages + perPage);
}
export function auditToMarkdown(result) {
    const { summary, findings } = result;
    if (summary.passed) {
        return `✅ No violations found across ${summary.rulesChecked} rules. Note: static analysis cannot verify contrast without rendering, dynamic behavior, or actual screen-reader output — treat a clean result as necessary, not sufficient.`;
    }
    const head = `Found **${summary.total}** issue(s) across ${summary.rulesChecked} rules — ` +
        `${summary.byImpact.critical} critical, ${summary.byImpact.serious} serious, ` +
        `${summary.byImpact.moderate} moderate, ${summary.byImpact.minor} minor.`;
    const body = findings
        .map((f, i) => `\n**${i + 1}. [${f.impact}] ${f.title}** (WCAG ${f.wcag.join(", ")}, level ${f.level})\n` +
        `- Element: \`${f.snippet}\`\n` +
        `- Problem: ${f.detail}\n` +
        `- Fix: ${f.fix}`)
        .join("\n");
    return clamp(`${head}\n${body}`);
}
const METHOD_LABEL = {
    automated: "auto",
    hybrid: "auto+manual",
    attested: "manual",
    "design-time": "design",
};
export function checklistToMarkdown(sections) {
    const body = sections
        .map((s) => {
        const items = s.items
            .map((i) => {
            const how = METHOD_LABEL[i.method] ?? i.method;
            const rules = i.ruleIds.length ? ` [${i.ruleIds.join(", ")}]` : "";
            return `  - **${i.id}** ${i.text}\n    _${how} → ${i.gate}${rules}_`;
        })
            .join("\n");
        return `### ${s.id}. ${s.name}\n${items}`;
    })
        .join("\n\n");
    return clamp(body);
}
export function gateToMarkdown(r) {
    const tierLine = r.tier
        ? `Risk **Tier ${r.tier}** (${r.tierName}). `
        : `Risk tier **unresolved** (unknown component). `;
    const warnLine = r.warnings.map((w) => `\n\n**Warning:** ${w}`).join("");
    const p = r.provenance;
    const provLine = `\n\n**Audited artifact:** ${p.name}${p.ref ? ` — \`${p.ref}\`` : ""} ` +
        `${p.satisfiesAutomatedGate ? "✓ counts as evidence" : "✗ does NOT satisfy the automated gate"}\n` +
        `_${p.caveat}_`;
    const rows = r.gates
        .map((g) => {
        const mark = g.status === "pass" ? "✅" : "⛔";
        const detail = g.findings?.length
            ? "\n" + g.findings.map((f) => `      · ${f.evidence[0] ? `\`${f.evidence[0]}\`` : `\`${f.ruleId}\``} — ${f.detail}`).join("\n")
            : "";
        return `  ${mark} **${g.name}** (${g.evidence}) — ${g.reason}${detail}`;
    })
        .join("\n");
    const header = r.verdict === "PASS"
        ? `## ✅ ENTERPRISE RELEASE GATE: PASS`
        : `## ⛔ ENTERPRISE RELEASE GATE: BLOCKED`;
    const crit = r.criticalDefects.length
        ? `\n\n**${r.criticalDefects.length} critical defect(s)** — release cannot proceed while any remain:\n` +
            r.criticalDefects.map((f) => `  · ${f.evidence[0] ? `\`${f.evidence[0]}\`` : `\`${f.ruleId}\``} — ${f.detail}`).join("\n")
        : "";
    const footer = r.verdict === "PASS"
        ? `\n\nAll seven gates passed and no critical defects remain, for the artifact named above. Attestations are trust-based — a PASS confirms the gate conditions were recorded as met, not that manual reviews were done well.`
        : `\n\n${r.unmet.length} gate(s) unmet. Resolve every item and re-run. In CI, this verdict should fail the build.`;
    return clamp(`${header}\n\n${tierLine}${warnLine}${provLine}\n\nGate status:\n\n${rows}${crit}${footer}`);
}
export function guidanceToMarkdown(g) {
    const kb = g.keyboard.map((k) => `  - \`${k.key}\` — ${k.action}`).join("\n");
    return clamp(`## Accessible ${g.component}\n\n` +
        `**Roles:** ${g.roles.join(", ")}\n\n` +
        `**ARIA:** ${g.aria.join("; ")}\n\n` +
        `**Keyboard:**\n${kb}\n\n` +
        `**Focus management:**\n${g.focus.map((f) => `  - ${f}`).join("\n")}\n\n` +
        `**Avoid:**\n${g.pitfalls.map((p) => `  - ${p}`).join("\n")}\n\n` +
        `**WCAG:** ${g.wcag.join(", ")}`);
}
