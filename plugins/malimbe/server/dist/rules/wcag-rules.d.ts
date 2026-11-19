import type { HTMLElement } from "node-html-parser";
import type { Finding, Rule } from "../types.js";
/** A rule bundled with its executable check. */
export interface CheckableRule extends Rule {
    check: (doc: HTMLElement) => Finding[];
}
export declare const RULES: CheckableRule[];
export declare const RULE_INDEX: Map<string, CheckableRule>;
