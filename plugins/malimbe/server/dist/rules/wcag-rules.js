import { FOCUSABLE_SELECTOR, VALID_ARIA_ROLES, hasAccessibleName, openTag, parseInlineStyle, shortSelector, visibleText, } from "../engine/dom.js";
import { CONTRAST_AA_LARGE, CONTRAST_AA_NORMAL, } from "../constants.js";
import { contrastRatio, parseColor } from "../engine/contrast.js";
function finding(el, rule, detail) {
    return {
        ruleId: rule.id,
        title: rule.title,
        wcag: rule.wcag,
        level: rule.level,
        impact: rule.impact,
        fix: rule.fix,
        selector: shortSelector(el),
        snippet: openTag(el),
        detail,
    };
}
function isLabelWrapped(el) {
    let p = el.parentNode;
    while (p) {
        if (p.rawTagName?.toLowerCase() === "label")
            return true;
        p = p.parentNode;
    }
    return false;
}
function nestedImgHasAlt(el) {
    return el
        .querySelectorAll("img")
        .some((img) => (img.getAttribute("alt") ?? "").trim().length > 0);
}
/** Selector matching native headings AND ARIA-custom headings (role="heading"). */
const HEADING_SELECTOR = "h1, h2, h3, h4, h5, h6, [role='heading']";
/**
 * Heading level for either a native h1-h6 or a role="heading" element.
 * Per the ARIA spec, role="heading" with no aria-level defaults to level 2 —
 * that default is applied here rather than treated as "no level", so a
 * custom heading with a missing/invalid aria-level still participates in the
 * order check instead of silently passing through unchecked.
 */
function headingLevel(el) {
    const tag = el.rawTagName?.toLowerCase();
    if (tag && /^h[1-6]$/.test(tag))
        return Number(tag.slice(1));
    const level = Number(el.getAttribute("aria-level"));
    return Number.isInteger(level) && level >= 1 ? level : 2;
}
/** Implicit ARIA role for a safe, common subset of native elements. */
function implicitRole(el) {
    const tag = el.rawTagName?.toLowerCase();
    if (!tag)
        return null;
    if (/^h[1-6]$/.test(tag))
        return "heading";
    const map = {
        button: "button",
        nav: "navigation",
        main: "main",
        ul: "list",
        ol: "list",
        li: "listitem",
        img: "img",
        article: "article",
        aside: "complementary",
        dialog: "dialog",
    };
    if (map[tag])
        return map[tag];
    if (tag === "a" && el.getAttribute("href") !== undefined)
        return "link";
    if (tag === "input") {
        const type = (el.getAttribute("type") ?? "text").toLowerCase();
        const inputRoles = {
            checkbox: "checkbox",
            radio: "radio",
            button: "button",
            range: "slider",
            text: "textbox",
            search: "searchbox",
        };
        return inputRoles[type] ?? null;
    }
    return null;
}
export const RULES = [
    {
        id: "img-alt",
        title: "Images must have an alt attribute",
        wcag: ["1.1.1"],
        level: "A",
        impact: "critical",
        fix: 'Add alt text describing the image, or alt="" if it is purely decorative.',
        check: (doc) => doc
            .querySelectorAll("img")
            .filter((img) => img.getAttribute("alt") === undefined)
            .map((img) => finding(img, RULES[0], "No alt attribute present.")),
    },
    {
        id: "control-label",
        title: "Form controls must have an accessible name",
        wcag: ["1.3.1", "4.1.2"],
        level: "A",
        impact: "critical",
        fix: "Associate a <label for>, wrap the control in a <label>, or add aria-label / aria-labelledby.",
        check: (doc) => {
            const labelFors = new Set(doc
                .querySelectorAll("label[for]")
                .map((l) => l.getAttribute("for"))
                .filter(Boolean));
            const skip = new Set(["hidden", "button", "submit", "reset", "image"]);
            const out = [];
            for (const el of doc.querySelectorAll("input, select, textarea")) {
                const tag = el.rawTagName?.toLowerCase();
                if (tag === "input" && skip.has((el.getAttribute("type") ?? "text").toLowerCase()))
                    continue;
                const id = el.getAttribute("id");
                const named = hasAccessibleName(el, doc) ||
                    (id && labelFors.has(id)) ||
                    isLabelWrapped(el);
                if (!named)
                    out.push(finding(el, RULES[1], "Control has no associated label or ARIA name."));
            }
            return out;
        },
    },
    {
        id: "button-name",
        title: "Buttons must have discernible text",
        wcag: ["4.1.2"],
        level: "A",
        impact: "critical",
        fix: "Add visible text, an aria-label, or an inner <img> with alt text.",
        check: (doc) => doc
            .querySelectorAll("button")
            .filter((b) => !visibleText(b) &&
            !hasAccessibleName(b, doc) &&
            !nestedImgHasAlt(b))
            .map((b) => finding(b, RULES[2], "Button has no accessible name.")),
    },
    {
        id: "link-name",
        title: "Links must have discernible text",
        wcag: ["2.4.4", "4.1.2"],
        level: "A",
        impact: "serious",
        fix: "Provide link text that describes the destination, or an aria-label. Avoid image-only links without alt text.",
        check: (doc) => doc
            .querySelectorAll("a[href]")
            .filter((a) => !visibleText(a) &&
            !hasAccessibleName(a, doc) &&
            !nestedImgHasAlt(a))
            .map((a) => finding(a, RULES[3], "Link has no accessible name.")),
    },
    {
        id: "html-lang",
        title: "<html> must declare a language",
        wcag: ["3.1.1"],
        level: "A",
        impact: "serious",
        fix: 'Add a lang attribute to <html>, e.g. <html lang="en">.',
        check: (doc) => {
            const html = doc.querySelector("html");
            if (!html)
                return [];
            const lang = html.getAttribute("lang");
            return lang && lang.trim()
                ? []
                : [finding(html, RULES[4], "The <html> element has no lang attribute.")];
        },
    },
    {
        id: "heading-order",
        title: "Heading levels must not skip",
        wcag: ["1.3.1"],
        level: "A",
        impact: "moderate",
        fix: "Increase heading levels by one at a time (e.g. do not jump from h2 to h4). Applies to role=\"heading\" + aria-level the same as native h1-h6.",
        check: (doc) => {
            const headings = doc.querySelectorAll(HEADING_SELECTOR);
            const out = [];
            let prev = 0;
            for (const h of headings) {
                const level = headingLevel(h);
                if (prev > 0 && level > prev + 1) {
                    out.push(finding(h, RULES[5], `Heading jumps from h${prev} to h${level}.`));
                }
                prev = level;
            }
            return out;
        },
    },
    {
        id: "empty-heading",
        title: "Headings must not be empty",
        wcag: ["1.3.1"],
        level: "A",
        impact: "moderate",
        fix: "Remove the empty heading or give it meaningful text.",
        check: (doc) => doc
            .querySelectorAll(HEADING_SELECTOR)
            .filter((h) => !visibleText(h) &&
            !hasAccessibleName(h, doc) &&
            !nestedImgHasAlt(h))
            .map((h) => finding(h, RULES[6], "Heading has no text content.")),
    },
    {
        id: "positive-tabindex",
        title: "Avoid positive tabindex values",
        wcag: ["2.4.3"],
        level: "A",
        impact: "serious",
        fix: "Use tabindex=\"0\" or \"-1\". Positive values create an unpredictable focus order.",
        check: (doc) => doc
            .querySelectorAll("[tabindex]")
            .filter((el) => Number(el.getAttribute("tabindex")) > 0)
            .map((el) => finding(el, RULES[7], `tabindex="${el.getAttribute("tabindex")}" overrides natural focus order.`)),
    },
    {
        id: "duplicate-id",
        title: "id attributes must be unique",
        wcag: ["4.1.1"],
        level: "A",
        impact: "moderate",
        fix: "Make each id unique. Duplicate ids break label, aria-labelledby, and aria-controls references.",
        check: (doc) => {
            const seen = new Map();
            const out = [];
            for (const el of doc.querySelectorAll("[id]")) {
                const id = el.getAttribute("id");
                const count = (seen.get(id) ?? 0) + 1;
                seen.set(id, count);
                if (count > 1)
                    out.push(finding(el, RULES[8], `Duplicate id="${id}".`));
            }
            return out;
        },
    },
    {
        id: "valid-role",
        title: "role must be a valid ARIA role",
        wcag: ["4.1.2"],
        level: "A",
        impact: "serious",
        fix: "Use a defined WAI-ARIA role, or remove the attribute to fall back to the element's implicit role.",
        check: (doc) => {
            const out = [];
            for (const el of doc.querySelectorAll("[role]")) {
                const bad = (el.getAttribute("role") ?? "")
                    .trim()
                    .split(/\s+/)
                    .filter((r) => r && !VALID_ARIA_ROLES.has(r.toLowerCase()));
                if (bad.length)
                    out.push(finding(el, RULES[9], `Unknown role(s): ${bad.join(", ")}.`));
            }
            return out;
        },
    },
    {
        id: "viewport-zoom",
        title: "Do not disable pinch-to-zoom",
        wcag: ["1.4.4"],
        level: "AA",
        impact: "serious",
        fix: "Remove user-scalable=no and allow maximum-scale of at least 2 in the viewport meta tag.",
        check: (doc) => {
            const out = [];
            for (const meta of doc.querySelectorAll('meta[name="viewport"]')) {
                const content = (meta.getAttribute("content") ?? "").toLowerCase();
                const maxScale = content.match(/maximum-scale\s*=\s*([\d.]+)/);
                if (/user-scalable\s*=\s*(no|0)/.test(content) ||
                    (maxScale && Number(maxScale[1]) < 2)) {
                    out.push(finding(meta, RULES[10], "Viewport prevents users from zooming."));
                }
            }
            return out;
        },
    },
    {
        id: "aria-hidden-focusable",
        title: "aria-hidden must not hide focusable content",
        wcag: ["1.3.1", "4.1.2"],
        level: "A",
        impact: "serious",
        fix: "Remove aria-hidden, or make the contained elements unfocusable (tabindex=\"-1\" / disabled).",
        check: (doc) => doc
            .querySelectorAll('[aria-hidden="true"]')
            .filter((el) => el.querySelectorAll(FOCUSABLE_SELECTOR).length > 0)
            .map((el) => finding(el, RULES[11], "Focusable descendants remain reachable while hidden from assistive tech.")),
    },
    {
        id: "label-for-target",
        title: "label[for] must reference an existing control",
        wcag: ["1.3.1"],
        level: "A",
        impact: "moderate",
        fix: "Point the label's for attribute at the id of an existing form control.",
        check: (doc) => doc
            .querySelectorAll("label[for]")
            .filter((l) => !doc.querySelector(`[id="${l.getAttribute("for")}"]`))
            .map((l) => finding(l, RULES[12], `No element has id="${l.getAttribute("for")}".`)),
    },
    {
        id: "contrast-inline",
        title: "Text must meet minimum contrast (inline colors)",
        wcag: ["1.4.3"],
        level: "AA",
        impact: "serious",
        fix: "Adjust the foreground or background so the ratio is at least 4.5:1 (3:1 for large text).",
        check: (doc) => {
            const out = [];
            for (const el of doc.querySelectorAll("[style]")) {
                const style = parseInlineStyle(el);
                const fg = style["color"] ? parseColor(style["color"]) : null;
                const bg = style["background-color"]
                    ? parseColor(style["background-color"])
                    : style["background"]
                        ? parseColor(style["background"])
                        : null;
                if (!fg || !bg)
                    continue;
                const size = parseFloat(style["font-size"] ?? "0");
                const weight = style["font-weight"] ?? "";
                const bold = weight === "bold" || Number(weight) >= 700;
                const large = size >= 24 || (size >= 18.66 && bold);
                const ratio = contrastRatio(fg, bg);
                const min = large ? CONTRAST_AA_LARGE : CONTRAST_AA_NORMAL;
                if (ratio < min) {
                    out.push(finding(el, RULES[13], `Contrast ratio ${ratio.toFixed(2)}:1 is below the ${min}:1 minimum${large ? " for large text" : ""}.`));
                }
            }
            return out;
        },
    },
    {
        id: "role-conflict",
        title: "ARIA role must not conflict with or restate native semantics",
        wcag: ["4.1.2"],
        level: "A",
        impact: "serious",
        fix: "Remove the redundant role, or use the correct native element instead of overriding its role.",
        check: (doc) => {
            const out = [];
            for (const el of doc.querySelectorAll("[role]")) {
                const role = (el.getAttribute("role") ?? "").trim().toLowerCase();
                if (!role)
                    continue;
                const implicit = implicitRole(el);
                const tag = el.rawTagName?.toLowerCase();
                if (implicit && role === implicit) {
                    out.push(finding(el, RULES[14], `role="${role}" is redundant with the native <${tag}> element.`));
                }
                else if (implicit && tag && /^h[1-6]$/.test(tag) && role !== "heading") {
                    out.push(finding(el, RULES[14], `role="${role}" overrides the heading semantics of <${tag}>.`));
                }
                else if (implicit === "link" && role === "button") {
                    out.push(finding(el, RULES[14], `A link with role="button" should be a <button> element.`));
                }
                else if (implicit === "button" && role === "link") {
                    out.push(finding(el, RULES[14], `A button with role="link" should be an <a href> element.`));
                }
            }
            return out;
        },
    },
    {
        id: "placeholder-label",
        title: "Placeholder is not a persistent label",
        wcag: ["1.3.1", "3.3.2"],
        level: "A",
        impact: "moderate",
        fix: "Add a visible, persistent <label> associated with the field. Placeholders disappear on input.",
        check: (doc) => {
            const labelFors = new Set(doc.querySelectorAll("label[for]").map((l) => l.getAttribute("for")).filter(Boolean));
            const out = [];
            for (const el of doc.querySelectorAll("input, textarea")) {
                const placeholder = el.getAttribute("placeholder");
                if (!placeholder || !placeholder.trim())
                    continue;
                const id = el.getAttribute("id");
                const hasVisibleLabel = (id && labelFors.has(id)) || isLabelWrapped(el);
                if (!hasVisibleLabel) {
                    out.push(finding(el, RULES[15], "Field is labelled only by a placeholder, which vanishes once the user types."));
                }
            }
            return out;
        },
    },
    {
        id: "aria-disabled-only",
        title: "aria-disabled must be backed by a functional disable",
        wcag: ["4.1.2"],
        level: "A",
        impact: "serious",
        fix: "Add the native disabled attribute (or remove the control from tab order and block activation). aria-disabled alone stays operable.",
        check: (doc) => {
            const out = [];
            for (const el of doc.querySelectorAll('[aria-disabled="true"]')) {
                const tag = el.rawTagName?.toLowerCase();
                const nativelyDisableable = ["button", "input", "select", "textarea", "fieldset"].includes(tag ?? "");
                const hasDisabled = el.getAttribute("disabled") !== undefined;
                if ((nativelyDisableable && !hasDisabled) || tag === "a") {
                    out.push(finding(el, RULES[16], "aria-disabled is set but the element remains functionally enabled."));
                }
            }
            return out;
        },
    },
    {
        id: "focus-outline-none",
        title: "Focus outline must not be removed without a replacement",
        wcag: ["2.4.7"],
        level: "AA",
        impact: "serious",
        fix: "Do not set outline:none without providing an equally visible focus style (e.g. a box-shadow ring).",
        check: (doc) => {
            const out = [];
            for (const el of doc.querySelectorAll("[style]")) {
                const outline = parseInlineStyle(el)["outline"];
                if (outline && /^(none|0(px)?)$/.test(outline.trim())) {
                    out.push(finding(el, RULES[17], "Inline style removes the focus outline; verify a visible replacement exists."));
                }
            }
            return out;
        },
    },
    {
        id: "aria-idref",
        title: "ARIA id references must resolve to an existing element",
        wcag: ["1.3.1", "4.1.2"],
        level: "A",
        impact: "serious",
        fix: "Point the ARIA relationship attribute at the id of an element that exists in the document.",
        check: (doc) => {
            const attrs = [
                "aria-labelledby",
                "aria-describedby",
                "aria-controls",
                "aria-owns",
                "aria-details",
                "aria-flowto",
            ];
            const out = [];
            for (const attr of attrs) {
                for (const el of doc.querySelectorAll(`[${attr}]`)) {
                    const ids = (el.getAttribute(attr) ?? "").trim().split(/\s+/).filter(Boolean);
                    const missing = ids.filter((id) => !doc.querySelector(`[id="${id}"]`));
                    if (missing.length) {
                        out.push(finding(el, RULES[18], `${attr} references missing id(s): ${missing.join(", ")}.`));
                    }
                }
            }
            return out;
        },
    },
];
export const RULE_INDEX = new Map(RULES.map((r) => [r.id, r]));
