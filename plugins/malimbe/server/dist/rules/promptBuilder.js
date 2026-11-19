// Single source of truth for "generate an accessible component" prompts.
//
// Consumed directly by the a11y_build_prompt MCP tool, and — via the
// compiled JS, copied verbatim into ui/generated/ by
// scripts/build-ui-data.mjs — by both UI prompt builders (ui/index.html,
// ui/guided.html). This file and everything it imports must stay free of
// Node-only APIs: it runs unmodified in a browser.
//
// This replaces three previously independent, hand-maintained copies of
// the same logic (the old a11y_build_prompt, and each UI's own
// buildGenerate()/buildPrompt()), which had drifted out of sync.
import { GUIDANCE_INDEX } from "./component-guidance.js";
import { CATALOG_INDEX, DESIGN_SYSTEM_COMPONENT, catalogLabel } from "./catalog.js";
import { DECISION_HIERARCHY, NON_NEGOTIABLES, resolveTier } from "../policy/policy.js";
import { referencesFor } from "./sources.js";
/** Design-file sources describe the intended visual/interaction spec — they are never rendered artifacts and can never satisfy the automated release gate. */
export const DESIGN_FILE_KINDS = ["figma", "xd", "screenshot"];
/** ~150KB of base64 — large enough for a typical UI screenshot, small enough not to blow out a pasted prompt. */
export const MAX_INLINE_IMAGE_DATA_URI_LENGTH = 200_000;
export const FRAMEWORK_NAMES = {
    html: "HTML",
    react: "React",
    vue: "Vue",
    angular: "Angular",
    blazor: "Blazor (Telerik UI)",
    "web-components": "Web Components",
};
const FRAMEWORK_NOTES = {
    html: [
        "Use the native element wherever one exists.",
        "Add ARIA only for behavior HTML has no element for.",
    ],
    react: [
        "Render real semantic elements; do not spread role onto a <div> when a native element exists.",
        "Forward refs to the underlying DOM node so focus can be managed.",
        "Drive ARIA state from component state so visual and accessibility-tree state never diverge.",
        "Prefer uncontrolled native inputs; if controlled, keep label association intact.",
    ],
    angular: [
        "Use the Angular CDK a11y module (FocusTrap, LiveAnnouncer, FocusMonitor, ListKeyManager) rather than hand-rolling.",
        "Bind ARIA attributes with [attr.aria-*] to component state.",
        "Use cdkTrapFocus for overlays and restore focus on close.",
    ],
    blazor: [
        "Prefer Telerik UI for Blazor components, which ship WAI-ARIA support; do not strip their built-in roles/attributes.",
        "Verify Telerik's keyboard and focus behavior against the APG pattern; fill gaps rather than replacing semantics.",
        "Keep custom CSS from removing Telerik's focus indicators.",
        "Bind ARIA/state through component parameters so server-rendered and interactive states agree.",
    ],
    vue: [
        "Render native semantic elements in templates; avoid role on <div> where a native tag fits.",
        "Bind :aria-* to reactive state so the accessibility tree tracks the UI.",
        "Use template refs to manage focus for open/close interactions.",
    ],
    "web-components": [
        "Use delegatesFocus and reflect ARIA state to attributes; expose parts for focus-ring styling.",
        "Wire ARIA relationships (aria-labelledby/describedby) inside the shadow tree — IDREFs do not cross the shadow boundary, so a slotted title/label leaves the element unnamed.",
        "For modal/composite widgets, add an explicit keyboard focus trap over the flattened focusables (shadow controls plus each slot's assignedElements); native focus containment is unreliable when content is slotted.",
        "Ensure the shadow DOM does not trap or hide the accessible name; wire ARIA relationships with real ids.",
        "Provide slotted labels and keep form association (ElementInternals) for controls.",
    ],
};
export const PLATFORM_NAMES = {
    web: "Web (all platforms)",
    ios: "iOS",
    android: "Android",
    windows: "Windows",
    macos: "macOS",
};
export const PLATFORM_NOTES = {
    web: [
        "Support 400% zoom and reflow to a 320px-wide viewport with no loss of content.",
        "Honor prefers-reduced-motion and forced-colors.",
        "Verify against desktop screen-reader stacks.",
    ],
    ios: [
        "Minimum 44x44pt touch targets.",
        "Verify with VoiceOver; support Dynamic Type scaling.",
        "Respect Reduce Motion and Increase Contrast settings.",
    ],
    android: [
        "Minimum 48x48dp touch targets.",
        "Verify with TalkBack; support font-scale up to 200%.",
        "Respect the system reduced-motion setting.",
    ],
    windows: [
        "Verify keyboard operation and a screen-reader stack (Narrator/NVDA/JAWS).",
        "Support Windows High Contrast / forced-colors mode with visible borders and focus.",
        "Support OS text scaling to 200%.",
    ],
    macos: [
        "Verify with VoiceOver and full keyboard access.",
        "Respect Reduce Motion and Increase Contrast.",
        "Support display zoom without clipping.",
    ],
};
const PRIMITIVE_NOTE = 'Use the native element (<button>, <input>, <a href>, <input type="checkbox"/"radio">). ' +
    "Do not re-implement it with ARIA. Ensure a programmatic label, visible focus, and correct disabled semantics.";
// A radio button is never really solo — the catalog labels it "Radio group"
// for exactly this reason (catalog.ts) — but until this note existed, the
// generated contract was identical to button/link/checkbox/text-input's:
// entirely silent on the one thing that makes it a GROUP pattern. Found by
// live-testing "build an accessible radio group" through the actual MCP
// tool and reading contractBlock()'s source, not assumed.
const RADIO_GROUP_NOTE = "A set of radio options is a GROUP pattern, not a lone control: give every option the same " +
    '`name` (native mutual exclusivity plus arrow-key roving between options, for free) and wrap the ' +
    "set in `<fieldset><legend>...</legend>...</fieldset>` for a group-level accessible name distinct " +
    'from each option\'s own label — fall back to `role="radiogroup"` with `aria-label`/`aria-labelledby` ' +
    "only when `<fieldset>` genuinely can't be used. Each option still needs its own `<label>`. Either " +
    'pre-select a sensible default or make "no selection yet" a valid, clearly indicated state — never ' +
    "leave a required group with nothing selected and no way to tell.";
const DESIGN_SYSTEM_NAMES = {
    none: "None",
    deployed: "Deployed app / pinned Storybook URL",
    package: "Published package bundle",
    "ci-build": "Repository at commit",
    figma: "Figma file/frame link",
    xd: "Adobe XD file/link",
    screenshot: "Screenshot / mockup image",
};
const GENERATE_TOOLS = ["a11y_component_guidance", "a11y_ux_guidance", "a11y_browser_check", "a11y_audit_demo", "a11y_release_gate", "a11y_checklist", "a11y_manifest_record"];
/**
 * MCP setup snippet for a given agent, naming the SPECIFIC tools this
 * prompt actually calls (not a fixed list) — exported so
 * auditPromptBuilder.ts can reuse it with the audit-relevant tool set
 * instead of re-declaring the setup boilerplate a third time.
 */
export function mcpSetupBlock(agent, tools = GENERATE_TOOLS) {
    const toolList = tools.join(", ");
    if (agent === "claude-code") {
        return `Setup (Claude Code):\n  claude mcp add accessibility -- node /ABS/PATH/dist/index.js\nThen call its tools: ${toolList}.`;
    }
    if (agent === "codex") {
        return `Setup (Codex, ~/.codex/config.toml):\n  [mcp_servers.accessibility]\n  command = "node"\n  args = ["/ABS/PATH/dist/index.js"]\nThen call its tools: ${toolList}.`;
    }
    return `Setup (any MCP client):\n  { "mcpServers": { "accessibility": { "command": "node", "args": ["/ABS/PATH/dist/index.js"] } } }\nThen call its tools: ${toolList}.`;
}
function contractBlock(component) {
    if (!component || component === DESIGN_SYSTEM_COMPONENT) {
        return ("For each component, pull its APG contract (roles, ARIA, keyboard, focus) before " +
            "implementing — call a11y_component_guidance if the MCP server is connected. " +
            "Start from primitives, then composites.");
    }
    const g = GUIDANCE_INDEX.get(component.trim().toLowerCase());
    if (!g) {
        const key = component.trim().toLowerCase();
        if (key === "radio")
            return `ACCESSIBILITY CONTRACT\n- ${PRIMITIVE_NOTE}\n- ${RADIO_GROUP_NOTE}`;
        return `ACCESSIBILITY CONTRACT\n- ${PRIMITIVE_NOTE}`;
    }
    const kb = g.keyboard.map((k) => `  - ${k.key}: ${k.action}`).join("\n");
    return (`ACCESSIBILITY CONTRACT for a ${catalogLabel(component)} (WAI-ARIA APG):\n` +
        `- Roles: ${g.roles.join(", ")}\n` +
        `- ARIA: ${g.aria.join("; ")}\n` +
        `- Keyboard:\n${kb}\n` +
        `- Focus: ${g.focus.join(" ")}\n` +
        `- Avoid: ${g.pitfalls.join("; ")}`);
}
function tierRigorLine(component) {
    const tier = component ? resolveTier(component)?.tier ?? null : null;
    if (tier === 3)
        return "Tier 3 (high-risk composite): full interaction-test coverage, manual screen-reader review, and explicit focus/state modeling are mandatory.";
    if (tier === 2)
        return "Tier 2 (composite widget): keyboard contract, focus management, and interaction tests are mandatory.";
    if (tier === 1)
        return "Tier 1 (primitive control): prefer the native element; verify name, focus, and disabled semantics.";
    return "Unresolved — identify the pattern first, then apply the rigor its tier requires.";
}
function sourceOfTruthBlock(ds) {
    if (!ds || ds.kind === "none" || !ds.ref)
        return [];
    const isDesignFile = DESIGN_FILE_KINDS.includes(ds.kind);
    const lines = [
        "SOURCE OF TRUTH — conform to this, do not invent:",
        `- ${DESIGN_SYSTEM_NAMES[ds.kind]}: ${ds.ref}`,
        "- Inspect it FIRST. Reuse its existing design tokens, naming conventions, and component API patterns.",
        "- If an equivalent component already exists there, extend or wrap it rather than creating a duplicate.",
        "- Where this source conflicts with the accessibility rules below, accessibility wins — and say so explicitly.",
    ];
    if (isDesignFile) {
        lines.push("- This is a DESIGN FILE, not a rendered artifact: it specifies visuals, layout, states, and interactions, but it was never audited and cannot itself satisfy the automated release gate.", "- States shown in the file (hover/focus/disabled/error/loading/empty) are a floor, not a ceiling — add any the file omits but the pattern's contract requires (e.g. visible focus, keyboard-only affordances).", "- Once built, the CODE's own provenance (deployed / package / ci-build) is what a11y_release_gate records — not this design file reference.");
        if (ds.kind === "screenshot") {
            lines.push("- A screenshot is a single static frame: it cannot show hover/focus/disabled/error/loading states, keyboard behavior, or motion — infer and implement all of those from the pattern's contract below, and flag any layout ambiguity the image leaves open rather than guessing silently.");
            if (ds.imageDataUri && ds.imageDataUri.length <= MAX_INLINE_IMAGE_DATA_URI_LENGTH) {
                lines.push("- ATTACHED IMAGE (embedded below as a data URI): first try to view the Markdown image. Some external interfaces strip or refuse to render data: URIs; if it does not render, preserve the RAW IMAGE DATA URI block and ask the user to attach the original file directly rather than guessing at the design.", "", `![design screenshot](${ds.imageDataUri})`, "", "RAW IMAGE DATA URI (transport fallback — preserve this exact line if the image above is not rendered):", "```text", ds.imageDataUri, "```", "");
            }
            else if (ds.imageDataUri) {
                lines.push("- The image was too large to embed inline; ask the user to attach the file directly alongside this prompt.");
            }
        }
    }
    else {
        lines.push("- Record this reference as the provenance of whatever you produce.");
    }
    lines.push("");
    return lines;
}
function tokensBlock(tokens) {
    if (!tokens || !tokens.trim())
        return [];
    return [
        "DESIGN TOKENS — use these values/names verbatim; do not invent new ones or hardcode raw values where a token below applies:",
        tokens.trim(),
        "",
    ];
}
// Generic states/variants every interactive component needs a real design and
// implementation for, independent of any specific APG pattern — this is the
// list a screenshot or a single Figma frame typically only shows one of.
const GENERIC_STATES = [
    "Default / resting",
    "Hover (pointer)",
    "Focus-visible (keyboard)",
    "Active / pressed",
    "Disabled",
    "Error / invalid",
    "Loading / busy",
    "Empty (no data/selection)",
    "RTL / bidi layout",
];
// Pattern-specific states inferred from the ARIA attributes its own contract
// already declares, so this list can never drift from GUIDANCE by hand-
// maintaining a second copy of the same facts.
const ARIA_STATE_HINTS = [
    { match: /aria-expanded/i, label: "Expanded vs. collapsed" },
    { match: /aria-selected/i, label: "Selected vs. unselected" },
    { match: /aria-checked/i, label: "Checked / unchecked / mixed" },
    { match: /aria-pressed/i, label: "Pressed (toggle) vs. not pressed" },
    { match: /aria-current/i, label: "Current-item indicator" },
    { match: /aria-invalid/i, label: "Invalid vs. valid" },
    { match: /aria-busy/i, label: "Busy/loading announced to assistive tech" },
    { match: /aria-modal/i, label: "Open vs. closed (modal)" },
    { match: /aria-disabled/i, label: "Disabled" },
];
function statesChecklistBlock(component) {
    if (!component || component === DESIGN_SYSTEM_COMPONENT)
        return [];
    const g = GUIDANCE_INDEX.get(component.trim().toLowerCase());
    const extra = g ? ARIA_STATE_HINTS.filter((h) => g.aria.some((a) => h.match.test(a))).map((h) => h.label) : [];
    const items = [...GENERIC_STATES, ...extra];
    return [
        "STATES & VARIANTS CHECKLIST (confirm each is designed and implemented — a mockup or screenshot usually only shows the default state):",
        ...items.map((s) => `- [ ] ${s}`),
        "",
    ];
}
function implementationReadinessBlock(component) {
    const tier = component ? resolveTier(component)?.tier ?? null : null;
    const lines = [
        "IMPLEMENTATION READINESS (complete this before presenting the component):",
        "- Produce working component code, not a scaffold, pseudocode, TODO list, or visual-only mockup. Every control, event, state transition, and ARIA relationship in the contract must be wired and executable.",
        "- Keep the semantic source of truth in component state: every visual state must have the corresponding native/ARIA state, and every native/ARIA state change must update the visible UI. Do not use color alone to communicate a state.",
        component
            ? "- Implement every item in the STATES & VARIANTS CHECKLIST, including states the design source does not show. If a state is not meaningful for this component, state why in the self-audit rather than silently omitting it."
            : "- Once the pattern is identified, implement every applicable interaction state, including states the design source does not show. If a state is not meaningful for the resolved component, state why in the self-audit rather than silently omitting it.",
        "- Use real labels, ids, event handlers, and focus targets. Do not leave placeholder handlers, dead buttons, broken links, unresolved imports, missing assets, or console errors in the delivered component.",
        "- After implementation, run the project's existing build/typecheck/test command discovered from its package or framework configuration. Fix errors and rerun the same command before reporting completion.",
    ];
    if (tier === 2 || tier === 3) {
        lines.push("- For this composite widget, model open/close and loading/error/empty/disabled transitions explicitly; move focus on entry, constrain Tab/Shift+Tab to the active widget when required, handle Escape where the contract requires it, and restore focus to the trigger on close.");
    }
    lines.push("");
    return lines;
}
/**
 * The mandatory post-generation verify chain: what AGENTS.md requires an
 * armed workspace to do automatically, made explicit here so a pasted
 * prompt carries the same instruction into an agent that has no other way
 * to know it, even when Malimbe's MCP tools ARE available to it.
 */
function verifyChainBlock(component) {
    return [
        "VERIFY (do this, don't just claim it):",
        "- Optional but recommended: call a11y_browser_check first to confirm a browser-backed audit is ready — avoids a slow or failing audit call if one isn't.",
        "- If the accessibility MCP server is connected, run a11y_audit_demo on the code you just wrote. Prefer response_format=\"json\" when you'll feed its evidence_ref/audit_id straight into a11y_release_gate next — skips parsing an id out of markdown.",
        "- Demo, example, prototype, or other one-off NOT part of a governed library: a clean automated pass plus honest manual-gate disclosure (last bullet below) is a sufficient stopping point — a11y_release_gate / a11y_manifest_record are for components entering a governed library or release, not required here.",
        "- Part of a shared/governed library, or being prepared for release: continue — run a11y_release_gate" +
            (component ? ` with component=\"${component}\"` : "") +
            " using the evidence_ref and audit_id returned by the browser audit, plus reviewer-attributed attestations for manual gates. Treat a BLOCKED verdict as a stop, not a warning — but read WHY before assuming the code is broken.",
        "- Defects listed in the verdict are real: fix and re-run. \"insufficient provenance\" on an otherwise-clean audit is the EXPECTED result right after a11y_audit_demo, not a defect — pasted/sandbox evidence can never satisfy the automated gate by design. That's a process step, not a code problem: commit or deploy the component, then re-audit with real provenance (ci-build / package / deployed) before expecting a PASS.",
        "- Record it with a11y_manifest_record.",
        "- A clean automated pass is necessary, not sufficient. State plainly which manual gates you did " +
            "NOT perform (keyboard-flow walkthrough, screen-reader output, cognitive review). Never report a " +
            'component as "fully accessible" — report it as "passes automated A+AA; manual gates pending: [list]".',
        "",
    ];
}
export function buildPrompt(input) {
    const framework = input.framework ?? "html";
    const platform = input.platform ?? "web";
    const wcagLevel = input.wcagLevel ?? "A and AA";
    const agent = input.agent ?? "generic";
    const includeTests = input.includeTests ?? true;
    const includeMcpSetup = input.includeMcpSetup ?? true;
    const component = input.component?.trim().toLowerCase();
    const lines = [];
    const scope = component
        ? component === DESIGN_SYSTEM_COMPONENT
            ? "an accessible design system"
            : `an accessible ${catalogLabel(component)}`
        : (input.task ?? "the requested UI");
    const taskLine = input.task
        ? `Build the following in ${FRAMEWORK_NAMES[framework]}: ${input.task}`
        : `You are building ${scope} in ${FRAMEWORK_NAMES[framework]} targeting ${PLATFORM_NAMES[platform]}.`;
    lines.push(`${taskLine} Conform to WCAG 2.2 ${wcagLevel}.`);
    lines.push("");
    lines.push(...sourceOfTruthBlock(input.designSystem));
    lines.push(...tokensBlock(input.designTokens));
    lines.push("AUTHORITATIVE SOURCES (defaults, in order):");
    lines.push(`- WCAG 2.2 ${wcagLevel} success criteria`);
    lines.push("- W3C HTML and WAI-ARIA specifications");
    lines.push("- WAI-ARIA Authoring Practices Guide (APG) for interaction patterns");
    lines.push("");
    lines.push("PRACTICAL REFERENCES (working examples and technique guides — consult these, don't guess):");
    referencesFor("build").forEach((r) => lines.push(`- ${r.name} — ${r.url}\n  ${r.note}`));
    lines.push("");
    lines.push("RESOLVE EVERY DESIGN DECISION IN THIS ORDER:");
    DECISION_HIERARCHY.forEach((h) => lines.push(`  ${h.order}. ${h.rule}`));
    lines.push("");
    lines.push(`RISK: ${tierRigorLine(component)}`);
    lines.push("");
    lines.push(contractBlock(component));
    lines.push("");
    lines.push(...statesChecklistBlock(component));
    lines.push(...implementationReadinessBlock(component));
    lines.push(`${FRAMEWORK_NAMES[framework].toUpperCase()} REQUIREMENTS:`);
    FRAMEWORK_NOTES[framework].forEach((n) => lines.push(`- ${n}`));
    lines.push("");
    lines.push(`${PLATFORM_NAMES[platform].toUpperCase()} CONSIDERATIONS:`);
    PLATFORM_NOTES[platform].forEach((n) => lines.push(`- ${n}`));
    lines.push("");
    lines.push("NON-NEGOTIABLE RULES (all must hold):");
    NON_NEGOTIABLES.forEach((n) => lines.push(`- ${n.title}`));
    lines.push("");
    if (includeMcpSetup) {
        lines.push("TOOLS IN THE PAYLOAD (use them):");
        lines.push(mcpSetupBlock(agent));
        lines.push("- Skills: the bundled accessibility skills carry the pattern guidance; consult them while implementing.");
        lines.push("");
    }
    lines.push("DELIVERABLES:");
    lines.push(`- The component code in ${FRAMEWORK_NAMES[framework]}, preferring native elements over ARIA.`);
    if (includeTests) {
        lines.push("- Interaction/focus/state tests, including ARIA state assertions and open/close (if applicable).");
    }
    if (input.designSystem && input.designSystem.kind !== "none" && input.designSystem.ref) {
        lines.push(DESIGN_FILE_KINDS.includes(input.designSystem.kind)
            ? `- A provenance statement: once deployed/packaged/built, record THAT artifact's reference (not the design file, ${input.designSystem.ref}) as the release gate's provenance.`
            : `- A provenance statement: the source artifact you built against (${input.designSystem.ref}) and how the output was produced, so the release gate can record it.`);
    }
    lines.push("- A self-audit against the non-negotiables above, listing anything you could not satisfy and why.");
    lines.push("");
    lines.push(...verifyChainBlock(component));
    lines.push("CONSTRAINTS: never disable zoom, never use positive tabindex, never rely on color alone, and keep visual state and ARIA state synchronized at all times.");
    return lines.join("\n");
}
/**
 * A standalone handoff document \u2014 for a ticket, a design review, or a
 * developer who isn't the one pasting buildPrompt()'s output into an agent.
 * Reuses the exact same contract/tokens/states/source facts as buildPrompt()
 * so the two can never disagree, but formatted to be read by a person, not
 * executed by an agent: no MCP setup, no verify-chain imperatives.
 */
export function buildHandoffSpec(input) {
    const framework = input.framework ?? "html";
    const platform = input.platform ?? "web";
    const wcagLevel = input.wcagLevel ?? "A and AA";
    const component = input.component?.trim().toLowerCase();
    const title = component ? catalogLabel(component) : input.task ?? "Untitled component";
    const lines = [];
    lines.push(`# Handoff spec \u2014 ${title}`);
    lines.push("");
    lines.push("## Summary");
    lines.push(`- Pattern: ${component ? catalogLabel(component) : "not yet identified \u2014 resolve to a WAI-ARIA APG pattern before building"}`);
    lines.push(`- Target: ${FRAMEWORK_NAMES[framework]} on ${PLATFORM_NAMES[platform]}`);
    lines.push(`- WCAG conformance target: 2.2 ${wcagLevel}`);
    lines.push(`- Risk tier: ${tierRigorLine(component)}`);
    if (input.task)
        lines.push(`- Description: ${input.task}`);
    lines.push("");
    const source = sourceOfTruthBlock(input.designSystem);
    if (source.length) {
        lines.push("## Source of truth");
        lines.push(...source);
    }
    const tokens = tokensBlock(input.designTokens);
    if (tokens.length) {
        lines.push("## Design tokens");
        lines.push(...tokens);
    }
    lines.push("## Accessibility contract");
    lines.push(contractBlock(component));
    lines.push("");
    const states = statesChecklistBlock(component);
    if (states.length) {
        lines.push("## States & variants checklist");
        lines.push(...states);
    }
    lines.push("## Open questions / caveats for the developer");
    lines.push("- This spec describes intent, not a release verdict: it has not been through a11y_audit_demo or a11y_release_gate.");
    lines.push("- Manual gates not covered by anything above: keyboard-only walkthrough, screen-reader output, cognitive review.");
    if (input.designSystem && DESIGN_FILE_KINDS.includes(input.designSystem.kind)) {
        lines.push("- The design source above is a design file, not a rendered artifact \u2014 it cannot satisfy the automated release gate; the built code needs its own deployed/package/ci-build provenance.");
    }
    lines.push("");
    lines.push("## Next steps");
    lines.push("- Build to the contract above, then run a11y_audit_demo \u2192 a11y_release_gate before merge.");
    lines.push("- Record the result with a11y_manifest_record if this is entering a governed component library.");
    return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}
export { CATALOG_INDEX, DESIGN_SYSTEM_COMPONENT, catalogLabel };
