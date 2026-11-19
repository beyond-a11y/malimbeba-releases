<img src="ui/assets/malimbe-favicon-256.png" alt="" width="96" height="96">

# Malimbe by Beyond-A11y

**Accessibility, built into the agentic-coding loop.**

Malimbe is an accessibility engine for developers who build with AI coding
agents. It lets you generate accessible components, stand up and audit a design
system, and review your own or external sites against **WCAG 2.2 Level A and
AA** — without leaving the tools you already code in.

It ships as a Model Context Protocol (MCP) server, a set of encoded-expertise
Skills that the server serves (`a11y://skills`), and plain-language
prompt-building UIs. The MCP server is the plumbing,
the Skills are the practitioner judgment, and the UIs are the front door.
Malimbe is model- and platform-agnostic: it plugs into Claude Code, VS Code,
Codex, Cursor, GitHub Copilot, and any editor that speaks `mcp.json`.

Malimbe is a product of **Beyond-A11y, LLC** — [beyond-a11y.com](https://beyond-a11y.com).

## Getting the beta

Download the latest `.tgz` from the public
[Malimbe releases](https://github.com/beyond-a11y/malimbeba-releases/releases).
The 30-day beta starts on first launch, not on download. The source repository
remains private; the release repository contains only the installable package
and release notes.

Download the latest `malimbeba-0.6.0.tgz`, then install and check your beta status:
```bash
npm install -g ./malimbeba-0.6.0.tgz
malimbeba-license status
```

After purchase, activate the validation code sent to you:
```bash
malimbeba-license activate YOUR-VALIDATION-CODE
```
Then run `malimbeba doctor` for browser readiness and your ready-to-paste MCP
configuration. Paid codes are lifetime unless your purchase terms state an
expiry.

### No coding agent? Use the browser-only UI

Malimbe's audits and prompt-building don't require an AI coding agent or MCP
client at all. Run:
```bash
malimbeba-ui
```
and open **http://127.0.0.1:4173** in any browser. It's a local-only server —
nothing leaves your machine — that runs real, live WCAG 2.2 A+AA audits
(axe-core, in a headless browser) directly from the page, with no agent in
the loop. Works the same on macOS, Windows, and Linux. Stop it with Ctrl+C.

---

## Why Malimbe

Most accessibility tooling sits at the two ends of the workflow: scanners
(axe, Lighthouse, WAVE, Pa11y) that check finished pages, and overlay vendors
that bolt a widget onto a live site. Malimbe works in the middle — at the
moment components are *generated* — and enforces accessibility as a release
requirement rather than a suggestion.

Its guiding principle is honesty about what automation can and cannot prove:

> **Static analysis is necessary, but not sufficient.**

A rules pass can flag a missing label, but it cannot confirm that a keyboard
user can operate a menu, that a screen reader announces state changes, or that
a flow is cognitively clear. Malimbe says so out loud. It assists and it
gates — it never pretends to *guarantee* conformance. That framing keeps the
tool credible and keeps its users out of legal trouble.

---

## What it does

**Build** — Describe a component in plain language and Malimbe maps everyday
phrasing to the right ARIA Authoring Practices pattern (a "searchable dropdown"
becomes a combobox, a "kebab menu" becomes a menu button), then injects the
full keyboard and focus contract into the prompt your agent receives.

**Review** — Audit a repo path, an internal/localhost target, or a public URL.
Malimbe runs an axe-core audit of record (WCAG 2.2 A + AA) in a real browser,
plus static rules for cases a scanner can catch on its own. It can crawl a site
same-origin, and — uniquely — review *unhosted* component code before it is ever
deployed.

**Govern** — Enforce a definition of done across a whole design system: seven
required quality gates, three component risk tiers, a manifest of what has
actually passed, cross-component consistency checks, and a release gate that
**hard-blocks on any critical defect** and treats provenance as a first-class,
enforced input. A claim that a component passed only satisfies the gate when
it is backed by a verifiable reference — a deployed URL, a package version, or
a commit SHA.

---

The server exposes a suite of accessibility tools (component authoring guidance,
paired build/audit prompt builders that stay in sync with everything below, URL
and crawl audits, an axe audit of record, platform and stack detection that
says where each fix has to happen, pre-production review of unhosted
code, a manifest and library-status rollup, a consistency check, a
provenance-enforcing release gate, and a browser-readiness check) plus three
resources — `a11y://policy`, `a11y://ruleset`, and `a11y://references` — so an
agent can read the governing policy, rule set, and curated external references
directly.

Browser-backed audits use Playwright with a layered fallback: Malimbe will
reuse an installed Chrome or Edge where it can (zero download), discover a
system browser, or provision one on request via `malimbeba doctor --fix`.

---

## What's included

- **MCP server** — Node/TypeScript, launched over stdio (see Installing it, above).
- **Skills** — `accessible-ui-design`, `ux-best-practices`,
  `accessible-component-authoring`,
  `accessibility-auditing`, `audit-reporting`, and
  `accessibility-release-governance`, served by the Malimbe server as MCP
  resources (`a11y://skills` lists them; `a11y://skills/<name>` is one Skill)
  and as prompts. They are not installed as files, and they sit behind the
  same trial and validation code as the tools. A seventh, `malimbeba-dev`
  (build, test, review-gate, and release workflow), is for work on Malimbe's
  own source and is not served. The Skills encode the decision
  hierarchy, non-negotiables, provenance-first audit discipline, human-readable
  reporting, coherent visual design, and the gate/tier governance model, encoded
  so an agent applies them consistently.
- **[WORKFLOWS.md](WORKFLOWS.md)** — a decision tree (create vs. audit) and a
  table of every MCP tool and Skill, what it does, and when to reach for it.
- **UIs** — a guided plain-language door, an expert view with source-of-truth
  and provenance controls, and a component tester that renders pasted markup in
  an isolated frame and reports findings by severity.
- **Clean release package** — includes the runtime (which serves the Skills), installation and
  usage documentation, UI assets, and demos. Test suites, build configuration,
  templates, marketing pages, and customer-specific audit reports stay out of
  the installable tarball.
- **Reference component** — `<a11y-dialog>`, a fully accessible dialog built on
  the native `<dialog>` element with an explicit focus trap for slotted content,
  passing its own audit and a Tier-2 release gate. It doubles as a worked recipe.

---

## Scope and honest limits

- Malimbe checks conformance signals and enforces process. It does **not**
  replace manual verification: keyboard operation, screen-reader output, and
  cognitive clarity are manual gates by design.
- Static rules cannot detect the *absence* of semantics — a bare `<div>` "modal"
  produces zero static findings. Browser mode exists precisely to close that gap.
- The task-confidence score is a triage heuristic to help you prioritize, not a
  measurement of real-user success.

These are stated plainly because a tool that overclaims is worse than no tool.

---

## Requirements

- Node.js **>= 18.17**
- A Chromium-based browser (Chrome or Edge) for browser-backed audits; Malimbe
  can discover or provision one for you.

---

## Status

**Early access — v0.6.0 (beta).** The engine, gates, Skills, UIs, and reference
component are built and tested; the API may still evolve ahead of a 1.0 release.

## License

Proprietary. **Malimbe by Beyond-A11y, LLC.** Provided under an evaluation
license — see the `LICENSE` file for terms. Not for redistribution.

---

_Questions or access requests: info@beyond-a11y.com_
