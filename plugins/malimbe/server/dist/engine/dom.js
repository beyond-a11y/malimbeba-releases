/** Build a compact `<tag a="b">` snippet (opening tag only) for a finding. */
export function openTag(el) {
    const tag = el.rawTagName?.toLowerCase() ?? "element";
    const attrs = Object.entries(el.attributes)
        .map(([k, v]) => (v === "" ? k : `${k}="${truncate(v, 40)}"`))
        .join(" ");
    return attrs ? `<${tag} ${attrs}>` : `<${tag}>`;
}
/** Best-effort CSS-ish selector for a finding (tag + id/class). */
export function shortSelector(el) {
    const tag = el.rawTagName?.toLowerCase() ?? "*";
    const id = el.getAttribute("id");
    if (id)
        return `${tag}#${id}`;
    const cls = el.getAttribute("class");
    if (cls)
        return `${tag}.${cls.trim().split(/\s+/)[0]}`;
    return tag;
}
export function truncate(s, max) {
    const t = s.replace(/\s+/g, " ").trim();
    return t.length > max ? t.slice(0, max - 1) + "\u2026" : t;
}
/** Visible-ish text of an element (excludes nested markup). */
export function visibleText(el) {
    return el.text.replace(/\s+/g, " ").trim();
}
/** Does the element expose a non-empty accessible name via common paths? */
export function hasAccessibleName(el, doc) {
    const label = el.getAttribute("aria-label");
    if (label && label.trim())
        return true;
    const labelledby = el.getAttribute("aria-labelledby");
    if (labelledby && labelledby.trim()) {
        const ok = labelledby
            .trim()
            .split(/\s+/)
            .some((id) => doc.querySelector(`#${cssEscape(id)}`));
        if (ok)
            return true;
    }
    const title = el.getAttribute("title");
    if (title && title.trim())
        return true;
    return false;
}
/** Minimal CSS identifier escaping for querySelector by id. */
export function cssEscape(id) {
    return id.replace(/([^a-zA-Z0-9_-])/g, "\\$1");
}
/** Parse inline `style="a:b; c:d"` into a lookup. */
export function parseInlineStyle(el) {
    const style = el.getAttribute("style");
    if (!style)
        return {};
    const out = {};
    for (const decl of style.split(";")) {
        const idx = decl.indexOf(":");
        if (idx === -1)
            continue;
        const prop = decl.slice(0, idx).trim().toLowerCase();
        const val = decl.slice(idx + 1).trim();
        if (prop)
            out[prop] = val;
    }
    return out;
}
export const FOCUSABLE_SELECTOR = "a[href], button, input, select, textarea, [tabindex]";
// WAI-ARIA 1.2 role names (abstract roles intentionally excluded).
export const VALID_ARIA_ROLES = new Set([
    "alert", "alertdialog", "application", "article", "banner", "blockquote",
    "button", "caption", "cell", "checkbox", "code", "columnheader", "combobox",
    "complementary", "contentinfo", "definition", "deletion", "dialog",
    "document", "emphasis", "feed", "figure", "form", "generic", "grid",
    "gridcell", "group", "heading", "img", "insertion", "link", "list",
    "listbox", "listitem", "log", "main", "marquee", "math", "menu", "menubar",
    "menuitem", "menuitemcheckbox", "menuitemradio", "meter", "navigation",
    "none", "note", "option", "paragraph", "presentation", "progressbar",
    "radio", "radiogroup", "region", "row", "rowgroup", "rowheader",
    "scrollbar", "search", "searchbox", "separator", "slider", "spinbutton",
    "status", "strong", "subscript", "superscript", "switch", "tab", "table",
    "tablist", "tabpanel", "term", "textbox", "time", "timer", "toolbar",
    "tooltip", "tree", "treegrid", "treeitem",
]);
