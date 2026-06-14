# Commit Quest Companion

A live Commit Quest companion panel for VS Code — shows your coding RPG character (class, level, XP,
loot, achievements) and an animated AFK scene, fed from `~/.agentrpg/state.json`.

## Install (local `.vsix`)

```bash
cd app/extension
npm run reinstall   # package + force-install the freshest vsix in one shot
# or, separately:
npm run package                                              # → commit-quest-companion-<version>.vsix
code --install-extension commit-quest-companion-0.0.1.vsix
```

Reload VS Code (`Developer: Reload Window`), then open the **Commit Quest** panel (next to Terminal / Output).

To remove: `code --uninstall-extension natpat.commit-quest-companion`.

## Develop (F5)

```bash
cd app/extension && npm run build:all   # build app → copy webview → bundle extension
```

Then press **F5** to launch the Extension Development Host. The panel and the installed vsix load the
same `webview/` bundle, so always run `build:all` before F5 (and close the dev host before testing an
installed copy to avoid a panel collision).

## How it works

- `src/state-feed.ts` watches `~/.agentrpg/state.json` and pushes it to the webview via `postMessage`.
- The webview is the `app/` React build (Vite), copied into `webview/` by `scripts/copy-webview.mjs`.
- The extension host bundles with esbuild (`external: vscode`); the webview HTML is generated in
  `src/webview-html.ts` with a CSP nonce.

See `docs/reference/commands.md` for the full command list.
