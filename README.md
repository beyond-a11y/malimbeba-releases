# Malimbe by Beyond A11y

<!-- mcp-name: io.github.beyond-a11y/malimbe -->

Malimbe builds accessible components and audits pages against WCAG 2.2 Level A and AA from inside your coding agent. It includes axe-core and static audits, site crawls, platform and overlay detection, keyboard, reading-order, screen-reader and status-message checks, accessible component and UX guidance, accessibility-primed prompt builders, unhosted demo audits, the release gate, the component library manifest, and practitioner Skills served by the server. Every tool is free for 30 days from first launch. After that, a paid validation code is required. Runs locally. Audits only the URLs or code you give it.

Malimbe is honest about limits: automated checks are necessary but not sufficient. Keyboard flows, screen-reader output and cognitive clarity still need manual, persona-based testing.

## Install

| Where | How |
|---|---|
| VS Code (GitHub Copilot) | Search `@mcp malimbe` in the Extensions view, or add `npx -y malimbeba@0.6.0` as an MCP server |
| Claude Code | `/plugin marketplace add beyond-a11y/malimbeba-releases` then `/plugin install malimbe@beyond-a11y` |
| Claude Desktop | Download `malimbeba-0.6.0.mcpb` from [the 0.6.0 release](https://github.com/beyond-a11y/malimbeba-releases/releases/tag/v0.6.0) and double-click it |
| Cursor and any other MCP client | `npx -y malimbeba@0.6.0` |

Requires Node.js 18.17 or later. Browser-based audits use an installed Chrome or Edge.

## Trial and pricing

Every tool is free for 30 days from first launch, with no account and no card. After the trial, Malimbe needs a paid validation code to run.

Plans: https://www.beyond-a11y.com/product-page/malimbe-by-beyond-a11y

## Tools

- `a11y_audit_html`: Audit HTML for accessibility
- `a11y_component_guidance`: Get accessible component guidance
- `a11y_ux_guidance`: Get UX best-practice guidance
- `a11y_build_prompt`: Build an accessibility-primed prompt
- `a11y_build_handoff_spec`: Build a designer-to-developer handoff spec
- `a11y_build_audit_prompt`: Build an accessibility-audit prompt
- `a11y_release_gate`: Evaluate the enterprise accessibility release gate
- `a11y_checklist`: Get the implementation checklist
- `a11y_audit_url`: Audit a live URL for accessibility
- `a11y_crawl_audit`: Crawl and audit a site (up to 20 pages)
- `a11y_detect_stack`: Detect a page's platform, framework, widgets and overlays
- `a11y_audit_axe`: Audit a URL with axe-core against WCAG 2.2 Level A and AA
- `a11y_audit_keyboard`: Walk a URL by keyboard and report reachability, traps, and focus order
- `a11y_audit_reading_order`: Check a URL's DOM order against its visual reading order
- `a11y_audit_announcements`: Review accessible names and states in the browser accessibility tree
- `a11y_audit_status_messages`: Watch a URL for un-announced content changes (WCAG 4.1.3)
- `a11y_manifest_record`: Record a component in the library manifest
- `a11y_library_status`: Library-wide accessibility status
- `a11y_consistency_check`: Check cross-component consistency
- `a11y_audit_demo`: Audit unhosted component code via a local demo page
- `a11y_browser_check`: Check browser readiness for audits

## Documents

- [Accessibility Conformance Report (VPAT 2.5)](https://beyond-a11y.github.io/malimbeba-releases/acr/)
- [Privacy policy](https://beyond-a11y.github.io/malimbeba-releases/privacy/)
- [License](LICENSE). Source is private. Licensed by Beyond-A11y, LLC.

## Contact

info@beyond-a11y.com · https://www.beyond-a11y.com
