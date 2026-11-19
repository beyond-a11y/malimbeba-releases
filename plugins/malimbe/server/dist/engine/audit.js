import { parse } from "node-html-parser";
import { RULES, RULE_INDEX } from "../rules/wcag-rules.js";
const IMPACT_ORDER = {
    critical: 0,
    serious: 1,
    moderate: 2,
    minor: 3,
};
/**
 * Audit an HTML string against the WCAG ruleset.
 * @param html   Full document or fragment.
 * @param ruleIds Optional subset of rule ids to run (defaults to all).
 */
export function auditHtml(html, ruleIds) {
    const doc = parse(html, {
        lowerCaseTagName: true,
        comment: false,
        voidTag: { closingSlash: true },
    });
    const active = ruleIds && ruleIds.length
        ? ruleIds.map((id) => RULE_INDEX.get(id)).filter((r) => r !== undefined)
        : RULES;
    const findings = [];
    for (const rule of active) {
        try {
            findings.push(...rule.check(doc));
        }
        catch {
            // A malformed fragment must never crash the whole audit.
        }
    }
    findings.sort((a, b) => IMPACT_ORDER[a.impact] - IMPACT_ORDER[b.impact]);
    const byImpact = {
        critical: 0,
        serious: 0,
        moderate: 0,
        minor: 0,
    };
    for (const f of findings)
        byImpact[f.impact]++;
    return {
        summary: {
            total: findings.length,
            byImpact,
            rulesChecked: active.length,
            passed: findings.length === 0,
        },
        findings,
    };
}
