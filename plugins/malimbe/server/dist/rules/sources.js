// Curated external references, distinct from the normative specs already
// cited elsewhere (WCAG success criteria, W3C HTML/WAI-ARIA specs, the APG —
// see promptBuilder.ts's "AUTHORITATIVE SOURCES" and each GUIDANCE entry's
// `wcag` field). These are practical: working examples, technique guides,
// and content/design guidance that back up "the best means possible" for
// both BUILDING and TESTING, not just citing which SC number applies.
//
// No Node-only APIs — copied into ui/generated/ by scripts/build-ui-data.mjs
// and used by both UI prompt builders (build AND audit/test prompts), same
// as catalog.ts and promptBuilder.ts.
export const EXTERNAL_REFERENCES = [
    {
        name: "MDN — HTML",
        url: "https://developer.mozilla.org/en-US/docs/Web/HTML",
        note: "The native element reference. Consult BEFORE reaching for ARIA — decision hierarchy step 1.",
        use: "build",
    },
    {
        name: "W3C WAI — Tutorials",
        url: "https://www.w3.org/WAI/tutorials/",
        note: "Working, annotated examples of common UI patterns (menus, forms, carousels, tables) built accessibly end to end.",
        use: "build",
    },
    {
        name: "W3C WAI — Tips for Designing",
        url: "https://www.w3.org/WAI/tips/designing/",
        note: "Short, practical accessible-design tips — useful before implementation exists, while a design is still being made.",
        use: "build",
    },
    {
        name: "digital.gov — Content design & information architecture",
        url: "https://digital.gov/guides/accessibility-for-teams/content-design/#information-architecture",
        note: "Accessible content structure and information architecture — decision hierarchy step 3 (cognitive/content guidance).",
        use: "build",
    },
    {
        name: "digital.gov — UX design, content-first",
        url: "https://digital.gov/guides/accessibility-for-teams/ux-design#content-start",
        note: "Accessible UX design guidance, content-first — pairs with the content-design guide above.",
        use: "build",
    },
    {
        name: "W3C WAI — Fundamentals",
        url: "https://www.w3.org/WAI/fundamentals/",
        note: "Foundational accessibility principles (POUR) and why they matter — the 'why' behind every other source here.",
        use: "build+test",
    },
    {
        name: "WebAIM — WCAG 2 Checklist (quick reference)",
        url: "https://webaim.org/resources/quickref/",
        note: "Example-annotated, practitioner-oriented WCAG success-criteria reference. Useful for BOTH building to a criterion and verifying against one during an audit.",
        use: "build+test",
    },
    {
        name: "WebAIM — Designer's resources",
        url: "https://webaim.org/resources/designers/",
        note: "Accessibility guidance aimed specifically at designers, not developers — for the design decisions upstream of code.",
        use: "build",
    },
    {
        name: "WebAIM — Using ARIA",
        url: "https://webaim.org/techniques/aria/",
        note: "Practical ARIA implementation techniques and the mistakes that most commonly break them. Consult AFTER confirming no native element fits — decision hierarchy step 2.",
        use: "build",
    },
];
export function referencesFor(use) {
    if (use === "all")
        return EXTERNAL_REFERENCES;
    return EXTERNAL_REFERENCES.filter((r) => r.use === use || r.use === "build+test");
}
