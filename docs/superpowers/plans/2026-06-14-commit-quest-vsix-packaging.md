# Commit Quest — `.vsix` Packaging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Commit Quest VS Code companion installable as a standalone `.vsix` (local install) by bundling the webview assets into the extension and adding one combined build pipeline.

**Architecture:** The webview asset root moves from the sibling `app/dist` to an in-extension `webview/` dir. A `copy-webview.mjs` step copies the Vite build into `app/extension/webview/`, and an npm `package` script chains `vite build → copy → esbuild → vsce package`. Same artifacts feed F5 dev and the packaged vsix → no drift. No runtime/core/app-logic change.

**Tech Stack:** VS Code extension (esbuild, CommonJS), Node ESM build scripts, `@vscode/vsce`, Vite (the app workspace).

**Spec:** `docs/superpowers/specs/2026-06-14-commit-quest-vsix-packaging-design.md`

---

## Context for the implementer

- The extension lives in `app/extension/` (a UI host, NOT in `adapters/` — it is not agent-aware). It is built with esbuild (`esbuild.mjs`, output `dist/extension.js`, `external: ["vscode"]`). The webview HTML is generated in code (`buildWebviewHtml`) — there is no `index.html` to ship; only `assets/app.js` + `assets/app.css` (plus any Vite chunks) matter.
- The app workspace is `app/` (npm + Vite). `npm --prefix ../ run build` from `app/extension/` runs the app's `vite build`, producing `app/dist/assets/{app.js,app.css}` (stable unhashed names, per `app/vite.config.ts`).
- State reaches the webview at runtime via `state-feed.ts` reading `~/.agentrpg/state.json` + `postMessage` — this already works in a packaged extension (reads the user's home, no dev server). **Nothing in `core/` or `app/src/` changes.**
- `app/extension/dist/` is already gitignored (root `.gitignore`). `app/extension/webview/` is new and must be gitignored too.
- Run extension/app tests with `bun test` from the repo root (they run under bun). Read results with `bun test 2>&1 | grep -E "pass|fail"` — never `tail`.
- `@vscode/vsce` is NOT installed yet; Task 3 adds it.

---

## Task 1: Point the webview at the in-extension `webview/` dir

**Files:**
- Modify: `app/extension/src/extension.ts:19-20`
- Test: `app/extension/src/webview-html.test.ts` (existing — must stay green)

- [ ] **Step 1: Change the asset root in `extension.ts`**

The current lines 19-20 are:

```ts
  // app/extension/ -> app/dist (the Vite build output)
  const distRoot = vscode.Uri.joinPath(context.extensionUri, "..", "dist");
```

Replace them with:

```ts
  // Webview assets are copied into the extension (scripts/copy-webview.mjs) so the same bundle
  // ships in the .vsix and is loaded under F5 — one source, no drift.
  const distRoot = vscode.Uri.joinPath(context.extensionUri, "webview");
```

Leave everything below unchanged — the two `asWebviewUri(joinPath(distRoot, "assets", "app.js"/"app.css"))` lines and `localResourceRoots: [distRoot]` already resolve against `distRoot`.

- [ ] **Step 2: Type-check + existing tests**

Run: `cd app/extension && bunx tsc --noEmit 2>&1 | grep -E "error TS" | head` — expect no output.
Run: `cd /Users/calypso/Project/Ottery/commit-quest && bun test 2>&1 | grep -E "pass|fail" | tail -2` — expect all pass (the URI tests pass `scriptUri`/`styleUri` in, so they are unaffected).

- [ ] **Step 3: Commit**

```bash
git add app/extension/src/extension.ts
git commit -m "feat(ext): load webview assets from in-extension webview/ (vsix-ready)"
```

---

## Task 2: `copy-webview.mjs` build step

**Files:**
- Create: `app/extension/scripts/copy-webview.mjs`

- [ ] **Step 1: Create the copy script**

```js
import { rmSync, cpSync, mkdirSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const here = dirname(fileURLToPath(import.meta.url)); // app/extension/scripts
const ext = join(here, ".."); // app/extension
const src = join(ext, "..", "dist", "assets"); // app/dist/assets
const destRoot = join(ext, "webview");
const dest = join(destRoot, "assets");

if (!existsSync(src)) {
  console.error(`copy-webview: missing ${src} — run the app build first (vite build).`);
  process.exit(1);
}

rmSync(destRoot, { recursive: true, force: true }); // drop stale assets so nothing lingers
mkdirSync(dest, { recursive: true });
cpSync(src, dest, { recursive: true });
console.log(`copy-webview: ${src} -> ${dest}`);
```

- [ ] **Step 2: Smoke-test the script end to end**

Run:
```bash
cd /Users/calypso/Project/Ottery/commit-quest/app && npm run build >/dev/null 2>&1
cd /Users/calypso/Project/Ottery/commit-quest/app/extension && node scripts/copy-webview.mjs
ls webview/assets
```
Expected: prints `copy-webview: …/app/dist/assets -> …/app/extension/webview/assets` and `ls` shows `app.js` and `app.css`.

- [ ] **Step 3: Commit**

```bash
git add app/extension/scripts/copy-webview.mjs
git commit -m "feat(ext): copy-webview build step (app/dist -> extension/webview)"
```

---

## Task 3: Packaging scripts + `@vscode/vsce` + metadata

**Files:**
- Modify: `app/extension/package.json`

- [ ] **Step 1: Add `@vscode/vsce` as a dev dependency**

Run:
```bash
cd /Users/calypso/Project/Ottery/commit-quest/app/extension && npm install --save-dev @vscode/vsce
```
Expected: installs, `package.json` gains `@vscode/vsce` under `devDependencies`, and `node_modules/.bin/vsce` exists (`npx vsce --version` prints a version).

- [ ] **Step 2: Add `publisher` + `repository` and the build/package scripts**

Edit `app/extension/package.json`:

(a) Add a top-level `"publisher": "natpat"` field (placeholder — local install only; required so `vsce` does not error).

(b) Add a top-level `"repository"`:
```jsonc
"repository": { "type": "git", "url": "https://github.com/Hin-Nattapat/commit-quest" },
```

(c) Replace the `"scripts"` block with:
```jsonc
"scripts": {
  "build": "node esbuild.mjs",
  "copy-webview": "node scripts/copy-webview.mjs",
  "build:all": "npm --prefix .. run build && npm run copy-webview && npm run build",
  "package": "npm run build:all && vsce package --no-dependencies",
  "typecheck": "tsc --noEmit"
}
```

- [ ] **Step 3: Verify the scripts resolve (build:all only — packaging is Task 5)**

Run: `cd /Users/calypso/Project/Ottery/commit-quest/app/extension && npm run build:all`
Expected: runs the app's `vite build`, then `copy-webview` (prints the copy line), then esbuild (`dist/extension.js` rebuilt). No errors. `ls webview/assets dist` shows `app.js`, `app.css`, and `extension.js`.

- [ ] **Step 4: Commit**

```bash
git add app/extension/package.json app/extension/package-lock.json
git commit -m "build(ext): add vsce + build:all/package scripts + publisher metadata"
```

---

## Task 4: `.vscodeignore` + `.gitignore`

**Files:**
- Create: `app/extension/.vscodeignore`
- Modify: `.gitignore` (repo root)

- [ ] **Step 1: Create `app/extension/.vscodeignore`**

Trim the vsix to runtime files only (keep `dist/extension.js`, `webview/**`, `media/**`, `package.json`):

```
src/**
scripts/**
node_modules/**
.vscode/**
**/*.test.ts
**/*.map
tsconfig.json
esbuild.mjs
.gitignore
package-lock.json
```

- [ ] **Step 2: Add `webview/` and `*.vsix` to the root `.gitignore`**

The root `.gitignore` currently ends with:
```
app/dist/
app/extension/dist/
.superpowers/
```
Add two lines after `app/extension/dist/`:
```
app/extension/webview/
*.vsix
```

- [ ] **Step 3: Verify git ignores the build artifacts**

Run:
```bash
cd /Users/calypso/Project/Ottery/commit-quest
git check-ignore app/extension/webview/assets/app.js && echo "webview ignored"
git status --porcelain | grep -E "webview/|\.vsix" || echo "no webview/vsix tracked"
```
Expected: `webview ignored` and `no webview/vsix tracked`.

- [ ] **Step 4: Commit**

```bash
git add app/extension/.vscodeignore .gitignore
git commit -m "build(ext): .vscodeignore (trim vsix) + ignore webview/ and *.vsix"
```

---

## Task 5: Produce + verify the `.vsix` and document the flow

**Files:**
- Modify: `docs/reference/project-structure.md`

- [ ] **Step 1: Package the extension**

Run: `cd /Users/calypso/Project/Ottery/commit-quest/app/extension && npm run package 2>&1 | tail -15`
Expected: `build:all` runs, then `vsce package` prints `Packaged: …/commit-quest-companion-0.0.1.vsix (N files)`. A `commit-quest-companion-0.0.1.vsix` exists in `app/extension/`.

If `vsce` errors on `"private": true`, remove that field from `package.json` (the extension is never npm-published) and re-run. If it errors on a missing field, the message names it — add it to `package.json`.

- [ ] **Step 2: Verify the vsix contents (includes webview, excludes src)**

Run: `cd /Users/calypso/Project/Ottery/commit-quest/app/extension && npx vsce ls 2>/dev/null | grep -E "webview/assets/app.(js|css)|dist/extension.js|src/" | sort`
Expected: lists `dist/extension.js`, `webview/assets/app.js`, `webview/assets/app.css`, and **no** `src/` entries.

- [ ] **Step 3: Document the packaging flow in `docs/reference/project-structure.md`**

Append a short subsection (find the section describing `app/extension/` and add after it; if no such section exists, append at the end under a new `## Packaging` heading):

```markdown
## Packaging the VS Code extension

The companion installs as a local `.vsix`:

- `cd app/extension && npm run package` → builds the app (Vite), copies `app/dist/assets` into
  `app/extension/webview/` (gitignored), bundles the extension host (esbuild), and runs `vsce package`
  → `commit-quest-companion-<version>.vsix`.
- Install: `code --install-extension commit-quest-companion-<version>.vsix`.
- The webview loads its bundle from the in-extension `webview/` dir, so the same artifacts run under
  F5 and in the installed vsix — **run `npm run build:all` before pressing F5.**
```

- [ ] **Step 4: Commit**

```bash
git add docs/reference/project-structure.md
git commit -m "docs: document the .vsix packaging + install flow"
```

- [ ] **Step 5: Manual install verification (report, do not automate)**

Report these for the human to run (they need a live `~/.agentrpg/state.json`):
1. `code --install-extension app/extension/commit-quest-companion-0.0.1.vsix`
2. Reload VS Code → open the **Commit Quest** panel → the HUD renders the current state with the new
   3.8a/3.8b behavior (no monster nameplate, wave combat, guild on fresh-open/rest, world-transition).

---

## Self-Review

**Spec coverage:**
- Webview asset root `../dist` → `webview` → Task 1. ✅
- `copy-webview.mjs` (clean + copy `assets/`) → Task 2. ✅
- `package.json` publisher/repository/`@vscode/vsce`/scripts → Task 3. ✅
- `.vscodeignore` + `.gitignore` (`webview/`, `*.vsix`) → Task 4. ✅
- Produce vsix + verify contents + doc note → Task 5. ✅
- No runtime/core/app change; existing tests stay green → Tasks 1–3 verify steps. ✅
- Single source for dev + packaged (build before F5) → Task 1 comment + Task 5 doc. ✅

**Placeholder scan:** none — every step has concrete code/commands.

**Consistency:** the asset root constant `distRoot` now points at `webview` (Task 1); `copy-webview.mjs` writes `app/extension/webview/assets/` (Task 2); `.vscodeignore` keeps `webview/**` (Task 4); the vsix-contents check greps `webview/assets/app.js` (Task 5) — all paths agree. `build:all` = app build → copy-webview → esbuild (Task 3) matches the spec's 4-step pipeline (vsce is the `package` script's tail). The `publisher` placeholder `natpat` is used consistently.

**Note:** This is packaging/ops work — most "tests" are run-and-verify commands rather than unit tests. The two existing extension unit tests (`webview-html.test.ts`, `state-feed.test.ts`) must stay green (Task 1 verifies), but no new unit tests are warranted; the deliverable is verified by `vsce package` succeeding and `vsce ls` showing the right contents.
