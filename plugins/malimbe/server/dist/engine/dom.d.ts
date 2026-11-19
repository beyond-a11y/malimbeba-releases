import type { HTMLElement } from "node-html-parser";
/** Build a compact `<tag a="b">` snippet (opening tag only) for a finding. */
export declare function openTag(el: HTMLElement): string;
/** Best-effort CSS-ish selector for a finding (tag + id/class). */
export declare function shortSelector(el: HTMLElement): string;
export declare function truncate(s: string, max: number): string;
/** Visible-ish text of an element (excludes nested markup). */
export declare function visibleText(el: HTMLElement): string;
/** Does the element expose a non-empty accessible name via common paths? */
export declare function hasAccessibleName(el: HTMLElement, doc: HTMLElement): boolean;
/** Minimal CSS identifier escaping for querySelector by id. */
export declare function cssEscape(id: string): string;
/** Parse inline `style="a:b; c:d"` into a lookup. */
export declare function parseInlineStyle(el: HTMLElement): Record<string, string>;
export declare const FOCUSABLE_SELECTOR = "a[href], button, input, select, textarea, [tabindex]";
export declare const VALID_ARIA_ROLES: Set<string>;
