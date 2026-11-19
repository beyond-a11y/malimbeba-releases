// The single canonical list of components a user can pick when generating
// UI: primitives (native elements, no APG contract needed), composites
// (backed by a full GUIDANCE contract), and the "design system" aggregate
// mode. Labels, tiers, and contract availability are all derived here so
// the MCP tool and both UI prompt builders can never show a component the
// others don't know about, or disagree on what to call it.
//
// No Node-only APIs — this (and everything it imports) is copied verbatim
// into ui/generated/ by scripts/build-ui-data.mjs and runs in the browser.
import { GUIDANCE } from "./component-guidance.js";
import { resolveTier, RISK_TIERS } from "../policy/policy.js";
const PRIMITIVE_LABELS = {
    button: "Button",
    "text input": "Text input",
    link: "Link",
    checkbox: "Checkbox",
    radio: "Radio group",
};
// Display labels for GUIDANCE-backed patterns. Every GUIDANCE component
// must have an entry here — the parity test enforces that.
const COMPOSITE_LABELS = {
    dialog: "Dialog / modal",
    "menu button": "Menu button",
    tabs: "Tabs",
    accordion: "Accordion",
    listbox: "Listbox",
    combobox: "Combobox",
    grid: "Data grid",
    "tree view": "Tree view",
    "tree grid": "Tree grid",
    "date picker": "Date picker",
    tooltip: "Tooltip",
};
export const DESIGN_SYSTEM_COMPONENT = "design system";
export const CATALOG = [
    ...Object.keys(PRIMITIVE_LABELS).map((component) => ({
        component,
        label: PRIMITIVE_LABELS[component],
        tier: resolveTier(component)?.tier ?? 1,
        hasContract: false,
    })),
    ...GUIDANCE.map((g) => ({
        component: g.component,
        label: COMPOSITE_LABELS[g.component] ?? g.component,
        tier: resolveTier(g.component)?.tier ?? 2,
        hasContract: true,
    })),
    {
        component: DESIGN_SYSTEM_COMPONENT,
        label: "Design system (multiple components)",
        tier: 3,
        hasContract: false,
    },
];
export const CATALOG_INDEX = new Map(CATALOG.map((c) => [c.component, c]));
export function catalogLabel(component) {
    return CATALOG_INDEX.get(component.trim().toLowerCase())?.label ?? component;
}
/** Display name for each risk tier, e.g. { 1: "Primitive controls", ... }. */
export const TIER_LABEL = Object.fromEntries(RISK_TIERS.map((t) => [t.tier, t.name]));
