// The accessibility release policy, encoded as data the tools enforce.
// Every non-negotiable is tagged by how it is verified:
//   - "automated": fully checkable from markup (linked to ruleset rule ids)
//   - "manual":    requires human/agent attestation
//   - "hybrid":    automated portion + a manual attestation
export const OBJECTIVE = "Ensure every shared component is accessible, consistent, testable, and supportable before release.";
export const ENFORCEMENT_PRINCIPLES = [
    "Accessibility is a release requirement, not a post-release enhancement.",
    "Native HTML is preferred over custom ARIA whenever possible.",
    "Keyboard, focus, semantics, and state exposure are mandatory for all interactive components.",
    "Release is blocked unless required automated and manual quality gates pass.",
];
export const DECISION_HIERARCHY = [
    { order: 1, rule: "Native semantics first." },
    { order: 2, rule: "ARIA APG pattern guidance next." },
    { order: 3, rule: "WCAG cognitive guidance for language, instructions, and error recovery." },
    { order: 4, rule: "Brand guidance — only after accessibility and semantics are resolved." },
    { order: 5, rule: "If brand conflicts with accessibility, accessibility wins." },
];
export const NON_NEGOTIABLES = [
    {
        id: "no-role-conflict",
        title: "No native/ARIA role conflicts.",
        verification: "automated",
        ruleIds: ["role-conflict", "valid-role"],
    },
    {
        id: "keyboard-contract",
        title: "Full keyboard interaction contract for all interactive/composite widgets.",
        verification: "manual",
        ruleIds: ["positive-tabindex"],
        manualCheck: "Confirm every documented key in the component's keyboard model is implemented (arrow/Home/End/Escape/Enter/Space as applicable).",
        appliesTo: ["interactive", "composite"],
    },
    {
        id: "focus-management",
        title: "Explicit focus handling for open/close/modal interactions.",
        verification: "manual",
        ruleIds: ["aria-hidden-focusable"],
        manualCheck: "Confirm focus moves in on open, is trapped where required, and returns to the trigger on close.",
        appliesTo: ["interactive", "composite"],
    },
    {
        id: "name-role-value-state",
        title: "Name, role, value, and state exposed and synchronized.",
        verification: "hybrid",
        ruleIds: ["control-label", "button-name", "link-name", "empty-heading"],
        manualCheck: "Confirm value and state (checked/expanded/selected/pressed) update in the accessibility tree as the component changes.",
    },
    {
        id: "disabled-state",
        title: "Disabled means visually and functionally disabled.",
        verification: "hybrid",
        ruleIds: ["aria-disabled-only"],
        manualCheck: "Confirm disabled controls are non-operable and visually communicated (not color-only).",
    },
    {
        id: "visible-focus",
        title: "Visible focus indicators must always be present.",
        verification: "hybrid",
        ruleIds: ["focus-outline-none"],
        manualCheck: "Confirm a visible focus indicator meeting 3:1 contrast is present for every focusable element.",
    },
    {
        id: "no-positive-tabindex",
        title: "No positive tabindex.",
        verification: "automated",
        ruleIds: ["positive-tabindex"],
    },
    {
        id: "form-labels-errors",
        title: "Forms must have persistent labels and actionable error guidance.",
        verification: "hybrid",
        ruleIds: ["control-label", "placeholder-label", "label-for-target"],
        manualCheck: "Confirm errors are announced, identify the field, and describe how to fix the problem.",
    },
    {
        id: "no-color-only",
        title: "Meaning cannot rely on color alone.",
        verification: "manual",
        ruleIds: [],
        manualCheck: "Confirm every status/meaning conveyed by color is also conveyed by text, icon, or shape.",
    },
    {
        id: "zoom-reflow-motion",
        title: "Components must support zoom, reflow, and reduced motion.",
        verification: "hybrid",
        ruleIds: ["viewport-zoom"],
        manualCheck: "Confirm content reflows without loss at 400% zoom / 320px and honors prefers-reduced-motion.",
    },
    {
        id: "forced-colors",
        title: "Forced-colors / high-contrast compatibility when relevant.",
        verification: "manual",
        ruleIds: [],
        manualCheck: "Confirm the component remains usable under forced-colors mode (system colors, visible borders).",
    },
    {
        id: "cognitive-clarity",
        title: "Cognitive clarity: plain language, consistent terms, clear next steps.",
        verification: "manual",
        ruleIds: [],
        manualCheck: "Confirm labels/instructions use plain, consistent language and each step has a clear next action.",
    },
];
export const NON_NEGOTIABLE_INDEX = new Map(NON_NEGOTIABLES.map((n) => [n.id, n]));
// The complete 9-stage release lifecycle. Each stage names the gate(s) or
// evidence that must be recorded before a component advances.
export const RELEASE_LIFECYCLE = [
    {
        order: 1,
        name: "Define purpose, scope, and usage boundaries",
        requires: ["Documented purpose", "Scope", "Usage boundaries"],
    },
    {
        order: 2,
        name: "Validate the native HTML option first",
        requires: ["Native-first evaluation recorded before any custom/ARIA approach"],
    },
    {
        order: 3,
        name: "Define API, States, Keyboard Model, and Focus Model",
        requires: ["Public API", "State model", "Keyboard model", "Focus model"],
    },
    {
        order: 4,
        name: "Implement with semantic and state integrity",
        requires: ["Native semantics preserved", "Visual and ARIA state synchronized"],
    },
    {
        order: 5,
        name: "Pass automated accessibility checks",
        requires: ["Automated Accessibility Gate: PASS"],
    },
    {
        order: 6,
        name: "Pass automated interaction/focus/state tests",
        requires: ["Interaction Test Gate: PASS"],
    },
    {
        order: 7,
        name: "Complete manual accessibility review",
        requires: ["Manual Accessibility Review: PASS", "Cognitive Review Gate: PASS"],
    },
    {
        order: 8,
        name: "Document support matrix and known limitations",
        requires: ["Support matrix (browser/input/assistive tech)", "Known limitations documented"],
    },
    {
        order: 9,
        name: "Pass enterprise release gate",
        requires: ["Enterprise Release Gate: PASS", "No critical defects open", "Release approval recorded"],
    },
];
/** Non-negotiables that apply to a given component kind. */
export function applicableNonNegotiables(kind) {
    return NON_NEGOTIABLES.filter((n) => !n.appliesTo || n.appliesTo.includes(kind));
}
// ---------------------------------------------------------------------------
// Enterprise release layer: Definition of Done, Required Gates, Risk Tiers.
// These sit ABOVE the twelve non-negotiables — the gates are the release
// checklist; the non-negotiables are the substance checked within them.
// ---------------------------------------------------------------------------
export const DEFINITION_OF_DONE = [
    "Implemented with semantic and state integrity.",
    "Passes automated accessibility checks.",
    "Passes automated interaction/focus/state tests.",
    "Manual accessibility review complete.",
    "Support matrix and known limitations documented.",
    "Enterprise Release Gate passed.",
];
export const REQUIRED_GATES = [
    {
        id: "definition-of-done",
        name: "Component Definition of Done",
        evidence: "attested",
        ruleIds: [],
        checklist: DEFINITION_OF_DONE,
    },
    {
        id: "automated-accessibility",
        name: "Automated accessibility gate",
        evidence: "automated",
        ruleIds: [],
        checklist: ["Full ruleset audit is clean at or above the blocking threshold."],
    },
    {
        id: "interaction-test",
        name: "Interaction test gate",
        evidence: "attested",
        ruleIds: [],
        checklist: ["keyboard-contract", "focus-management", "name-role-value-state"],
    },
    {
        id: "manual-accessibility-review",
        name: "Manual accessibility review",
        evidence: "attested",
        ruleIds: [],
        checklist: ["no-role-conflict", "disabled-state", "visible-focus", "name-role-value-state", "no-color-only"],
    },
    {
        id: "responsive-accessibility",
        name: "Responsive accessibility gate",
        evidence: "hybrid",
        ruleIds: ["viewport-zoom"],
        checklist: ["zoom-reflow-motion", "forced-colors"],
    },
    {
        id: "cognitive-review",
        name: "Cognitive review gate",
        evidence: "attested",
        ruleIds: [],
        checklist: ["cognitive-clarity", "form-labels-errors"],
    },
    {
        id: "enterprise-review",
        name: "Enterprise review gate",
        evidence: "attested",
        ruleIds: [],
        checklist: ["Support matrix documented", "Known limitations documented", "Enterprise sign-off recorded"],
    },
];
export const REQUIRED_GATE_INDEX = new Map(REQUIRED_GATES.map((g) => [g.id, g]));
export const RISK_TIERS = [
    { tier: 1, name: "Primitive controls", components: ["button", "text input", "link", "checkbox", "radio"] },
    { tier: 2, name: "Composite widgets", components: ["tabs", "accordion", "listbox", "menu button", "dialog", "tooltip"] },
    {
        tier: 3,
        name: "High-risk composites",
        components: ["combobox", "grid", "tree view", "tree grid", "date picker"],
    },
];
/** Map a component name to its risk tier, or null if unrecognized. */
export function resolveTier(component) {
    const c = component.trim().toLowerCase();
    for (const t of RISK_TIERS) {
        if (t.components.includes(c))
            return { tier: t.tier, name: t.name };
    }
    return null;
}
export const SUCCESS_CRITERIA = "Release proceeds only when all mandatory gates pass and no critical accessibility defects remain.";
export const IMPLEMENTATION_CHECKLIST = [
    {
        id: "A",
        name: "Discovery and design",
        items: [
            { id: "A1", text: "Document component purpose and use / do-not-use boundaries.", method: "design-time", ruleIds: [], gate: "definition-of-done" },
            { id: "A2", text: "Evaluate native HTML alternatives and record the decision.", method: "design-time", ruleIds: [], gate: "definition-of-done" },
            { id: "A3", text: "Select an approved primitive pattern before designing custom behavior.", method: "design-time", ruleIds: [], gate: "definition-of-done" },
            { id: "A4", text: "If a custom widget is required, open an exception recorded with an owner and expiry.", method: "attested", ruleIds: [], gate: "enterprise-review" },
        ],
    },
    {
        id: "B",
        name: "Accessibility contract definition",
        items: [
            { id: "B1", text: "Define keyboard entry/exit behavior.", method: "design-time", ruleIds: [], gate: "interaction-test" },
            { id: "B2", text: "Define arrow / Home / End / Escape behavior where applicable.", method: "design-time", ruleIds: [], gate: "interaction-test" },
            { id: "B3", text: "Define focus on open, during interaction, and on close.", method: "design-time", ruleIds: [], gate: "interaction-test" },
            { id: "B4", text: "Define accessible naming strategy (label, labelledby, or label fallback).", method: "design-time", ruleIds: [], gate: "manual-accessibility-review" },
            { id: "B5", text: "Define state model for selected / expanded / checked / pressed / current / value.", method: "design-time", ruleIds: [], gate: "interaction-test" },
            { id: "B6", text: "Define disabled behavior semantics and interaction blocking.", method: "design-time", ruleIds: [], gate: "manual-accessibility-review" },
        ],
    },
    {
        id: "C",
        name: "Implementation requirements",
        items: [
            { id: "C1", text: "Preserve native semantics unless a justified custom pattern is required.", method: "automated", ruleIds: ["role-conflict"], gate: "manual-accessibility-review" },
            { id: "C2", text: "Prevent role / state / property conflicts with native elements.", method: "automated", ruleIds: ["role-conflict", "valid-role"], gate: "manual-accessibility-review" },
            { id: "C3", text: "Keep visual state and ARIA state synchronized at all times.", method: "attested", ruleIds: [], gate: "interaction-test" },
            { id: "C4", text: "Ensure a visible focus ring in default, themed, and forced-colors contexts.", method: "hybrid", ruleIds: ["focus-outline-none"], gate: "manual-accessibility-review" },
            { id: "C5", text: "Avoid positive tabindex; use DOM order and approved roving tabindex only.", method: "automated", ruleIds: ["positive-tabindex"], gate: "automated-accessibility" },
            { id: "C6", text: "Ensure errors, status, and selection are not conveyed by color alone.", method: "attested", ruleIds: [], gate: "manual-accessibility-review" },
            { id: "C7", text: "Ensure labels are persistent; placeholders are not labels.", method: "automated", ruleIds: ["placeholder-label", "control-label"], gate: "automated-accessibility" },
            { id: "C8", text: "Support zoom / reflow and reduced-motion preferences.", method: "hybrid", ruleIds: ["viewport-zoom"], gate: "responsive-accessibility" },
        ],
    },
    {
        id: "D",
        name: "Automated validation",
        items: [
            { id: "D1", text: "Lint and semantic checks pass.", method: "automated", ruleIds: [], gate: "automated-accessibility" },
            { id: "D2", text: "No duplicate IDs.", method: "automated", ruleIds: ["duplicate-id"], gate: "automated-accessibility" },
            { id: "D3", text: "No broken aria-labelledby or aria-describedby references.", method: "automated", ruleIds: ["aria-idref"], gate: "automated-accessibility" },
            { id: "D4", text: "No missing accessible names for interactive elements.", method: "automated", ruleIds: ["control-label", "button-name", "link-name"], gate: "automated-accessibility" },
            { id: "D5", text: "No role conflict violations.", method: "automated", ruleIds: ["role-conflict"], gate: "automated-accessibility" },
            { id: "D6", text: "Automated accessibility scan passes (axe-equivalent).", method: "automated", ruleIds: [], gate: "automated-accessibility" },
            { id: "D7", text: "Contrast checks pass where covered.", method: "automated", ruleIds: ["contrast-inline"], gate: "automated-accessibility" },
        ],
    },
    {
        id: "E",
        name: "Interaction test coverage",
        items: [
            { id: "E1", text: "Keyboard navigation test coverage exists.", method: "attested", ruleIds: [], gate: "interaction-test" },
            { id: "E2", text: "Focus entry, containment, and exit coverage exists where applicable.", method: "attested", ruleIds: [], gate: "interaction-test" },
            { id: "E3", text: "Stateful interaction tests exist (expanded, selected, checked, pressed, etc.).", method: "attested", ruleIds: [], gate: "interaction-test" },
            { id: "E4", text: "Disabled-state behavior is tested.", method: "attested", ruleIds: [], gate: "interaction-test" },
            { id: "E5", text: "Open/close behavior is tested for overlays, popups, and dialogs.", method: "attested", ruleIds: [], gate: "interaction-test" },
            { id: "E6", text: "ARIA state assertions are included in tests.", method: "attested", ruleIds: [], gate: "interaction-test" },
        ],
    },
    {
        id: "F",
        name: "Manual validation",
        items: [
            { id: "F1", text: "Keyboard-only walkthrough completed.", method: "attested", ruleIds: [], gate: "manual-accessibility-review" },
            { id: "F2", text: "Screen reader review completed on target desktop stacks.", method: "attested", ruleIds: [], gate: "manual-accessibility-review" },
            { id: "F3", text: "Zoom and reflow behavior verified.", method: "attested", ruleIds: [], gate: "responsive-accessibility" },
            { id: "F4", text: "Forced-colors / high-contrast behavior verified when relevant.", method: "attested", ruleIds: [], gate: "responsive-accessibility" },
            { id: "F5", text: "Touch behavior verified when the component is touch-usable.", method: "attested", ruleIds: [], gate: "manual-accessibility-review" },
            { id: "F6", text: "Focus visibility verified across key states.", method: "attested", ruleIds: [], gate: "manual-accessibility-review" },
        ],
    },
    {
        // Supplementary section beyond the canonical A–H — dedicated home for the
        // cognitive-review gate's checklist items so they are not lost.
        id: "COG",
        name: "Cognitive review",
        items: [
            { id: "COG1", text: "Plain language used; jargon avoided or defined.", method: "attested", ruleIds: [], gate: "cognitive-review" },
            { id: "COG2", text: "Terminology and labels are consistent across the component and product.", method: "attested", ruleIds: [], gate: "cognitive-review" },
            { id: "COG3", text: "Instructions are available before the action that needs them.", method: "attested", ruleIds: [], gate: "cognitive-review" },
            { id: "COG4", text: "Each state or step presents a clear next action.", method: "attested", ruleIds: [], gate: "cognitive-review" },
            { id: "COG5", text: "Errors are explained in plain language with recovery guidance.", method: "attested", ruleIds: [], gate: "cognitive-review" },
            { id: "COG6", text: "Destructive or critical actions are reversible, confirmed, or error-checked.", method: "attested", ruleIds: [], gate: "cognitive-review" },
        ],
    },
    {
        id: "G",
        name: "Documentation and supportability",
        items: [
            { id: "G1", text: "API, variants, and states are documented.", method: "attested", ruleIds: [], gate: "definition-of-done" },
            { id: "G2", text: "Keyboard and focus behavior docs are published.", method: "attested", ruleIds: [], gate: "definition-of-done" },
            { id: "G3", text: "Known limitations are documented.", method: "attested", ruleIds: [], gate: "enterprise-review" },
            { id: "G4", text: "Support matrix includes browser / input / assistive-technology coverage.", method: "attested", ruleIds: [], gate: "enterprise-review" },
            { id: "G5", text: "Migration / versioning impact documented when applicable.", method: "attested", ruleIds: [], gate: "enterprise-review" },
        ],
    },
    {
        id: "H",
        name: "Final release gate",
        items: [
            { id: "H1", text: "All checklist gates are marked complete.", method: "attested", ruleIds: [], gate: "enterprise-review" },
            { id: "H2", text: "No critical accessibility defects remain open.", method: "automated", ruleIds: [], gate: "enterprise-review" },
            { id: "H3", text: "Exception documentation, if any, is approved and current.", method: "attested", ruleIds: [], gate: "enterprise-review" },
            { id: "H4", text: "Release approval recorded.", method: "attested", ruleIds: [], gate: "enterprise-review" },
        ],
    },
];
export const PROVENANCE_TIERS = [
    {
        kind: "deployed",
        rank: 1,
        name: "Deployed artifact in situ",
        satisfiesAutomatedGate: true,
        requires: "URL of the running app or pinned Storybook build",
        caveat: "Highest fidelity: real tokens, fonts, and page context.",
    },
    {
        kind: "package",
        rank: 2,
        name: "Published package bundle",
        satisfiesAutomatedGate: true,
        requires: "package name + exact version (integrity digest recommended)",
        caveat: "Exact bytes consumers install; must be mounted with the real theme.",
    },
    {
        kind: "ci-build",
        rank: 3,
        name: "CI build at a commit",
        satisfiesAutomatedGate: true,
        requires: "commit SHA (and pipeline/run id)",
        caveat: "Reproducible from source you control.",
    },
    {
        kind: "pasted",
        rank: 4,
        name: "Pasted snippet in a sandbox",
        satisfiesAutomatedGate: false,
        requires: "nothing — and that is the problem",
        caveat: "Smoke test only, NOT evidence: no build step, no dependencies, no design tokens, no page context. Contrast and focus results are unreliable in both directions.",
    },
    {
        kind: "unspecified",
        rank: 5,
        name: "Unspecified",
        satisfiesAutomatedGate: false,
        requires: "declare how the audited markup was obtained",
        caveat: "Provenance was not declared, so the audit cannot be tied to a known artifact.",
    },
];
export const PROVENANCE_INDEX = new Map(PROVENANCE_TIERS.map((p) => [p.kind, p]));
