# Malimbe by Beyond A11y

Malimbe builds accessible components and audits pages against WCAG 2.2 Level A and AA from inside your coding agent. It includes axe-core and static audits, site crawls, platform and overlay detection, keyboard, reading-order, screen-reader and status-message checks, accessible component and UX guidance, accessibility-primed prompt builders, unhosted demo audits, the release gate, the component library manifest, and practitioner Skills served by the server. Every tool is free for 30 days from first launch. After that, a paid validation code is required. Runs locally. Audits only the URLs or code you give it.

## Features

- **Audit:** single-page WCAG 2.2 A/AA audits with axe-core in a real browser, static HTML audits, site crawls, platform and overlay detection, and keyboard, reading-order, screen-reader and status-message checks.
- **Build:** accessible component guidance from the ARIA Authoring Practices, UX guidance, and accessibility-primed prompts for your coding agent.
- **Govern:** a release gate with hash-verified audit evidence and a component library manifest.
- **Skills:** practitioner Skills for auditing, component authoring, release governance, UI design and audit reporting, served by the server as resources and prompts.

## Installation

```
/plugin marketplace add beyond-a11y/malimbeba-releases
/plugin install malimbe@beyond-a11y
```

Requires Node.js 18.17 or later. Browser-based audits use an installed Chrome or Edge; run `a11y_browser_check` to confirm.

## Configuration

No configuration is needed during the 30-day trial, which starts at first launch. After the trial, set `MALIMBEBA_LICENSE_KEY` to the validation code from your purchase at [beyond-a11y.com](https://beyond-a11y.com).

## Privacy Policy

Malimbe runs on your computer. It sends no telemetry and has no account or sign-in. It contacts only the URLs you ask it to audit. It stores its trial start date, your validation code if you add one, and audit evidence files in a local `.malimbeba` folder. Full policy: https://beyond-a11y.github.io/malimbeba-releases/privacy/

## Support

info@beyond-a11y.com
