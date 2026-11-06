# Malimbe by Beyond A11y

Malimbe by Beyond A11y is an AI accessibility tool for coding agents. It runs as an MCP server with accessibility skills and a prompt builder inside Claude Code, VS Code, Codex, Cursor, GitHub Copilot, and any editor that speaks `mcp.json`. Your agent builds accessible components and audits sites, repos and unhosted code against WCAG 2.2 Level A and AA.

- **Build:** generates components with the full keyboard, focus and ARIA contract for the pattern you describe.
- **Audit:** axe-core audits of live URLs, same-origin crawls and unhosted code served on a private local page, plus checks (keyboard flow, screen-reader announcements, reading order, status messages) that static analysis misses.
- **Govern:** a release gate that blocks on critical defects and records where the audited code came from.

Malimbe is honest about limits: automated checks are necessary but not sufficient. Keyboard flows, screen-reader output and cognitive clarity still need manual, persona-based testing.

## Get Malimbe
- Free 30-day trial and plans: https://www.beyond-a11y.com/product-page/malimbe-by-beyond-a11y
- Latest release: https://github.com/beyond-a11y/malimbeba-releases/releases/latest
- Accessibility Conformance Report (VPAT 2.5): https://beyond-a11y.github.io/malimbeba-releases/acr/

## Install
    npm install -g ./malimbeba-0.4.4.tgz
    malimbeba-license activate <your-code>
    malimbeba doctor

Requires Node.js 18.17 or later. Source is private. Licensed by Beyond-A11y, LLC.

## Contact
info@beyond-a11y.com · https://www.beyond-a11y.com
