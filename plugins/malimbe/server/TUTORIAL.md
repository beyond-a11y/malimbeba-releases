# Malimbe quick-start tutorial

This tutorial follows the supplied Demo 1, Demo 2, and Demo 3 recordings and
their accompanying session conversation. The walkthrough starts Malimbe, asks
an agent to build a reusable carousel, checks the working demo, and requests
an accessibility report and the HTML.

Malimbe is an early-access accessibility engine. It helps you build and review
accessible UI; an automated pass is evidence about the checks performed, not a
guarantee that a component is fully accessible.

## Choose how you want to use Malimbe

### With an AI coding agent (MCP)

1. Install Node.js 18.17 or newer.
2. Download the latest `.tgz` from the
   [Malimbe releases page](https://github.com/beyond-a11y/malimbeba-releases/releases).
3. Install the downloaded tarball from your terminal:

   ```sh
   npm install -g ./malimbeba-<version>.tgz
   ```

4. Check beta status, then run the setup check:

   ```sh
   malimbeba-license status
   malimbeba doctor
   ```

   `malimbeba doctor` checks browser readiness and prints an MCP configuration
   for this installation. Add that configuration to your coding agent using
   the agent's MCP setup instructions, then restart or reload the agent so it
   connects to Malimbe. If browser setup is needed, `malimbeba doctor --fix`
   can help provision a browser.

5. In the connected agent, try:

   > I need a carousel component. Make it a web component so it can be used
   > with any popular framework.

   State what you are building and the framework, platform, and design-system
   constraints that matter. Malimbe helps the agent resolve the right UI
   pattern, include its accessibility contract, and verify the implementation.

### Without an AI coding agent (browser-only UI)

Start Malimbe's local UI:

```sh
malimbeba-ui
```

Open [http://127.0.0.1:4173](http://127.0.0.1:4173). The server listens on
loopback, so the UI is local to your machine. Use the prompt-building and audit
surfaces to prepare work or review a URL without connecting an MCP client.

## Build and inspect a component

The recordings demonstrate this loop:

1. **Describe the component.** Ask for the carousel and say it must be a web
   component usable from common frameworks.
2. **Let the agent build and test it.** Review the implementation and ask it
   to address failed tests or audit findings rather than stopping at plausible
   markup. In the example, the component is a custom element named
   `<malimbe-carousel>`; its slides are child elements with `slot="slide"`.
3. **Ask to see a working demo.** A demo makes the behavior concrete: operate
   Previous and Next, and, if rotation is enabled, verify the pause/resume
   control and pause-on-focus/hover behavior.
4. **Ask for the HTML.** For example: “Show the HTML as well.” Inspect how the
   custom element is loaded and how its slides are marked up. The recorded
   carousel example uses:

   ```html
   <script type="module" src="/components/carousel.js"></script>

   <malimbe-carousel aria-label="Stories from the field">
     <article slot="slide">
       <h2>Small gardens, lasting change</h2>
       <p>A story about a community garden.</p>
       <a href="/stories/garden">Explore the story</a>
     </article>
     <article slot="slide">
       <h2>Making every drop count</h2>
       <p>A story about a neighborhood water project.</p>
       <a href="/stories/water">Explore the story</a>
     </article>
   </malimbe-carousel>
   ```

   The carousel's manual navigation works without autoplay. If autoplay is
   requested, make sure people can stop and restart it, that rotation holds
   while the pointer is over the carousel, and that focus entering a slide
   control stops it.

The checked-in example implementation is
[`components/carousel.js`](components/carousel.js), a reference component that
has not passed the release gate. Its API and usage are documented in
[`components/README.md`](components/README.md). The styled demo
is [`ui/carousel-demo.html`](ui/carousel-demo.html). In this repository, run
`npm run ui` and open
[http://127.0.0.1:4173/carousel-demo.html](http://127.0.0.1:4173/carousel-demo.html)
to view it.

## Request and understand an accessibility report

For code that has not been deployed, ask the connected agent to audit the
component with `a11y_audit_demo`. This serves the local source in a real browser
for a pre-production axe scan. For a running local or deployed page, use
`a11y_audit_axe` and provide the URL; for a component library, include its
source pattern when appropriate.

You can ask:

> Print the accessibility report as evidence for this component.

Read the report for the target URL or source, standard, audit date, findings,
pattern gaps, and evidence reference. A clean axe report means no violations
were detected by that automated scan under its stated scope. It does not
verify every interaction, screen-reader announcement, responsive state, or
whether the UI is cognitively clear.

For a shared component library or release, follow the required release gates:
use `a11y_release_gate` and record the outcome with `a11y_manifest_record`.
The gate requires verifiable artifact provenance for automated release
evidence; a pasted snippet or temporary demo alone cannot establish that a
release artifact passed.

Always call out manual checks that remain, especially keyboard interaction,
screen-reader review, responsive behavior, and cognitive review. Do not report
an automated pass as “fully accessible.”

## Next steps

- To learn what each MCP tool does, see [`WORKFLOWS.md`](WORKFLOWS.md).
- For detailed install and product information, see [`README.md`](README.md).
- For the governing authoring rules, see [`AGENTS.md`](AGENTS.md).
- To activate a purchased validation code, run
  `malimbeba-license activate YOUR-VALIDATION-CODE`.
