import { stackToMarkdown } from "./stack.js";
/** Rules whose failure typically prevents a task outright, not merely degrades it. */
const TASK_BLOCKING = new Set([
    "button-name", "link-name", "input-button-name", "label", "form-field-multiple-labels",
    "select-name", "aria-input-field-name", "aria-command-name", "aria-toggle-field-name",
    "frame-title", "image-button-name", "input-image-alt", "nested-interactive",
    "aria-hidden-focus", "focus-order-semantics", "bypass", "html-has-lang",
]);
const WEIGHT = { critical: 10, serious: 4, moderate: 2, minor: 1 };
const SEVERITY_ORDER = ["critical", "serious", "moderate", "minor"];
function emptySeverity() {
    return { critical: 0, serious: 0, moderate: 0, minor: 0 };
}
/**
 * Confidence that a user relying on assistive technology can navigate the page
 * and complete basic tasks. Derived from the count and severity of violations,
 * with task-blocking rules weighted heavily. This is a heuristic triage signal,
 * NOT a measurement of real user success.
 */
export function rateConfidence(violations, patternGaps) {
    let score = 0;
    const blockers = [];
    let criticalInstances = 0;
    for (const v of violations) {
        const n = v.nodes.length || 1;
        score += WEIGHT[v.impact] * n;
        if (v.impact === "critical")
            criticalInstances += n;
        if (TASK_BLOCKING.has(v.id)) {
            score += 6 * n;
            blockers.push(`${v.help} (${v.id}) — ${n} instance(s)`);
        }
    }
    // Pattern gaps mean a widget does not honour the contract it advertises.
    score += patternGaps.length * 3;
    let band;
    if (score === 0)
        band = "High";
    else if (blockers.length === 0 && criticalInstances === 0 && score <= 12)
        band = "Moderate";
    else if (criticalInstances >= 3 || blockers.length >= 3 || score > 60)
        band = "Very low";
    else
        band = "Low";
    const rationale = band === "High"
        ? "No automated violations were detected. A user is likely able to navigate and complete basic tasks, subject to manual verification."
        : band === "Moderate"
            ? "Only lower-severity issues were found and no task-blocking failures. Most users can likely complete basic tasks, with friction."
            : band === "Low"
                ? "Violations include failures that impede navigation or control identification. Some users will struggle to complete basic tasks unaided."
                : "Multiple task-blocking failures were found. Users relying on assistive technology are likely unable to complete basic tasks.";
    return {
        band,
        score,
        rationale,
        blockers: blockers.slice(0, 8),
        basis: "Heuristic: severity-weighted violation instances (critical 10, serious 4, moderate 2, minor 1), with an additional weighting for rules that block task completion (missing names/labels, keyboard traps, nested interactives, missing skip links, missing page language). It reflects automated findings only — keyboard interaction flows, screen-reader output quality, and cognitive clarity are not measured and require manual review.",
    };
}
function describeMissingIssue(issue) {
    const normalized = issue.toLowerCase();
    if (normalized.includes("accessible name"))
        return "an accessible name";
    if (normalized.includes("aria-modal"))
        return "modal state";
    if (normalized.includes("aria-expanded"))
        return "expanded state";
    if (normalized.includes("aria-haspopup"))
        return "popup trigger behavior";
    if (normalized.includes("aria-controls"))
        return "a relationship to its controlled element";
    if (normalized.includes("aria-describedby"))
        return "a relationship to its description";
    if (normalized.includes("aria-labelledby"))
        return "a relationship to its label";
    if (normalized.includes("aria-selected"))
        return "selected state";
    if (normalized.includes("trigger element"))
        return "a trigger element";
    if (normalized.includes("descendant"))
        return "a descendant pattern element";
    return issue;
}
function buildComponentSummaries(patternGaps) {
    return patternGaps.map((gap) => {
        const issues = gap.missing.map(describeMissingIssue);
        const detail = issues.length === 1
            ? issues[0]
            : `${issues.slice(0, -1).join(", ")} and ${issues[issues.length - 1]}`;
        return {
            component: gap.component,
            summary: `${gap.component.charAt(0).toUpperCase()}${gap.component.slice(1)} appears to be missing ${detail}.`,
            issues: gap.missing,
        };
    });
}
function inferComponentName(v) {
    const id = v.id.toLowerCase();
    if (id.includes("dialog") || id.includes("modal"))
        return "Dialog and overlay";
    if (id.includes("tab"))
        return "Tabs";
    if (id.includes("menu"))
        return "Menu button";
    if (id.includes("tooltip"))
        return "Tooltip";
    if (id.includes("combobox"))
        return "Combobox";
    if (id.includes("listbox"))
        return "Listbox";
    if (id.includes("tree"))
        return "Tree view";
    if (id.includes("grid"))
        return "Grid";
    if (id.includes("button") || id.includes("link") || id.includes("select") || id.includes("input") || id.includes("label"))
        return "Controls and forms";
    if (id.includes("landmark") || id.includes("heading") || id.includes("region") || id.includes("page-has-heading"))
        return "Document structure";
    return "Interactive flow";
}
function severityRank(severity) {
    return SEVERITY_ORDER.indexOf(severity);
}
function remediationFor(component, issues) {
    const normalized = component.toLowerCase();
    if (normalized.includes("dialog") || normalized.includes("overlay")) {
        return [
            "Ensure the dialog exposes a clear name and any supporting description, then verify focus is trapped while it is open.",
            "Restore focus to the trigger when the dialog closes so keyboard users are not left disoriented.",
        ];
    }
    if (normalized.includes("tab")) {
        return [
            "Confirm each tab has a clear label, selected state, and a relationship to its associated panel.",
            "Validate the tablist and panel sequence with keyboard-only navigation after the change.",
        ];
    }
    if (normalized.includes("menu")) {
        return [
            "Ensure the trigger exposes aria-haspopup and aria-expanded, and that the popup is referenced correctly.",
            "Verify the popup can be dismissed with Escape and navigated using the keyboard.",
        ];
    }
    if (normalized.includes("tooltip")) {
        return [
            "Provide a reliable accessible relationship between the trigger and the tooltip content.",
            "Keep the tooltip content concise and avoid relying on hover alone for essential information.",
        ];
    }
    if (normalized.includes("combobox") || normalized.includes("listbox") || normalized.includes("tree") || normalized.includes("grid")) {
        return [
            "Review the ARIA states and relationships for the composite widget, especially selection and expansion state.",
            "Verify each option, row, or node exposes a clear name and keyboard interaction path.",
        ];
    }
    if (issues.some((issue) => issue.toLowerCase().includes("contrast"))) {
        return [
            "Increase contrast and validate the component across both light and dark themes.",
            "Confirm the text and controls remain readable at common zoom settings.",
        ];
    }
    if (issues.some((issue) => issue.toLowerCase().includes("name")) || issues.some((issue) => issue.toLowerCase().includes("label"))) {
        return [
            "Provide the component with an accessible name through visible text or an explicit label relationship.",
            "Recheck the component in a screen-reader flow after the label change.",
        ];
    }
    return [
        "Review the component's semantics, state, and relationship attributes.",
        "Validate the fix with keyboard-only navigation and a screen-reader pass.",
    ];
}
function buildComponentReviews(violations, patternGaps) {
    const reviews = new Map();
    for (const gap of patternGaps) {
        const key = gap.component;
        const review = reviews.get(key) ?? {
            component: gap.component,
            severity: "moderate",
            summary: `${gap.component.charAt(0).toUpperCase()}${gap.component.slice(1)} needs structural contract work.`,
            issues: [],
            evidence: [],
            remediation: [],
        };
        review.issues.push(...gap.missing);
        review.evidence.push(gap.selector);
        review.severity = severityRank(review.severity) <= severityRank("moderate") ? review.severity : "moderate";
        review.summary = `${gap.component.charAt(0).toUpperCase()}${gap.component.slice(1)} appears to be missing key ARIA or naming contract elements.`;
        review.remediation = remediationFor(gap.component, gap.missing);
        reviews.set(key, review);
    }
    for (const violation of violations) {
        const component = inferComponentName(violation);
        const key = component;
        const review = reviews.get(key) ?? {
            component,
            severity: "minor",
            summary: `${component} needs attention.`,
            issues: [],
            evidence: [],
            remediation: [],
        };
        const nextSeverity = violation.impact;
        review.severity = severityRank(nextSeverity) < severityRank(review.severity) ? nextSeverity : review.severity;
        review.issues.push(`${violation.id} — ${violation.help}`);
        review.evidence.push(`${violation.id}: ${violation.help}`);
        review.summary = `${component} is contributing ${review.issues.length} issue${review.issues.length === 1 ? "" : "s"} to the audit.`;
        review.remediation = remediationFor(component, review.issues);
        reviews.set(key, review);
    }
    return [...reviews.values()].sort((a, b) => severityRank(a.severity) - severityRank(b.severity));
}
function buildExecutiveSummary(componentReviews, totals, patternGapCount) {
    if (!componentReviews.length) {
        return "No automated defects were detected. Continue with a keyboard-only walkthrough and a screen-reader review to confirm the experience remains usable.";
    }
    const highest = componentReviews[0];
    const topComponents = componentReviews.slice(0, 3).map((review) => review.component).join(", ");
    const critical = totals.bySeverity.critical || totals.instancesBySeverity.critical;
    const serious = totals.bySeverity.serious || totals.instancesBySeverity.serious;
    const priority = critical > 0 ? "critical" : serious > 0 ? "serious" : "moderate";
    return `${componentReviews.length} component review${componentReviews.length === 1 ? "" : "s"} surfaced in this audit. The highest-priority work is ${highest.component.toLowerCase()} with ${priority} issues, and the first remediation targets are ${topComponents}. The scan found ${totals.violationTypes} violation type${totals.violationTypes === 1 ? "" : "s"} across ${totals.instances} element instance${totals.instances === 1 ? "" : "s"}${patternGapCount ? ` and ${patternGapCount} source-pattern gap${patternGapCount === 1 ? "" : "s"}` : ""}.`;
}
function countOrigins(v, names) {
    const counts = new Map();
    for (const n of v.nodes)
        if (n.origin)
            counts.set(n.origin.detectionId, (counts.get(n.origin.detectionId) ?? 0) + 1);
    if (!counts.size)
        return undefined;
    return [...counts.entries()].map(([detectionId, instances]) => ({ detectionId, name: names.get(detectionId) ?? detectionId, instances }));
}
function mergeOrigins(into, add) {
    for (const o of add ?? []) {
        const hit = into.find((x) => x.detectionId === o.detectionId);
        if (hit)
            hit.instances += o.instances;
        else
            into.push({ ...o });
    }
}
export function buildReport(run) {
    const bySeverityMap = new Map();
    const critMap = new Map();
    const names = new Map((run.stack?.detections ?? []).map((d) => [d.id, d.name]));
    const totalsBySeverity = emptySeverity();
    const instancesBySeverity = emptySeverity();
    let instances = 0;
    for (const v of run.violations) {
        const n = v.nodes.length || 1;
        instances += n;
        totalsBySeverity[v.impact]++;
        instancesBySeverity[v.impact] += n;
        const list = bySeverityMap.get(v.impact) ?? [];
        const origins = countOrigins(v, names);
        list.push({ id: v.id, help: v.help, instances: n, criteria: v.criteria, ...(origins ? { origins } : {}) });
        bySeverityMap.set(v.impact, list);
        const criteria = v.criteria.length ? v.criteria : ["(best practice — no single WCAG criterion)"];
        for (const c of criteria) {
            const rec = critMap.get(c) ?? { violations: 0, instances: 0, rules: new Set(), origins: [] };
            rec.violations++;
            rec.instances += n;
            rec.rules.add(v.id);
            mergeOrigins(rec.origins, origins);
            critMap.set(c, rec);
        }
    }
    const bySeverity = SEVERITY_ORDER
        .filter((s) => bySeverityMap.has(s))
        .map((s) => ({ severity: s, rules: (bySeverityMap.get(s) ?? []).sort((a, b) => b.instances - a.instances) }));
    const byCriterion = [...critMap.entries()]
        .map(([criterion, r]) => ({ criterion, violations: r.violations, instances: r.instances, rules: [...r.rules], ...(r.origins.length ? { origins: r.origins } : {}) }))
        .sort((a, b) => {
        const aIsBestPractice = a.criterion === "(best practice — no single WCAG criterion)";
        const bIsBestPractice = b.criterion === "(best practice — no single WCAG criterion)";
        if (aIsBestPractice && !bIsBestPractice)
            return 1;
        if (!aIsBestPractice && bIsBestPractice)
            return -1;
        return b.instances - a.instances;
    });
    const componentReviews = buildComponentReviews(run.violations, run.patternGaps);
    const executiveSummary = buildExecutiveSummary(componentReviews, {
        violationTypes: run.violations.length,
        instances,
        bySeverity: totalsBySeverity,
        instancesBySeverity,
    }, run.patternGaps.length);
    return {
        url: run.url,
        scope: run.scope,
        standard: run.standard,
        engine: `${run.engine} via Playwright`,
        scannedAt: new Date().toISOString(),
        runtime: { axeVersion: run.axeVersion ?? null, browserVersion: run.browserVersion ?? null, renderedDomDigest: run.renderedDomDigest ?? null },
        executiveSummary,
        componentReviews,
        componentSummaries: buildComponentSummaries(run.patternGaps),
        totals: {
            violationTypes: run.violations.length,
            instances,
            bySeverity: totalsBySeverity,
            instancesBySeverity,
            patternGaps: run.patternGaps.length,
        },
        bySeverity,
        byCriterion,
        patternGaps: run.patternGaps,
        confidence: rateConfidence(run.violations, run.patternGaps),
        ...(run.stack ? { stack: run.stack } : {}),
    };
}
function originText(origins) {
    return origins?.length ? origins.map((o) => `${o.name} (${o.instances})`).join(", ") : "—";
}
const BAND_MARK = {
    High: "🟢",
    Moderate: "🟡",
    Low: "🟠",
    "Very low": "🔴",
};
export function reportToMarkdown(r) {
    const t = r.totals;
    const head = `# Accessibility audit — ${r.url}\n\n` +
        `**Standard:** ${r.standard} · **Engine:** ${r.engine} · **Target:** ${r.scope}-facing · **Scanned:** ${r.scannedAt}\n\n` +
        `## Totals\n` +
        `- **${t.violationTypes}** violation type(s) across **${t.instances}** element instance(s)\n` +
        `- Critical ${t.bySeverity.critical} (${t.instancesBySeverity.critical} instances) · ` +
        `Serious ${t.bySeverity.serious} (${t.instancesBySeverity.serious}) · ` +
        `Moderate ${t.bySeverity.moderate} (${t.instancesBySeverity.moderate}) · ` +
        `Minor ${t.bySeverity.minor} (${t.instancesBySeverity.minor})` +
        (r.scope === "internal" ? `\n- Source-pattern gaps: **${t.patternGaps}**` : "");
    const conf = `\n\n## Task confidence: ${BAND_MARK[r.confidence.band]} ${r.confidence.band} (score ${r.confidence.score})\n` +
        `${r.confidence.rationale}\n` +
        (r.confidence.blockers.length
            ? `\n**Task-blocking failures:**\n${r.confidence.blockers.map((b) => `- ${b}`).join("\n")}\n`
            : "") +
        `\n_${r.confidence.basis}_`;
    const sev = r.bySeverity.length
        ? "\n\n## Violations by severity\n" +
            r.bySeverity
                .map((g) => `\n### ${g.severity} (${g.rules.length} rule(s))\n` +
                g.rules
                    .map((x) => `- **${x.help}** \`${x.id}\` — ${x.instances} instance(s)${x.criteria.length ? ` · WCAG ${x.criteria.join(", ")}` : ""}${x.origins?.length ? ` · origin: ${originText(x.origins)}` : ""}`)
                    .join("\n"))
                .join("\n")
        : "\n\n## Violations by severity\nNone detected.";
    const anyOrigin = r.byCriterion.some((c) => c.origins?.length);
    const crit = !r.byCriterion.length
        ? ""
        : anyOrigin
            ? "\n\n## Violations by WCAG criterion\n\n| Criterion | Rules | Instances | Origin |\n|---|---|---|---|\n" +
                r.byCriterion.map((c) => `| ${c.criterion} | ${c.rules.join(", ")} | ${c.instances} | ${originText(c.origins)} |`).join("\n")
            : "\n\n## Violations by WCAG criterion\n\n| Criterion | Rules | Instances |\n|---|---|---|\n" +
                r.byCriterion.map((c) => `| ${c.criterion} | ${c.rules.join(", ")} | ${c.instances} |`).join("\n");
    const executive = `\n\n## Executive summary\n${r.executiveSummary}`;
    const componentReviews = r.componentReviews.length
        ? "\n\n## Deep-dive remediation plan\n" +
            r.componentReviews.map((review) => {
                const title = `### ${review.component} — ${review.severity}`;
                const bullets = [
                    `- **Focus:** ${review.summary}`,
                    `- **Evidence:** ${review.evidence.slice(0, 3).join("; ")}${review.evidence.length > 3 ? " …" : ""}`,
                    `- **Remediation:** ${review.remediation.join(" ")}`,
                ];
                return `${title}\n${bullets.join("\n")}`;
            }).join("\n\n")
        : "";
    const componentSummaries = r.componentSummaries.length
        ? "\n\n## Component-level summaries\n" +
            r.componentSummaries.map((s) => `- **${s.component}** ${s.summary}`).join("\n")
        : "";
    const gaps = r.patternGaps.length
        ? "\n\n## Source-pattern conformance gaps\n" +
            r.patternGaps
                .map((g) => `- \`${g.selector}\` claims the **${g.component}** pattern but is missing: ${g.missing.join(", ")}${g.source ? ` (source: ${g.source})` : ""}`)
                .join("\n")
        : "";
    const foot = "\n\n---\n_Automated results only. A clean scan is necessary, not sufficient: keyboard interaction flows, screen-reader output, and cognitive clarity require manual review._";
    const stack = r.stack ? `\n\n${stackToMarkdown(r.stack)}` : "";
    return head + conf + executive + stack + sev + crit + componentReviews + componentSummaries + gaps + foot;
}
