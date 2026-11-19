import { renderPageRaw, withTimeout } from "./render.js";
const OP_TIMEOUT_MS = 15_000;
const ANNOUNCEMENT_ROLES = new Set([
    "button", "link", "checkbox", "radio", "switch", "tab", "menuitem",
    "menuitemcheckbox", "menuitemradio", "option", "combobox", "listbox",
    "searchbox", "spinbutton", "slider", "textbox", "treeitem", "gridcell",
]);
const NAMED_ROLES = new Set(ANNOUNCEMENT_ROLES);
const GENERIC_NAMES = new Set([
    "button", "link", "click", "click here", "here", "more", "read more",
    "learn more", "submit", "go", "open", "close", "edit", "delete",
]);
function propertySummary(node) {
    return (node.properties ?? [])
        .filter((property) => ["checked", "expanded", "selected", "disabled", "pressed", "busy", "required", "invalid", "valuetext", "live", "atomic"].includes(property.name))
        .map((property) => `${property.name}=${String(property.value?.value ?? "")}`);
}
function fallbackSelector(role, name) {
    return `[role="${role}"]${name ? ` (accessible name: "${name}")` : ""}`;
}
function classifyNode(node) {
    if (node.ignored)
        return null;
    const role = String(node.role?.value ?? "").toLowerCase();
    if (!ANNOUNCEMENT_ROLES.has(role))
        return null;
    return {
        role,
        name: String(node.name?.value ?? "").trim(),
        description: String(node.description?.value ?? "").trim(),
        states: propertySummary(node),
        selector: fallbackSelector(role, String(node.name?.value ?? "").trim()),
        snippet: "",
    };
}
export function reviewAccessibleEntries(url, nodes) {
    const entries = nodes.map(classifyNode).filter((entry) => entry !== null);
    const findings = [];
    for (const entry of entries) {
        const normalized = entry.name.toLowerCase().replace(/\s+/g, " ").trim();
        if (!normalized && NAMED_ROLES.has(entry.role)) {
            findings.push({
                ruleId: "announcement-missing-name",
                impact: "serious",
                selector: entry.selector,
                snippet: entry.snippet,
                detail: `The accessibility tree exposes a ${entry.role} without an accessible name.`,
                fix: "Give the control a concise, specific accessible name using visible text or a correctly associated label.",
            });
        }
        else if (GENERIC_NAMES.has(normalized)) {
            findings.push({
                ruleId: "announcement-generic-name",
                impact: "moderate",
                selector: entry.selector,
                snippet: entry.snippet,
                detail: `The ${entry.role} name “${entry.name}” may not distinguish its purpose when encountered out of context. Review it in the surrounding task flow.`,
                fix: "Prefer a concise action or destination name that remains understandable when announced on its own; retain the generic name only when context genuinely makes it clear.",
            });
        }
    }
    const byRoleAndName = new Map();
    for (const entry of entries) {
        const normalized = entry.name.toLowerCase().replace(/\s+/g, " ").trim();
        if (!normalized)
            continue;
        const key = `${entry.role}\u0000${normalized}`;
        const group = byRoleAndName.get(key) ?? [];
        group.push(entry);
        byRoleAndName.set(key, group);
    }
    for (const group of byRoleAndName.values()) {
        if (group.length < 2)
            continue;
        const first = group[0];
        findings.push({
            ruleId: "announcement-repeated-name",
            impact: "moderate",
            selector: first.selector,
            snippet: first.snippet,
            detail: `${group.length} ${first.role} controls share the accessible name “${first.name}”. Repetition can be valid, but may make navigation ambiguous when the controls have different outcomes.`,
            fix: "Review each repeated control in context. Add distinguishing names when their action or destination differs; do not add redundant context when the repeated actions are equivalent.",
        });
    }
    return {
        url,
        engine: "Chromium accessibility tree via CDP",
        entries,
        findings,
        note: "This is a snapshot of semantics exposed to Chromium's accessibility tree plus conservative naming heuristics. It does not capture spoken VoiceOver/NVDA output, announcement timing, or whether labels make sense to a person; manually test with the target assistive technology.",
    };
}
async function describeNode(session, backendDOMNodeId) {
    try {
        const { node } = await session.send("DOM.describeNode", { backendNodeId: backendDOMNodeId });
        const attributes = new Map();
        for (let i = 0; i < (node.attributes?.length ?? 0); i += 2) {
            attributes.set(node.attributes[i], node.attributes[i + 1]);
        }
        const tag = String(node.nodeName ?? "element").toLowerCase();
        const id = attributes.get("id");
        const className = attributes.get("class")?.trim().split(/\s+/)[0];
        const selector = id ? `${tag}#${id}` : className ? `${tag}.${className}` : tag;
        const snippet = `<${tag}${id ? ` id="${id}"` : ""}${className ? ` class="${className}"` : ""}>`;
        return { selector, snippet };
    }
    catch {
        return { selector: "(DOM locator unavailable)", snippet: "" };
    }
}
function emptyReview(url, error) {
    return {
        url,
        engine: "Chromium accessibility tree via CDP",
        entries: [],
        findings: [],
        note: "This is a browser accessibility-tree snapshot, not recorded assistive-technology speech.",
        error,
    };
}
/** Snapshot Chromium's computed accessibility tree for visible interactive semantics. */
export async function runScreenReaderReview(url) {
    const rendered = await renderPageRaw(url);
    if (!rendered.ok || !rendered.page) {
        return emptyReview(url, rendered.error ?? "Could not open a browser page. Playwright/Chromium is required.");
    }
    let session;
    try {
        session = await rendered.page.context().newCDPSession(rendered.page);
        await session.send("Accessibility.enable");
        const result = await withTimeout(session.send("Accessibility.getFullAXTree"), OP_TIMEOUT_MS, "accessibility tree snapshot");
        const nodes = result.nodes.filter((node) => !node.ignored && node.role?.value && ANNOUNCEMENT_ROLES.has(String(node.role.value).toLowerCase()));
        const review = reviewAccessibleEntries(url, nodes);
        for (let index = 0; index < nodes.length; index++) {
            const backendDOMNodeId = nodes[index].backendDOMNodeId;
            if (!backendDOMNodeId)
                continue;
            const locator = await describeNode(session, backendDOMNodeId);
            const entry = review.entries[index];
            if (entry)
                Object.assign(entry, locator);
        }
        for (const finding of review.findings) {
            const role = finding.selector.match(/\[role="([^"]+)"\]/)?.[1];
            const matchingEntry = role
                ? review.entries.find((entry) => entry.role === role && (finding.ruleId === "announcement-missing-name"
                    ? !entry.name && entry.selector.includes("#")
                    : Boolean(entry.name) && finding.selector.includes(entry.name)))
                : undefined;
            if (matchingEntry) {
                finding.selector = matchingEntry.selector;
                finding.snippet = matchingEntry.snippet;
            }
        }
        return review;
    }
    catch (error) {
        return emptyReview(url, `Accessibility tree snapshot failed: ${error instanceof Error ? error.message : "unknown error"}`);
    }
    finally {
        if (session) {
            try {
                await session.detach();
            }
            catch { /* ignore */ }
        }
        await rendered.close();
    }
}
