/** Concepts that must be named the same way library-wide. */
const CONCEPT_SYNONYMS = [
    { concept: "size", names: ["size", "scale", "dimension", "sizing", "magnitude"] },
    { concept: "variant", names: ["variant", "kind", "type", "appearance", "style", "flavor"] },
    { concept: "disabled", names: ["disabled", "isdisabled", "inactive", "readonly-disabled"] },
    { concept: "open state", names: ["open", "isopen", "expanded", "isexpanded", "visible", "active"] },
    { concept: "label", names: ["label", "labeltext", "caption", "title", "text"] },
    { concept: "invalid state", names: ["invalid", "isinvalid", "error", "haserror", "hasError"] },
    { concept: "required", names: ["required", "isrequired", "mandatory"] },
];
/** Recognised token prefixes are treated as the shared vocabulary. */
function tokenNamespace(token) {
    const m = token.match(/^(--)?([a-z0-9]+)[-.]/i);
    return m && m[2] ? m[2].toLowerCase() : null;
}
function lower(s) {
    return s.toLowerCase().replace(/[-_]/g, "");
}
function eventStyle(name) {
    if (/^on[A-Z]/.test(name))
        return "on-prefixed";
    if (/(ed|d)$/.test(name) && /^[a-z]+$/.test(name))
        return "past-tense";
    if (/^[a-z][a-zA-Z]*$/.test(name))
        return "bare";
    return "other";
}
export function checkConsistency(m) {
    const comps = Object.values(m.components);
    const findings = [];
    const add = (f) => findings.push(f);
    // 1. Prop naming — one concept, one name.
    for (const { concept, names } of CONCEPT_SYNONYMS) {
        const used = new Map();
        for (const c of comps) {
            for (const p of c.api?.props ?? []) {
                const key = lower(p.name);
                if (names.includes(key)) {
                    const list = used.get(p.name) ?? [];
                    list.push(c.name);
                    used.set(p.name, list);
                }
            }
        }
        if (used.size > 1) {
            const variants = [...used.entries()].map(([n, cs]) => `"${n}" (${cs.join(", ")})`).join(" vs ");
            add({
                ruleId: "prop-naming",
                title: `Inconsistent prop name for "${concept}"`,
                severity: "high",
                detail: `The same concept is exposed under different prop names: ${variants}.`,
                components: [...new Set([...used.values()].flat())],
                fix: `Pick one name for "${concept}" and alias or deprecate the others.`,
            });
        }
    }
    // 2. Enumerated value scales must agree (e.g. size: sm|md|lg vs small|medium|large).
    const scaleByProp = new Map();
    for (const c of comps) {
        for (const p of c.api?.props ?? []) {
            if (!p.values || p.values.length === 0)
                continue;
            const key = lower(p.name);
            const sig = [...p.values].map((v) => v.toLowerCase()).sort().join("|");
            const bySig = scaleByProp.get(key) ?? new Map();
            const list = bySig.get(sig) ?? [];
            list.push(c.name);
            bySig.set(sig, list);
            scaleByProp.set(key, bySig);
        }
    }
    for (const [prop, bySig] of scaleByProp) {
        if (bySig.size > 1) {
            const variants = [...bySig.entries()].map(([sig, cs]) => `[${sig}] in ${cs.join(", ")}`).join(" vs ");
            add({
                ruleId: "value-scale",
                title: `Divergent value scale for "${prop}"`,
                severity: "high",
                detail: `Components enumerate different values for the same prop: ${variants}.`,
                components: [...new Set([...bySig.values()].flat())],
                fix: `Standardise the ${prop} scale across the library and migrate outliers.`,
            });
        }
    }
    // 3. Event naming convention must be uniform.
    const styles = new Map();
    for (const c of comps) {
        for (const e of c.api?.events ?? []) {
            const s = eventStyle(e);
            const list = styles.get(s) ?? [];
            if (!list.includes(c.name))
                list.push(c.name);
            styles.set(s, list);
        }
    }
    if (styles.size > 1) {
        add({
            ruleId: "event-naming",
            title: "Mixed event naming conventions",
            severity: "medium",
            detail: `Events follow more than one convention: ${[...styles.entries()].map(([s, cs]) => `${s} (${cs.join(", ")})`).join(" vs ")}.`,
            components: [...new Set([...styles.values()].flat())],
            fix: "Choose one convention (e.g. bare 'change' for custom elements, 'onChange' for React) and apply it library-wide.",
        });
    }
    // 4. Raw values where a token belongs.
    const raw = comps.filter((c) => (c.api?.rawValues ?? []).length > 0);
    if (raw.length) {
        add({
            ruleId: "token-bypass",
            title: "Hard-coded values bypass design tokens",
            severity: "high",
            detail: raw.map((c) => `${c.name}: ${(c.api?.rawValues ?? []).slice(0, 5).join(", ")}`).join("; "),
            components: raw.map((c) => c.name),
            fix: "Replace literal colours/sizes with design tokens so a single token fix corrects contrast everywhere.",
        });
    }
    // 5. Token vocabulary should share a namespace.
    const namespaces = new Map();
    for (const c of comps) {
        for (const t of c.api?.tokens ?? []) {
            const ns = tokenNamespace(t);
            if (!ns)
                continue;
            const list = namespaces.get(ns) ?? [];
            if (!list.includes(c.name))
                list.push(c.name);
            namespaces.set(ns, list);
        }
    }
    if (namespaces.size > 1) {
        add({
            ruleId: "token-namespace",
            title: "Multiple token namespaces in use",
            severity: "medium",
            detail: `Token prefixes diverge: ${[...namespaces.entries()].map(([n, cs]) => `${n}- (${cs.join(", ")})`).join(" vs ")}.`,
            components: [...new Set([...namespaces.values()].flat())],
            fix: "Consolidate onto one token namespace, or document the split deliberately.",
        });
    }
    // 6. Focus treatment must be uniform and stylable.
    const withParts = comps.filter((c) => (c.api?.parts ?? []).length > 0).map((c) => c.name);
    const interactive = comps.filter((c) => (c.tier ?? 1) >= 1 && (c.api?.events ?? []).length > 0);
    const missingParts = interactive.filter((c) => !(c.api?.parts ?? []).length).map((c) => c.name);
    if (withParts.length && missingParts.length) {
        add({
            ruleId: "focus-styling-hooks",
            title: "Inconsistent styling hooks for focus",
            severity: "medium",
            detail: `Some components expose style parts (${withParts.join(", ")}) while other interactive components do not (${missingParts.join(", ")}), so consumers cannot restyle focus uniformly.`,
            components: [...withParts, ...missingParts],
            fix: "Expose the same styling hooks on every interactive component so the focus ring can be themed once.",
        });
    }
    // 7. Disabled must be modelled the same way everywhere.
    const disabledNames = new Set();
    const disabledOwners = new Set();
    for (const c of comps) {
        for (const p of c.api?.props ?? []) {
            if (lower(p.name).includes("disabled")) {
                disabledNames.add(p.name);
                disabledOwners.add(c.name);
            }
        }
    }
    if (disabledNames.size > 1) {
        add({
            ruleId: "disabled-semantics",
            title: "Disabled state modelled inconsistently",
            severity: "high",
            detail: `Disabled is exposed as ${[...disabledNames].map((n) => `"${n}"`).join(" and ")} across ${[...disabledOwners].join(", ")}.`,
            components: [...disabledOwners],
            fix: "Use one disabled API library-wide, backed by the native disabled attribute so the control is functionally as well as visually disabled.",
        });
    }
    // 8. Two components implementing the same pattern.
    const byPattern = new Map();
    for (const c of comps) {
        if (!c.pattern)
            continue;
        const list = byPattern.get(c.pattern) ?? [];
        list.push(c.name);
        byPattern.set(c.pattern, list);
    }
    for (const [pattern, cs] of byPattern) {
        if (cs.length > 1) {
            add({
                ruleId: "pattern-duplication",
                title: `Duplicate implementations of the ${pattern} pattern`,
                severity: "medium",
                detail: `${cs.join(", ")} all implement "${pattern}". Duplicates drift apart and double the review surface.`,
                components: cs,
                fix: `Consolidate onto one ${pattern} implementation, or document why the variants must differ.`,
            });
        }
    }
    // 9. Untiered components cannot be governed.
    const untiered = comps.filter((c) => !c.tier).map((c) => c.name);
    if (untiered.length) {
        add({
            ruleId: "tier-coverage",
            title: "Components without a risk tier",
            severity: "medium",
            detail: `${untiered.join(", ")} have no risk tier, so the correct review rigour is undefined.`,
            components: untiered,
            fix: "Assign every component a tier (1 primitive, 2 composite, 3 high-risk composite).",
        });
    }
    // 10. Slot naming should be uniform for the same role.
    const slotNames = new Map();
    for (const c of comps) {
        for (const s of c.api?.slots ?? []) {
            const key = lower(s);
            if (["footer", "actions", "buttons", "cta"].includes(key)) {
                const list = slotNames.get(s) ?? [];
                list.push(c.name);
                slotNames.set(s, list);
            }
        }
    }
    if (slotNames.size > 1) {
        add({
            ruleId: "slot-naming",
            title: "Inconsistent slot names for the action area",
            severity: "low",
            detail: `Action slots are named ${[...slotNames.entries()].map(([n, cs]) => `"${n}" (${cs.join(", ")})`).join(" vs ")}.`,
            components: [...new Set([...slotNames.values()].flat())],
            fix: "Use one slot name for the action area across the library.",
        });
    }
    const bySeverity = { high: 0, medium: 0, low: 0 };
    for (const f of findings)
        bySeverity[f.severity]++;
    return {
        componentsChecked: comps.length,
        findings: findings.sort((a, b) => ({ high: 0, medium: 1, low: 2 })[a.severity] - ({ high: 0, medium: 1, low: 2 })[b.severity]),
        bySeverity,
        consistent: findings.length === 0,
    };
}
