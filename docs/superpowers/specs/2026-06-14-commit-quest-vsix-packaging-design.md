# Commit Quest — VS Code Extension `.vsix` Packaging design

> **Status:** design approved 2026-06-14. Plan: `docs/superpowers/plans/`.
> Make the companion extension installable as a standalone `.vsix` (local install, no marketplace).
> Today it only runs via F5 dev-host because the webview loads its bundle from a sibling `app/dist`
> that isn't inside the extension. Bundle the webview into the extension and add a single build
> pipeline — which also removes the build-drift that left a stale bundle running.

## Goal

`npm run package` (from `app/extension/`) produces `commit-quest-companion-<version>.vsix` that
installs cleanly (`code --install-extension *.vsix`) and shows the live HUD panel — self-contained,
no repo checkout required at runtime.

## Constraints

- **Local install only** (user-confirmed) — no marketplace publish. Placeholder `publisher`; no
  marketplace icon/README/LICENSE work.
- **Single asset source** (user-confirmed) — both F5 dev and the packaged vsix load the webview from
  the same in-extension `webview/` dir. The old `../dist` reference is removed. Dev requires a build
  before F5 (it already did; we add a copy step).
- **No runtime change.** State still flows `~/.agentrpg/state.json` → `state-feed` watch/read →
  `postMessage` → webview (`postMessageTransport`). This already works packaged (reads the user's
  home, no dev server). Nothing in `core`/`app/src` changes.
- **Extension stays out of `adapters/`** — it is a UI host, not agent-aware (existing convention).

## Architecture

```
npm run package  (app/extension/)
  1. (cd ../ && vite build)                         → app/dist/assets/{app.js, app.css, …}
  2. copy app/dist/assets/  →  app/extension/webview/assets/   (assets ship inside the extension)
  3. node esbuild.mjs                                → app/extension/dist/extension.js  (self-contained; external: vscode)
  4. vsce package                                    → commit-quest-companion-<version>.vsix

runtime (packaged or F5):
  extension.ts loads webview assets from  context.extensionUri/webview/assets/{app.js,app.css}
  state-feed reads ~/.agentrpg/state.json, watches the home dir, postMessages → webview  (unchanged)
```

The key change: the webview asset root moves from `context.extensionUri/../dist` (outside the
extension) to `context.extensionUri/webview` (inside it). One source for dev and packaged → no drift.

## Components / files

| File | Responsibility | New/Mod |
|---|---|---|
| `app/extension/src/extension.ts` | webview asset root `../dist` → `webview` (in-extension); `localResourceRoots` + asset URIs updated | Modify |
| `app/extension/scripts/copy-webview.mjs` | copy `app/dist/assets/` → `app/extension/webview/assets/` (Node `fs.cpSync`, clean target first) | Create |
| `app/extension/package.json` | add `publisher`, `repository`; `@vscode/vsce` devDep; scripts: `copy-webview`, `build:all`, `package` | Modify |
| `app/extension/.vscodeignore` | trim the vsix to runtime files only | Create |
| `.gitignore` | ignore `app/extension/webview/` (build artifact) and `*.vsix` | Modify |
| `docs/reference/project-structure.md` | note the `webview/` build dir + packaging flow | Modify |

## Details

### `extension.ts` change
The `resolveView` currently does:
```ts
const distRoot = vscode.Uri.joinPath(context.extensionUri, "..", "dist");
```
becomes:
```ts
const distRoot = vscode.Uri.joinPath(context.extensionUri, "webview");
```
The two `asWebviewUri(joinPath(distRoot, "assets", "app.js" / "app.css"))` lines are unchanged below
that — they already point at `assets/` under `distRoot`. `localResourceRoots: [distRoot]` keeps the
webview able to load anything under `webview/` (covers any code-split chunks Vite emits).

### `copy-webview.mjs` (pure Node, no deps)
```js
import { rmSync, cpSync, mkdirSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const here = dirname(fileURLToPath(import.meta.url));        // app/extension/scripts
const ext = join(here, "..");                                // app/extension
const src = join(ext, "..", "dist", "assets");               // app/dist/assets
const dest = join(ext, "webview", "assets");

rmSync(join(ext, "webview"), { recursive: true, force: true });
mkdirSync(dest, { recursive: true });
cpSync(src, dest, { recursive: true });
console.log(`copied ${src} -> ${dest}`);
```
Copies the whole `assets/` dir (app.js + app.css + any chunk files), so it is robust to Vite
code-splitting. The webview HTML only references `app.js`/`app.css`; chunks (if any) resolve
relative to `app.js` and are reachable under `localResourceRoots`.

### `package.json` scripts
```jsonc
"scripts": {
  "build": "node esbuild.mjs",
  "copy-webview": "node scripts/copy-webview.mjs",
  "build:all": "npm --prefix .. run build && npm run copy-webview && npm run build",
  "package": "npm run build:all && vsce package --no-dependencies",
  "typecheck": "tsc --noEmit"
}
```
- `npm --prefix .. run build` runs the app's `vite build` (the `..` is the `app/` workspace).
- `vsce package --no-dependencies` skips npm dependency packaging (the extension is esbuild-bundled
  and `node_modules` is `.vscodeignore`d). Add `publisher` (placeholder, e.g. `"natpat"`) and
  `repository` so vsce does not error/warn-hard.
- `@vscode/vsce` added to `devDependencies`. `vsce` is invoked via the local binary
  (`npx vsce` if the bare `vsce` isn't on PATH — the plan resolves the exact invocation).

### `.vscodeignore`
Include only what the installed extension needs at runtime: `dist/extension.js`, `webview/**`,
`media/**`, `package.json`. Exclude `src/**`, `scripts/**`, `node_modules/**`, `**/*.map`,
`**/*.test.*`, `tsconfig.json`, `esbuild.mjs`, `.vscode/**`, `webview/**/*.map`.

### Dev (F5) flow
Run `npm run build:all` from `app/extension/` before pressing F5. F5's `context.extensionUri` is
`app/extension/`, so it loads `app/extension/webview/assets/*` — the same artifacts the vsix ships.
The `.vscode/launch.json` can gain a `preLaunchTask` later, but that is optional and out of scope.

## Error handling / edge cases

- **`app/dist` missing when copy runs:** `build:all` always runs `vite build` first, so `dist/assets`
  exists before the copy. (`copy-webview` run alone with no prior build fails loudly — acceptable, it
  is an internal step.)
- **Stale `webview/`:** `copy-webview.mjs` deletes `webview/` before copying, so removed assets never
  linger.
- **vsix path drift:** because there is exactly one build path producing `webview/`, the F5 panel and
  the installed vsix can never diverge (the bug that surfaced earlier).
- **node_modules excluded but bundled:** `esbuild.mjs` bundles `extension.ts` with only `vscode`
  external (provided by the host), so `dist/extension.js` is self-contained.

## Testing

- Existing `webview-html.test.ts` + `state-feed.test.ts` still pass (logic unchanged; URIs are
  passed in).
- **Packaging verification (manual, documented in the plan):**
  1. `cd app/extension && npm run package` → a `commit-quest-companion-0.0.1.vsix` is produced.
  2. `code --install-extension commit-quest-companion-0.0.1.vsix` installs without error.
  3. Open the "Commit Quest" panel → the live HUD renders from `~/.agentrpg/state.json` (the new
     3.8a/3.8b behavior: no monster nameplate, wave combat, guild/transition).
- A grep assertion in the plan confirms the vsix contains `webview/assets/app.js` and excludes
  `src/` (`vsce ls` or `unzip -l`).

## Scope / non-goals

- **No marketplace publish** — no publisher account, no PNG marketplace icon, no README/LICENSE pass.
- **No CI / auto-versioning** — `version` bumped by hand.
- **No `preLaunchTask` automation** — documenting "run `build:all` before F5" is enough for now.
- **No runtime/core/app-logic change** — packaging only.
