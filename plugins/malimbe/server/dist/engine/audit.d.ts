import type { AuditResult } from "../types.js";
/**
 * Audit an HTML string against the WCAG ruleset.
 * @param html   Full document or fragment.
 * @param ruleIds Optional subset of rule ids to run (defaults to all).
 */
export declare function auditHtml(html: string, ruleIds?: string[]): AuditResult;
