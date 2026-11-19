# Malimbe by Beyond-A11y — configuration & repo wiring

The server is stateless-by-default but repo-aware when you point it at a workspace. Nothing here is required to start; every var has a safe default.

| Variable | Purpose | Default |
|---|---|---|
| `A11Y_MANIFEST_PATH` | Component manifest location (library state; commit it). | `./a11y-manifest.json` |
| `A11Y_BROWSER_CHANNEL` | Reuse an installed browser for axe/render (`chrome`, `msedge`). | `chromium` |
| `A11Y_BROWSER_PATH` | Absolute path to a browser binary, overrides channel. | — |
| `A11Y_AUTO_INSTALL` | `1` = also auto-install Chromium on first in-audit browser need; `0` = never. `doctor --fix` / `a11y_browser_check{install:true}` provision regardless. | on for setup surfaces, off in-audit |

## Wiring it to a repo (after dissemination)

The server resolves the manifest and any served asset files **against the process working directory**, which for an editor-launched MCP is the open workspace. To wire it to a repo:

1. Launch the MCP with the repo as cwd (VS Code / Claude Code / Codex do this automatically when the config lives in the repo).
2. Commit `a11y-manifest.json` at the repo root so `a11y_library_status` and `a11y_consistency_check` read real library state.
3. For pre-production checks, `a11y_audit_demo` serves component files **from paths under that cwd** — so `files: ["dist/my-dialog.js"]` resolves inside the repo, and path-escape outside the workspace is refused.

Suggested repo layout the tool is ready to consume:

```
repo/
  a11y-manifest.json        # library state (committed)
  .vscode/mcp.json          # launches the server with the repo as cwd
  packages/ui/dist/*.js     # built components a11y_audit_demo can mount
```

No repo is bundled with this package; these are the hooks a consuming repo plugs into.
