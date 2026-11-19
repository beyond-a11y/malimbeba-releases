# Changelog

All notable changes to Malimbe by Beyond-A11y (`malimbeba`) are documented here.
This project is distributed as early-access software; the API may evolve
ahead of a 1.0 release.

## [0.6.0] -- 2026-11-18 (directory installs; Skills served by the server)

- Directory packaging: `scripts/build-directory-packages.mjs` builds the npm-ready tarball, a
  Claude Desktop `.mcpb`, the official MCP Registry `server.json`, a Claude and Cursor plugin, a
  Claude Code marketplace, and a privacy page. See PACKAGING.md and
  DIRECTORY-LAUNCH.md. New "Directory packages" workflow builds these on Linux.
- The package is publishable to npm (`mcpName`, public access).
- Fix: the 30-day trial clock now starts at first use in every case. It used to start only at the
  first launch without a valid code, so a time-limited code could be followed by a fresh trial.
- Fix: the server now exits when its client closes stdin. Under `npx` or `cmd /c` it used to keep
  running, with its browser, after the client went away.
- Licensing is unchanged: 30-day trial, then a paid validation code. A free tier was built on this
  branch and removed before release.
- The Skills are now served by the server as `a11y://skills/...` resources and as prompts, and are
  no longer shipped as `skills/` files. They sit behind the same trial and paid-code gate as the
  tools. `AGENTS.md` points agents at the resource.

## [0.5.1] -- 2026-11-17 (overlay detection, honest crawl verdict)

### Fixed
- Crawler link extraction decoded legacy entities without a semicolon inside
  `href` (`?locale=en&region=US` became `?locale=en®ion=US`), so crawls followed
  wrong URLs. It now decodes the raw attribute with HTML's attribute rule (`he`,
  already shipped transitively, is now a direct dependency).

### Changed
- `a11y_crawl_audit` verdict gains `INCOMPLETE`: no critical defects on the pages
  audited, but one or more pages could not be audited. Previously a crawl that
  audited 0 pages (for example, a site that refuses headless browsers) returned
  `PASS`. Gate on `verdict === "PASS"`, not `!== "BLOCKED"`.

### Added
- Overlay detection: UsableNet Assistive (verified on a live site), Max Access,
  Equally AI, Allyable, Sitecues, eSSENTIAL Accessibility, FACIL'iti, and the
  One Click Accessibility WordPress toolbar, plus a low-confidence catch-all for
  generically named accessibility widgets/toolbars from an unrecognized vendor.

## [0.5.0] -- 2026-11-16 (platform and stack detection)

### Added
- `a11y_detect_stack` MCP tool: reports a page's CMS or hosted platform,
  front-end framework, component libraries and widgets, accessibility overlays
  and other third-party scripts, each with evidence, a confidence level, and
  where fixes for that layer have to happen (native markup, platform template,
  custom component, or vendor). Evidence comes from one page load: generator
  meta, script and stylesheet URLs, allowlisted product headers, cookie names
  only, typeof checks on a fixed list of globals, a fixed set of version
  constants, and DOM markers. Anything it can't determine is listed under
  `unknowns`. Signatures are data (`src/engine/stackSignatures.ts`), with static,
  dated, sourced lifecycle notes (SharePoint Server 2016/2019 end of extended
  support, July 14, 2026; Ektron's 2015 acquisition by Episerver, now Optimizely,
  which is migrating Ektron customers to its own CMS).
- `a11y_audit_axe` includes the detected stack in its result and a new report
  section, "Platform and what it means for fixes". Each failing element inside a
  detected widget or platform control (for example, a Slick slide or Liferay's
  navigation menu) carries an `origin`, and rule and criterion summaries count
  instances by origin. Elements with no matching marker get no origin.
- `a11y_crawl_audit` reports the stack once per origin, plus each path whose
  stack differs (for example, a React app under one path of a CMS site).
- `a11y_ux_guidance` MCP tool and `a11y://ux-guidance` resource: source-cited UX
  best practices served from inside the agent session, selected from a task
  description, with confidence labels, per-source read status, and a warning
  when the 6-month review is overdue. `a11y_build_prompt`'s MCP setup now names it.
- `accessible-ui-design` and `ux-best-practices` skills (the latter with a
  source catalogue and thematic digests under `references/`).

## [0.4.4] -- 2026-10-23 (manifest evidence re-verification)

### Fixed
- `a11y_manifest_record` no longer writes a caller-supplied `status: "pass"`
  straight into the manifest. It now re-runs the same hash-verification
  `a11y_release_gate` already applies, against the claimed `evidenceRef`, and
  downgrades to `status: "unknown"` (never rejecting the write) when the
  evidence is missing, unresolvable, or doesn't match the claimed audit
  ID/digest. The reason is disclosed in the tool's response text.
- `a11y_library_status` now re-verifies every stored `"pass"` against its own
  recorded evidence on every call, not only at the write that originally set
  it. A pass that goes stale after the fact (its evidence artifact deleted or
  expired) or that predates this release is now caught live, with no
  migration step required, and counted as a release blocker. The manifest
  file itself is not rewritten by this read-only check; re-run
  `a11y_manifest_record` to persist the correction on disk.

## [0.4.3] -- 2026-10-06 (gate warnings, risk-tier cleanup, carousel fixes)

### Added
- `a11y_release_gate` returns a `warnings` list, and the markdown output shows a
  Warning line, when a component name is not a recognized risk-tier name or when
  neither a component name nor a tier is supplied. The verdict is unchanged.
- `malimbeba-dev` Skill: the build, test, review-gate, and release workflow
  previously kept in the outer repo. Its build and test section applies to a
  source checkout only.

### Changed
- Removed alias spellings from the risk-tier list: `menubutton`, `treeview`,
  `treegrid`, `datepicker`, and `input`. Use the canonical names `menu button`,
  `tree view`, `tree grid`, `date picker`, and `text input`. A parity test now
  enforces canonical names.
- A time-limited paid validation code's term starts when the code is accepted
  with `malimbeba-license activate`, not when it was issued. Lifetime codes are
  unchanged. Verification no longer rejects a code for its issue-time expiry.
- The carousel `autoplay` attribute now only offers the start/stop control.
  Rotation starts when a user presses Start; nothing rotates on page load.

### Fixed
- Carousel: clicking Stop while the pointer is over the carousel now stops
  rotation. Hovering holds rotation temporarily without changing the Start/Stop
  state.
- Carousel: the whole component is no longer a live region. Next and Previous
  announce the position and the slide's first heading, such as "Slide 2 of 3:
  Second story"; automatic rotation is not announced.
- Carousel documentation corrected, and the component is labeled as an ungated
  reference component.

## [0.4.2] -- 2026-10-04 (first-start package cleanup and component tutorial)

### Added
- A practical quick-start tutorial covering installation, MCP setup,
  browser-only use, component generation, demos, and accessibility evidence.
- A framework-agnostic carousel custom element, runnable demo, and usage
  documentation.

### Changed
- Narrowed the installable package to runtime files, Skills, installation and
  support documentation, browser UI assets, and demos. Excluded test suites,
  build configuration, redundant templates, marketing pages, and a
  customer-specific audit report.
- `malimbeba doctor` now works as a server subcommand as documented, in
  addition to the dedicated `malimbeba-doctor` executable.
- Verified a globally installed tarball in an isolated prefix: doctor/browser
  readiness, MCP web-component prompt generation, and packaged UI/demo routes
  all work.

## [0.4.1] -- 2026-10-02 (browser-only access)

### Added
- `malimbeba-ui` CLI command, launching the existing local audit-bridge
  server (`ui/server.mjs`) as a real global install command. The bridge
  server and its UI already ran real, live WCAG 2.2 A+AA audits with no
  AI agent or MCP client involved -- it just had no documented or
  reachable way to start it outside this source repo. Reported directly
  by beta users (two macOS evaluators) who wanted a browser-only path and
  couldn't find one. `malimbeba doctor` now prints a one-line pointer to
  it alongside the MCP config.
- `ui/server.mjs` now also gets its executable bit set at build time
  (same treatment `dist/index.js` already had), as defensive belt-and-
  suspenders. Verified by actually installing the packed tarball into an
  isolated prefix that this wasn't the real fix: npm already chmods every
  `bin`-listed file to executable on install regardless of the mode
  stored in the tarball (confirmed `dist/index.js` has shipped as 644
  inside every tarball packed from this Windows dev machine the whole
  time, yet has always run fine). The actual, sole cause of the reported
  problem was the missing `bin` entry itself -- there was no
  `malimbeba-ui` command at all before this release.

## [0.4.0] -- 2026-09-28 (beta licensing)

### Added
- Signed offline paid-license validation and the `malimbeba-license activate` command.
- A 30-day first-run beta limit; MCP startup stops after expiry until a valid paid code is activated.
- A local code issuer for lifetime licenses or licenses with an explicit expiry. Its private signing key stays outside the repository.

## [0.3.9] -- 2026 (early access / beta)

### Changed
- **Renamed from Promptly to Malimbe by Beyond-A11y**, following the
  product name change passing legal review. Beyond-A11y, LLC remains the
  entity; only the product brand changes. Technical identifiers were
  renamed outright with no compatibility alias, per the owner's explicit
  decision -- nothing has been published to a public registry yet, so
  existing installs are limited to evaluators who can reinstall:
  - npm package: `promptly-a11y` -> `malimbeba`.
  - CLI command: `promptly` -> `malimbeba`; `promptly-doctor` -> `malimbeba-doctor`.
  - MCP server identity (`SERVER_NAME`): `promptly` -> `malimbeba` (changes
    the `<name> vX.X.X running on stdio` startup line and the name reported
    to MCP clients).
  - Environment variables: `PROMPTLY_LICENSE_KEY` -> `MALIMBEBA_LICENSE_KEY`,
    `PROMPTLY_CONFIG_DIR` -> `MALIMBEBA_CONFIG_DIR`,
    `PROMPTLY_BROWSER_TESTS` -> `MALIMBEBA_BROWSER_TESTS`. The `A11Y_*`
    browser-provisioning variables were already product-neutral and did
    not change.
  - Default config/evidence directory: `.promptly/` -> `.malimbeba/`.
  - Structured evidence field: `promptlyVersion` -> `malimbebaVersion` in
    every tool response that returns evidence (a real API-shape change for
    any existing caller parsing that JSON).
  - `AGENTS.md` (the file that ships verbatim into every downstream
    adopter's own repo) rebranded throughout, including its own
    box-drawing header, resized to fit the new name.
  - MCP tool names (`a11y_*`) were already decoupled from the product
    brand and did not need to change -- exactly the scenario the
    decoupling principle recorded in this repo's own CLAUDE.md was written
    for.
- Renamed `ui/promptly-landing.html` to `ui/malimbeba-landing.html`.
- Rebranded README, AGENTS.md (and its stale `templates/` copy),
  DISTRIBUTION.md, CONFIG.md, WORKFLOWS.md, AUDIT-COVERAGE.md, the landing
  page, both prompt-builder UIs, the component tester, and the demo pages.
  Historical documents describing decisions or deliverables already made
  under the old name (CHANGELOG entries below this one, SHIP-NOTES.md,
  PROMPT-BUILDER-PLAN.md, the dated `teamprrecruitment-a11y-report.html`
  audit deliverable) were deliberately left as historical record, not
  rewritten.

## [0.3.8] -- 2026 (early access / beta)

### Added
- `a11y_audit_status_messages` MCP tool (WCAG 4.1.3): watches a rendered
  page over time, not a single snapshot, for content changes that are
  not wrapped in an ARIA live region. Runs two design points given
  directly by the product owner, not assumed: (1) passive observation
  (no interaction at all) is the default and always runs, since not every
  change that should alert a user follows a click -- a timer, polling, an
  auto-rotating carousel, or a server-pushed update all change a page with
  no clickable trigger to point at; an explicit trigger_selector is
  optional and additive, and the tool never auto-discovers something to
  click, so it never has to guess what is safe to activate on a live
  external site. (2) Whether a change close to a trigger is close enough
  that a user would naturally notice it without an announcement is not
  something this tool can determine as fact -- screen size, zoom, and
  layout all vary -- so it computes the one thing that IS reliably
  computable (viewport visibility and geometric pixel distance from the
  trigger), states that measurement plainly in the finding, and flags for
  manual review rather than asserting a violation. Caught and fixed one
  real bug during testing: the mutation observer initially missed content
  changes made via `.textContent` on a previously-empty element, since
  that inserts a text node rather than an element node -- a nearby
  post-trigger update went undetected until a test asserting on it
  specifically caught the gap.

## [0.3.7] -- 2026 (early access / beta)

### Added
- `a11y_audit_reading_order` MCP tool: compares DOM order of a page's
  meaningful content (headings, text, links, form controls, images with
  alt text) against its rendered visual position in a real browser --
  the WCAG 1.3.2-groundable proxy for reading order. Distinct from
  `a11y_audit_keyboard`'s focus-order check, not a duplicate of it: CSS
  layout that visually reorders content (flex/grid `order`, absolute
  positioning) does not reorder how assistive tech reads content linearly,
  even though modern browsers DO reorder sequential Tab focus to follow
  `order` -- confirmed live that the same layout technique breaks one
  check and not the other. Shares its geometry-comparison technique with
  `a11y_audit_keyboard` via a new shared module (`src/engine/visualOrder.ts`)
  rather than a second hand-duplicated copy of the same heuristic.
- `a11y_audit_announcements` MCP tool: snapshots Chromium's computed
  accessibility tree via CDP (roles, accessible names, descriptions,
  exposed state) for interactive controls, and flags missing, generic, or
  repeated names with actionable DOM locators. Explicitly not a real
  VoiceOver/NVDA/TalkBack speech test -- it cannot measure synthesized
  phrasing, announcement timing, or verbosity preferences; it prepares a
  targeted manual assistive-technology pass rather than replacing one.
  Built as a parallel contribution while `a11y_audit_reading_order` above
  was in progress -- verified independently before wiring in (build,
  engine-level heuristic tests, and a live-browser test asserting the
  DOM-locator correlation actually resolves to the right element).

## [0.3.6] -- 2026 (early access / beta)

### Added
- `a11y_audit_keyboard` MCP tool: drives real Tab/Shift+Tab key presses
  through a rendered page in a headless browser and reports what a
  keyboard-only user actually experiences -- not a static markup check.
  Reports elements that are visible and enabled but never reached by Tab,
  a Tab sequence that stops making progress (a trap), and focus order that
  jumps backward against the visual layout (a WCAG 2.4.3-adjacent
  heuristic, flagged for review rather than asserted as a hard failure).
  This closes the pattern-agnostic part of a gap that was previously
  entirely manual -- see the accessibility-auditing skill's updated
  "What automated checks cannot do" section for exactly what remains
  manual (a component's specific keyboard contract, e.g. arrow-key
  navigation inside a tablist).

## [0.3.5] — 2026 (early access / beta)

### Added
- **Design-source handoff workflow.** Added Figma, Adobe XD, and screenshot
  sources to prompt generation, with optional inline screenshot previews and
  verbatim design-token input. Design-file sources remain explicitly separate
  from rendered-code provenance and cannot satisfy the automated release gate
  on their own.
- `a11y_build_handoff_spec` MCP tool and downloadable handoff specs in both
  bundled UIs. The standalone Markdown document carries the component's
  accessibility contract, states and variants checklist, design references,
  and tokens for tickets, PRs, or design reviews without agent-only tool-call
  instructions.

## [0.3.4] — 2026 (early access / beta)

### Added
- **Heading hierarchy and landmark/region structure checks in the audit of
  record.** `a11y_audit_axe` (and `a11y_audit_demo`'s browser path) now
  explicitly enable axe-core's own heading-order, empty-heading,
  page-has-heading-one, landmark-one-main, landmark-unique,
  landmark-no-duplicate-main/banner/contentinfo,
  landmark-*-is-top-level, and region rules. **These were previously
  silently absent from the audit of record**: axe-core tags every one of
  them `best-practice` rather than a `wcag2*`/`wcag22*` tag, and the
  existing `runOnly: { type: 'tag', values: WCAG22_A_AA_TAGS }` filter
  excluded anything not WCAG-tagged — verified directly against the
  installed axe-core's own rule metadata, not assumed. Fixed by explicitly
  enabling those specific rule IDs (axe's own `rules[id].enabled` takes
  precedence over tag-based selection), not by widening to the whole
  best-practice category, which also carries a lot of noisy, unrelated
  checks. `landmark-complementary-is-top-level` excluded — axe-core itself
  marks it deprecated.
- Whole-page-only structure rules (page-has-heading-one, landmark-one-main,
  the duplicate/top-level landmark rules, region) are **not** applied to
  `a11y_audit_demo` — that tool serves an isolated component in a bare
  wrapper page (see `buildDemoHtml`), and those rules would just flag the
  wrapper for lacking chrome the component was never meant to provide.
  heading-order/empty-heading/landmark-unique still apply there, since a
  component embedding a real heading-order bug or two identically-unlabeled
  landmarks is a real defect regardless of page context. New
  `runAxeAudit(url, { pageContext: false })` option controls the split.
- The no-browser static fallback (`a11y_audit_url`/`a11y_crawl_audit` static
  mode, `src/rules/wcag-rules.ts`) had heading-order/empty-heading already,
  but only for native `h1`-`h6` — extended both to also recognize
  `role="heading"` with `aria-level` (ARIA's own default of level 2 applies
  when `aria-level` is absent/invalid), so custom headings in
  component-based UIs are no longer invisible to it. Landmark checks were
  deliberately **not** reimplemented in this fallback path — axe-core's
  browser-mode implementation is already correct, and duplicating it in the
  lower-fidelity static engine would be a maintenance liability for a path
  that's explicitly the degraded fallback.
- Full detail: **[AUDIT-COVERAGE.md](AUDIT-COVERAGE.md)** → "Out of scope
  for this matrix, tracked elsewhere" and "Known gaps" item 4 (focus order,
  scoped but deliberately deferred this round).

### Verified
- **98/98 tests pass, 0 skipped, 0 failed**, `PROMPTLY_BROWSER_TESTS=1`, run
  live directly in this checkout — including 5 new tests proving the actual
  behavior, not just the wiring: two unit tests on `role="heading"`
  detection and its ARIA-default level-2 fallback, one on custom-heading
  emptiness, and two real-browser tests proving axe now reports
  heading-order/landmark-unique on a deliberately broken fixture page AND
  that `pageContext: false` actually suppresses page-has-heading-one/
  landmark-one-main/region noise for a component-style audit while
  `pageContext: true` (default) still flags them for a real page.

## [0.3.3] — 2026 (early access / beta)

### Fixed
- **The bare `"command": "promptly"` MCP config recommended in 0.3.2 does
  not actually work on Windows for MCP clients that spawn commands
  directly (no shell)** — reproduced, not assumed: `spawn('promptly')`
  fails with `ENOENT` (Windows doesn't resolve the `.cmd`/`.ps1` wrapper
  npm's global install creates for a bare name the way a shell's PATHEXT
  lookup would), and `spawn('promptly.cmd')` fails with `EINVAL` (a batch
  file can't be launched via `CreateProcess` without going through
  `cmd.exe`). `"command": "node", "args": [<absolute path to
  dist/index.js>]` is the one form confirmed to work unconditionally, on
  every OS and regardless of whether the client uses a shell.
- `promptly doctor` (and `node dist/doctor.js` for source checkouts) now
  prints a ready-to-paste MCP config using that safe form, with the path
  already resolved to *this* install — nothing to hand-construct, no
  `/ABSOLUTE/PATH/TO/` placeholder to fill in. Also available via
  `--json`'s new `mcpConfig` field for tooling.
- Updated README, `.vscode/mcp.json` (this repo's own dogfood config,
  back to a relative `node dist/index.js` — safe for the same reason:
  `node` itself has no wrapper-extension ambiguity), the landing page,
  and DISTRIBUTION.md's onboarding-email guidance to match: install, run
  `promptly doctor`, paste what it prints. No config text anywhere tells
  a buyer to hand-type a bare command name anymore.

## [0.3.2] — 2026 (early access / beta)

### Fixed
- **The documented install path did not actually work.** `package.json`
  has `"private": true` (intentionally — prevents an accidental public
  `npm publish`), but README.md, `.vscode/mcp.json`, and the landing page
  all instructed `npx -y promptly-a11y`, which requires the package to be
  live on the public npm registry. It isn't, and can't be while private.
  A new user following the documented instructions exactly would hit an
  npm error, not a working server.
- Replaced with two instructions verified to actually work end to end
  today: installing a delivered `.tgz` globally (`npm install -g
  ./promptly-a11y-*.tgz`, then a bare `"command": "promptly"` in MCP
  config — no path to manage) for evaluators/buyers, and build-from-source
  (`git clone` + `npm install && npm run build`, pointing MCP config at
  `dist/index.js`'s absolute path) for contributors. Verified both the
  local (`npm install ./*.tgz`) and global install actually launch the
  server correctly, including on Windows (`.cmd`/`.ps1` wrapper scripts).
- Added a `prepack` script so `npm pack` (and `npm publish`) always
  rebuilds first — previously only `prepublishOnly` triggered a build,
  which does not run for `npm pack`, so it was possible to hand-run
  `npm pack` (exactly what DISTRIBUTION.md's own delivery instructions
  say to do) and ship a tarball built from stale source without any
  warning.
- Fixed `.vscode/mcp.json` (this repo's own committed example) to a
  config that actually works for dogfooding this project directly.

## [0.3.1] — 2026 (early access / beta)

### Security
- Fixed an SSRF gap: the real-browser render path (`engine/render.ts` —
  used by `a11y_audit_axe`, `a11y_audit_demo`, and browser-mode
  `a11y_audit_url`/`a11y_crawl_audit`, i.e. the default path for nearly
  every audit) had no protection against reaching cloud-provider
  instance-metadata services (`169.254.169.254` and equivalents), which
  commonly expose credentials to whatever can reach them. The static-fetch
  path (`engine/fetch.ts`) had a partial guard, but only checked the
  original URL — a redirect to a blocked host bypassed it, and the guard
  was skipped entirely whenever browser mode was used (the default).
  New shared `engine/ssrfGuard.ts`: blocks the full `169.254.0.0/16`
  link-local range and known metadata hostnames (not just the single
  canonical IP), applied to every redirect hop in the static-fetch path
  and via real Playwright request interception in the browser path
  (covering navigation, redirects, and sub-resource requests the audited
  page's own content makes). Does not block localhost/private-network
  targets — internal/intranet auditing remains a core, intentional
  feature. Verified live: a real Playwright navigation that redirects
  mid-flight to the metadata endpoint is actually blocked, not just an
  obviously-bad initial URL.

## [0.3.0] — 2026 (early access / beta)

Prompt-generation consistency and audit-engine accuracy pass.

### Added
- `a11y_build_audit_prompt` MCP tool — the audit-side counterpart to
  `a11y_build_prompt`. Classifies a target (repo path, internal/intranet, or
  public-facing external) and picks the right audit tool by default.
- `a11y://references` resource: curated external references (MDN HTML, W3C
  WAI tutorials/tips/fundamentals, digital.gov content-design/UX guides,
  WebAIM quickref/designers/ARIA techniques), surfaced both as a readable
  resource and inside every generated build/audit prompt.
- Single source of truth for prompt generation: `a11y_build_prompt`,
  `a11y_build_audit_prompt`, and both bundled UIs now call the same compiled
  builder logic instead of independently hand-maintained copies — a pattern
  added once appears everywhere with no separate UI changes needed.
- Every generated build prompt now includes a mandatory verify-chain
  instruction (run `a11y_audit_demo` → `a11y_release_gate`, treat `BLOCKED`
  as a stop, record library components via `a11y_manifest_record`) and the
  required "manual gates pending" honesty disclosure.
- `a11y_component_guidance` / `a11y_build_prompt` now cover all 12 APG
  patterns from the accessible-component-authoring skill (was 6): added
  listbox, grid, tree view, tree grid, date picker, and fixed a
  `"menu"`/`"menu button"` naming mismatch that caused menu-button requests
  to silently miss their contract.
- Source-pattern conformance checking (`a11y_audit_axe`'s internal-scope
  widget-contract checks) extended to listbox, grid, tree view, and tree
  grid; added dialog's `aria-modal` check, combobox's `aria-autocomplete`
  check, tabs' per-tab/per-panel checks, and reverse-lookup trigger checks
  for menu button and tooltip.

### Fixed
- Single-page audit prompts now default to `a11y_audit_axe` (the actual
  audit of record — real axe-core in a browser, plus source-pattern
  conformance) instead of the weaker `a11y_audit_url` (delivered HTML only),
  matching the accessibility-auditing skill's own stated tool hierarchy.
- Removed a false-positive-prone tooltip pattern-gap check that asserted an
  "accessible name" requirement not actually in its contract; replaced with
  a correctly-grounded trigger-side check.
- Fixed a naming mismatch that silently mis-tiered `tree view`, `tree grid`,
  `date picker`, and `text input` components in the release-gate risk-tier
  resolver, and one that left `tooltip` untiered entirely.
- Removed an accidental `@playwright/test` dependency that had silently
  dropped `playwright-core`'s `optional: true` status in the lockfile,
  undermining the intentionally-optional browser-audit design.

## [0.2.0] — 2026 (early access / beta)

First controlled-distribution release.

### Added
- MCP server (13 tools + 2 resources) for accessible-component authoring and
  auditing of live sites, repos, and unhosted code against WCAG 2.2 Level A and AA.
- Policy layer: decision hierarchy, non-negotiables, 7 required gates, 3 risk
  tiers, Definition of Done, release lifecycle, and implementation checklist.
- Release gate with enforced provenance and hard-block on critical defects.
- Live audit (URL + same-origin crawl), axe audit of record (axe-core 4.12.1),
  headless render mode, and pre-production review of unhosted code.
- Library layer: repo-committed manifest, library rollup with exception-expiry
  enforcement, and cross-component consistency checks.
- Browser provisioning with layered fallback and `promptly doctor`.
- Three Skills, three UIs (guided, expert, component tester), and a reference
  `<a11y-dialog>` component.
- Proprietary evaluation license and non-blocking evaluation notice.

### Notes
- Static analysis is necessary but not sufficient; keyboard flows, screen-reader
  output, and cognitive clarity remain manual gates by design.
