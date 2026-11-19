// Curated UX guidance served by a11y_ux_guidance and a11y://ux-guidance.
// Mirrors skills/ux-best-practices (see its references/ for the source catalogue
// and the paraphrase-only rule). Update on the 6-month review: bump the dates
// below and re-verify each source's `status`.
export const UX_REVIEW = {
    lastReviewed: "2026-10-26",
    nextReviewDue: "2027-04-26",
    cadenceMonths: 6,
};
export const UX_SOURCES = [
    { id: "nng-heuristics", title: "10 Usability Heuristics for User Interface Design", publisher: "NN/g", url: "https://www.nngroup.com/articles/ten-usability-heuristics/", status: "fetched" },
    { id: "nng-forms", title: "Website Forms Usability: Top 10 Recommendations", publisher: "NN/g", url: "https://www.nngroup.com/articles/web-form-design/", status: "partial" },
    { id: "nng-form-errors", title: "How to Report Errors in Forms: 10 Design Guidelines", publisher: "NN/g", url: "https://www.nngroup.com/articles/errors-forms-design-guidelines/", status: "partial" },
    { id: "nng-patterns", title: "Design-Pattern Guidelines (study guide)", publisher: "NN/g", url: "https://www.nngroup.com/articles/design-pattern-guidelines/", status: "partial" },
    { id: "laws-of-ux", title: "Laws of UX", publisher: "Jon Yablonski", url: "https://lawsofux.com/", status: "fetched" },
    { id: "govuk-principles", title: "Government design principles", publisher: "GOV.UK", url: "https://www.gov.uk/guidance/government-design-principles", status: "partial" },
    { id: "govuk-validation", title: "Validation pattern", publisher: "GOV.UK Design System", url: "https://design-system.service.gov.uk/patterns/validation/", status: "partial" },
    { id: "uswds-principles", title: "Design principles", publisher: "U.S. Web Design System", url: "https://designsystem.digital.gov/design-principles/", status: "partial" },
    { id: "inclusive-design", title: "Inclusive Design Principles", publisher: "Swan, Pouncey, Pickering, Watson", url: "https://inclusivedesignprinciples.info/", status: "partial" },
    { id: "wcag22-new", title: "What's New in WCAG 2.2", publisher: "W3C WAI", url: "https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/", status: "fetched" },
    { id: "coga", title: "Making Content Usable for People with Cognitive and Learning Disabilities", publisher: "W3C COGA Task Force (Working Group Note)", url: "https://www.w3.org/TR/coga-usable/", status: "partial" },
    { id: "apg-read-me", title: "ARIA APG: Read Me First", publisher: "W3C WAI", url: "https://www.w3.org/WAI/ARIA/apg/practices/read-me-first/", status: "partial" },
    { id: "apple-hig-ios", title: "Designing for iOS", publisher: "Apple Human Interface Guidelines", url: "https://developer.apple.com/design/human-interface-guidelines/designing-for-ios", status: "fetched" },
    { id: "apple-hig-a11y", title: "Accessibility", publisher: "Apple Human Interface Guidelines", url: "https://developer.apple.com/design/human-interface-guidelines/accessibility", status: "partial" },
    { id: "baymard-checkout", title: "Current state of checkout UX", publisher: "Baymard Institute", url: "https://baymard.com/research-articles/current-state-of-checkout-ux", status: "partial" },
    { id: "hax", title: "Guidelines for Human-AI Interaction", publisher: "Microsoft Research", url: "https://www.microsoft.com/en-us/research/blog/guidelines-for-human-ai-interaction-design/", status: "partial" },
    { id: "webdev-vitals", title: "Web Vitals", publisher: "Google web.dev", url: "https://web.dev/articles/vitals", status: "fetched" },
];
export const UX_TOPICS = [
    {
        id: "heuristics",
        title: "Usability heuristics and cross-source principles",
        confidence: "stable",
        summary: "NN/g's ten heuristics (unchanged since 1994) plus ideas that GOV.UK, USWDS, Inclusive Design and Laws of UX independently agree on.",
        rules: [
            "Show system status: acknowledge every action and show progress for waits.",
            "Use the user's words and conventions, not internal jargon.",
            "Give a clear exit: undo, cancel, back.",
            "Be consistent with the product and platform (Jakob's Law); consistent does not mean uniform.",
            "Prevent errors before reporting them; distinguish slips from mistakes.",
            "Prefer recognition over recall: keep options and needed information visible.",
            "Offer shortcuts for experts without burdening novices.",
            "Remove elements that compete with the relevant ones.",
            "Write error messages in plain language: what went wrong and how to fix it.",
            "Provide concise, task-focused, searchable help.",
            "Design for the user's context and real needs, not for a screen; design services, not just pages.",
            "Keep feedback fast (Doherty threshold, roughly 400 ms) and limit choices (Hick's law).",
            "Be liberal in what input you accept (Postel's law).",
        ],
        reviewQuestions: [
            "Which heuristic does each problem element violate, and what is the user impact?",
            "Where does the design depend on recall, jargon, or an unmarked exit?",
        ],
        sources: ["nng-heuristics", "laws-of-ux", "govuk-principles", "uswds-principles", "inclusive-design"],
        keywords: ["review", "critique", "audit", "usability", "heuristic", "flow", "screen", "page", "dashboard", "app"],
    },
    {
        id: "forms",
        title: "Forms, input, validation, and checkout",
        confidence: "stable",
        summary: "Keep forms short, label every field, accept varied input, and make errors specific and next to the field. Where to validate is contested between sources.",
        rules: [
            "Ask only for what the task needs; remove fields that can be derived, collected later, or dropped.",
            "Use persistent visible labels (never placeholder-only); put hints before the field and associate them programmatically.",
            "Match type, inputmode, and autocomplete to the data; allow paste and password managers.",
            "Prefer native controls; use visible radios or checkboxes instead of dropdowns for short option sets.",
            "Accept spaces, punctuation, and format variants in numbers and codes instead of rejecting them.",
            "Keep what the user typed after an error; never blame the user.",
            "Avoid reset or clear buttons beside submit.",
            "Do not use validation to decide eligibility; send people to a page that explains what to do next.",
            "Do not ask for the same information twice in one process (WCAG 3.3.7).",
            "For multi-step flows, label the steps, allow going back without data loss, and add a review step before an irreversible submit.",
            "Checkout: make guest checkout the most prominent option (Baymard benchmark; proprietary data, use as a prompt to test).",
        ],
        tensions: [
            "NN/g prefers inline validation after the user finishes a field; GOV.UK validates on submit and avoids on-blur validation. Both require specific, adjacent, actionable messages and preserved input. Default to submit-time validation with an error summary; add inline checks only where research shows they help (password rules, character counts).",
        ],
        reviewQuestions: [
            "Is every field's label visible, programmatically associated, and independent of placeholder text?",
            "After a failed submit: does focus move to an error summary, does each message sit next to its field, and is input preserved?",
            "Can any field be removed or deferred?",
        ],
        wcag: ["1.3.5", "3.3.1", "3.3.2", "3.3.3", "3.3.7", "3.3.8"],
        sources: ["nng-forms", "nng-form-errors", "govuk-validation", "baymard-checkout"],
        keywords: ["form", "input", "field", "login", "sign in", "signup", "register", "checkout", "payment", "address", "validation", "error", "wizard", "survey", "search box"],
    },
    {
        id: "navigation",
        title: "Navigation and findability",
        confidence: "stable",
        summary: "Shallow structures, user-language labels, consistent placement, and the right control for the job.",
        rules: [
            "Keep structure shallow and labels in user language; show where the user is and how to go back.",
            "Place global navigation and help in the same location on every page (WCAG 3.2.3, 3.2.6).",
            "Add search and meaningful filters once content outgrows browsing; show result counts and an easy way to clear filters.",
            "Links navigate and buttons act; do not blur the two.",
            "Check menus at every viewport size and with the keyboard.",
            "Support reachability on touch: important controls toward the middle or bottom of the screen, swipe-back where the platform expects it (Apple HIG).",
        ],
        reviewQuestions: [
            "Can a first-time visitor tell where they are and reach the main tasks in two steps?",
            "Is help in the same relative place on every page?",
        ],
        wcag: ["2.4.1", "2.4.4", "2.4.5", "2.4.7", "3.2.3", "3.2.6"],
        sources: ["nng-patterns", "apple-hig-ios", "wcag22-new"],
        keywords: ["nav", "menu", "tabs", "breadcrumb", "sidebar", "header", "footer", "search", "filter", "site", "landing", "tree", "explorer"],
    },
    {
        id: "feedback",
        title: "Feedback, status, and error recovery",
        confidence: "stable",
        summary: "Every action is acknowledged, every state is designed, and risky actions are reversible or clearly named.",
        rules: [
            "Acknowledge every action immediately; show progress for waits and keep layout stable.",
            "Confirm outcomes in text, not color or motion alone.",
            "Prefer undo over confirmation dialogs; reserve confirmations for destructive or costly actions and name the consequence on the button.",
            "Design empty, loading, partial, error, offline, and success states for every data-driven view.",
            "Announce important status changes to assistive technology without over-announcing (WCAG 4.1.3); primary content that updates continuously is not a status message.",
            "Do not report errors in tooltips and do not use an error summary as the only indication.",
        ],
        reviewQuestions: [
            "Which states are undesigned (empty, loading, error, offline)?",
            "Would a screen-reader user learn the outcome without moving focus?",
        ],
        wcag: ["3.3.1", "3.3.3", "4.1.3"],
        sources: ["nng-heuristics", "nng-form-errors", "govuk-validation"],
        keywords: ["toast", "notification", "alert", "status", "loading", "progress", "empty state", "undo", "delete", "confirm", "dialog", "modal", "snackbar"],
    },
    {
        id: "accessibility",
        title: "Accessibility requirements that shape UX",
        confidence: "standard",
        summary: "WCAG 2.2 interaction criteria, ARIA discipline, cognitive-accessibility objectives, and inclusive-design principles. This is supplemental to a11y_component_guidance and the audit tools.",
        rules: [
            "2.4.11 Focus Not Obscured (Minimum, AA): sticky headers and banners must not fully hide the focused element; use scroll-padding.",
            "2.5.7 Dragging Movements (AA): every drag has a single-pointer alternative.",
            "2.5.8 Target Size (Minimum, AA): targets at least 24 by 24 CSS px or sufficiently spaced; aim larger for touch.",
            "3.2.6 Consistent Help (A) and 3.3.7 Redundant Entry (A).",
            "3.3.8 Accessible Authentication (Minimum, AA): no cognitive-function test to sign in; allow paste and password managers.",
            "AAA additions worth adopting where feasible: 2.4.12, 2.4.13 Focus Appearance, 3.3.9.",
            "A role is a promise: use native elements first, and implement the keyboard behavior for any ARIA role you add.",
            "Cognitive access (supplemental, not required for WCAG conformance): help users understand what things are, find what they need, understand content, avoid and correct mistakes, stay focused, avoid relying on memory, get help, and adapt or personalize.",
            "Provide a comparable experience, not merely an alternative, and consider situation (bright sun, one hand, pressure).",
            "Support reflow at 320 CSS px, 200% text resize, contrast, visible focus, forced-colors, and reduced motion.",
        ],
        reviewQuestions: [
            "Does a sticky element ever cover the focused control?",
            "Is there a non-drag alternative for every drag interaction?",
            "Which of these are verifiable by automation, and which are manual gates?",
        ],
        wcag: ["2.4.11", "2.5.7", "2.5.8", "3.2.6", "3.3.7", "3.3.8"],
        sources: ["wcag22-new", "apg-read-me", "coga", "inclusive-design", "apple-hig-a11y"],
        keywords: ["accessible", "accessibility", "wcag", "keyboard", "screen reader", "focus", "contrast", "touch", "drag", "auth", "captcha"],
    },
    {
        id: "performance",
        title: "Performance as UX",
        confidence: "standard",
        summary: "Core Web Vitals at the 75th percentile of real-user loads. Re-verify thresholds on each review.",
        rules: [
            "LCP (loading) at or under 2.5 s; INP (responsiveness) at or under 200 ms; CLS (visual stability) at or under 0.1.",
            "Reserve space for images, embeds, and injected content (width/height or aspect-ratio).",
            "Ship less JavaScript and break up long main-thread tasks.",
            "Use responsive, modern-format images.",
            "Judge by field data; use lab tools only for diagnosis.",
        ],
        reviewQuestions: ["Does anything shift after load?", "What is the slowest interaction, and is there immediate feedback while it runs?"],
        sources: ["webdev-vitals"],
        keywords: ["performance", "speed", "slow", "lcp", "inp", "cls", "vitals", "image", "carousel", "hero", "load"],
    },
    {
        id: "visual-design",
        title: "Visual direction, content and responsive systems",
        confidence: "standard",
        summary: "From Malimbe's accessible-ui-design workflow: one coherent visual language, content and interaction designed together, accessibility applied while designing rather than after.",
        rules: [
            "Understand users, their primary task, the target framework and existing design system before styling; reuse project tokens and components.",
            "Choose a visual direction that fits the product and show it in composition, type, color, density and imagery; avoid generic SaaS layouts, interchangeable cards and decoration that competes with content.",
            "If no tokens exist, define a small consistent set (color, type scale, spacing, radius, elevation) before styling, and check text and non-text contrast for every token pair.",
            "Put the primary task and its next step where users find them; use plain, specific labels; distinguish actions from navigation; never rely on color, position or animation alone for meaning.",
            "Design empty, loading, success, error and disabled states, not only the happy path.",
            "Prefer native HTML controls; use a custom composite only when native cannot do it, and implement its APG contract.",
            "Build the working screen, not a static mockup, and check narrow and wide layouts, long content, 200% text resize, 400% zoom (320 CSS px reflow) and touch-sized targets.",
            "Render and inspect in a browser at representative sizes and states; do not assume the source renders as intended.",
        ],
        tensions: ["This topic is Malimbe's own synthesis of public design-skill projects, not a port of any source; the cited sources support only the inclusive-design and WCAG parts."],
        reviewQuestions: [
            "Is the visual direction specific to this product, or interchangeable with any template?",
            "Do all token pairs meet contrast, and does the layout reflow at 320 CSS px without two-dimensional scrolling?",
            "Is every state (empty, loading, error, disabled) designed?",
        ],
        wcag: ["1.4.3", "1.4.4", "1.4.10", "1.4.11", "1.4.12", "2.5.8"],
        sources: ["inclusive-design", "wcag22-new"],
        keywords: ["design", "visual", "style", "styling", "theme", "dark mode", "tokens", "design system", "landing", "redesign", "layout", "responsive", "typography", "color", "brand", "ui"],
    },
    {
        id: "motion",
        title: "Motion, animation and rich effects",
        confidence: "standard",
        summary: "Motion should communicate state, continuity or hierarchy and must never be required to understand or complete a task.",
        rules: [
            "Respect prefers-reduced-motion: remove or replace non-essential movement, parallax and autoplay.",
            "No unrequested autoplay, no flashing above three per second, and no motion that blocks input.",
            "Anything that moves, blinks or auto-updates for more than 5 seconds needs a pause, stop or hide control.",
            "Canvas, WebGL and 3D effects need an equivalent DOM experience and a usable fallback; effects must not hide content, controls, focus or status changes.",
            "Keep animation off the main thread where possible (transform and opacity) and stay within INP and CLS budgets.",
            "Keep the experience stable when scripts or effects are unavailable.",
        ],
        reviewQuestions: ["What happens with reduced motion on?", "Can a keyboard or screen-reader user get everything the animation shows?"],
        wcag: ["2.2.2", "2.3.1"],
        sources: ["wcag22-new", "webdev-vitals"],
        keywords: ["animation", "animate", "motion", "parallax", "scroll", "canvas", "webgl", "3d", "transition", "autoplay", "video", "effect", "immersive", "carousel", "hero"],
    },
    {
        id: "ai",
        title: "AI-powered features",
        confidence: "emerging",
        summary: "Anchored on Microsoft's 18 Human-AI interaction guidelines (CHI 2019: initially, during interaction, when wrong, over time). A design-conversation aid, not a checklist; developed for graphical interfaces.",
        rules: [
            "Make clear what the system can do and how well it can do it.",
            "Scope services when in doubt: offer options when the system is uncertain.",
            "Encourage granular feedback on individual suggestions.",
            "Keep the user in control: preview before applying, allow edit, undo, and opt-out; never apply consequential actions silently.",
            "Show status for long-running agent work and let users interrupt it.",
            "AI-generated output needs the same accessibility, usability, and content review as hand-built UI.",
        ],
        tensions: ["Only HAX guidelines 01, 02, 10 and 15 were read in full; the other 14 are unverified here. Trend claims about AI UX come from secondary commentary."],
        reviewQuestions: ["Can the user tell what the AI did, undo it, and stop it?", "Is the failure path designed, not just the success path?"],
        sources: ["hax"],
        keywords: ["ai", "assistant", "chatbot", "chat", "copilot", "agent", "generative", "llm", "suggestion", "recommendation"],
    },
    {
        id: "research",
        title: "Research and validation",
        confidence: "stable",
        summary: "Automated checks and heuristics are necessary, not sufficient.",
        rules: [
            "Test with real tasks and observe behavior; what people do differs from what they say.",
            "Small qualitative rounds (around five users) find most major issues when repeated and fixed; use larger samples for quantitative claims.",
            "Include assistive-technology users and people with cognitive and motor differences.",
            "Define success criteria (completion, time, errors, confidence) before testing.",
            "When authoritative sources disagree, decide with research on your own users.",
        ],
        reviewQuestions: ["What was not tested with real users or assistive technology, and is that disclosed?"],
        sources: ["nng-heuristics", "inclusive-design"],
        keywords: ["research", "test", "usability test", "validate", "prototype", "user testing"],
    },
];
export const UX_TOPIC_INDEX = new Map(UX_TOPICS.map((t) => [t.id, t]));
export const UX_SOURCE_INDEX = new Map(UX_SOURCES.map((s) => [s.id, s]));
/** Pick topics relevant to a free-text task. Falls back to the cross-cutting set. */
export function selectTopics(task) {
    const text = task.toLowerCase();
    const scored = UX_TOPICS.map((topic) => ({
        topic,
        score: topic.keywords.filter((k) => text.includes(k)).length,
    })).filter((x) => x.score > 0);
    scored.sort((a, b) => b.score - a.score);
    const picked = scored.map((x) => x.topic);
    for (const id of ["heuristics", "feedback", "accessibility"]) {
        const t = UX_TOPIC_INDEX.get(id);
        if (t && !picked.includes(t))
            picked.push(t);
    }
    return picked;
}
export function reviewStatus(now = new Date()) {
    const due = new Date(`${UX_REVIEW.nextReviewDue}T00:00:00Z`);
    if (now.getTime() > due.getTime()) {
        return {
            stale: true,
            message: `This guidance was last reviewed ${UX_REVIEW.lastReviewed} and its ${UX_REVIEW.cadenceMonths}-month review was due ${UX_REVIEW.nextReviewDue}. Treat the [standard] and [emerging] items as possibly out of date and say so.`,
        };
    }
    return {
        stale: false,
        message: `Last reviewed ${UX_REVIEW.lastReviewed}; next review due ${UX_REVIEW.nextReviewDue}.`,
    };
}
