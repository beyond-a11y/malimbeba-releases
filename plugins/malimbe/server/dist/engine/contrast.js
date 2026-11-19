// WCAG 2.x relative-luminance and contrast-ratio math (SC 1.4.3 / 1.4.6).
// Supports #hex, #rrggbb, rgb()/rgba(), and a subset of CSS named colors.
const NAMED_COLORS = {
    black: "#000000",
    white: "#ffffff",
    red: "#ff0000",
    green: "#008000",
    blue: "#0000ff",
    gray: "#808080",
    grey: "#808080",
    silver: "#c0c0c0",
    yellow: "#ffff00",
    orange: "#ffa500",
    purple: "#800080",
    navy: "#000080",
    teal: "#008080",
    lime: "#00ff00",
    maroon: "#800000",
    olive: "#808000",
    transparent: "transparent",
};
/** Parse a CSS color string into 0-255 RGB, or null if unparseable/transparent. */
export function parseColor(input) {
    const raw = input.trim().toLowerCase();
    const named = NAMED_COLORS[raw];
    const value = named ?? raw;
    if (value === "transparent")
        return null;
    if (value.startsWith("#")) {
        let hex = value.slice(1);
        if (hex.length === 3) {
            hex = hex
                .split("")
                .map((c) => c + c)
                .join("");
        }
        if (hex.length !== 6)
            return null;
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        if ([r, g, b].some((n) => Number.isNaN(n)))
            return null;
        return { r, g, b };
    }
    const rgbMatch = value.match(/rgba?\(([^)]+)\)/);
    if (rgbMatch && rgbMatch[1]) {
        const parts = rgbMatch[1].split(",").map((p) => parseFloat(p.trim()));
        if (parts.length >= 3 && parts.slice(0, 3).every((n) => !Number.isNaN(n))) {
            return { r: parts[0], g: parts[1], b: parts[2] };
        }
    }
    return null;
}
function channelLuminance(c) {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}
export function relativeLuminance({ r, g, b }) {
    return (0.2126 * channelLuminance(r) +
        0.7152 * channelLuminance(g) +
        0.0722 * channelLuminance(b));
}
/** Contrast ratio between two colors, 1.0 (none) to 21.0 (max). */
export function contrastRatio(a, b) {
    const l1 = relativeLuminance(a);
    const l2 = relativeLuminance(b);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
}
