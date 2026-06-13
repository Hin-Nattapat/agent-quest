# Phase 3.3 — VS Code Companion Panel (minimal shell) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render the existing Commit Quest companion (current plain HUD, unchanged) inside a VS Code webview panel, fed live by `~/.agentrpg/state.json` through a `postMessage` transport.

**Architecture:** `app/` gains a second UI host alongside the browser SSE host. A new Node extension (`app/extension/`) watches `state.json` and posts it to a webview; the React renderer subscribes through a new `postMessageTransport` (the transport seam), so the renderer and `core/` are untouched. The extension is a *UI host*, not agent-aware, so it lives under `app/` (not `adapters/`, which is agent-aware only per CLAUDE.md §1).

**Tech Stack:** TypeScript, Bun (tests), React 19 + Vite (existing app build), VS Code Extension API, esbuild (extension bundle). Runtime engine deps stay jq+bun — npm lives only under `app/`.

**Spec:** `docs/superpowers/specs/2026-06-13-commit-quest-phase3-3-vscode-panel-design.md`

---

## File Structure

| File | Responsibility | New/Mod |
|---|---|---|
| `app/src/transport.ts` | add `postMessageTransport(api, target)` + `selectTransport(win)` | Modify |
| `app/src/transport.test.ts` | tests for the two new exports | Modify |
| `app/src/main.tsx` | choose transport via `selectTransport(window)` | Modify |
| `app/vite.config.ts` | pin stable output names (`assets/app.js`, `assets/app.css`) | Modify |
| `app/extension/src/webview-html.ts` | `buildWebviewHtml(args)` → panel HTML string (pure) | Create |
| `app/extension/src/webview-html.test.ts` | tests for the HTML builder | Create |
| `app/extension/src/state-feed.ts` | `readStateText(home)` + `watchState(home, onJson)` (node fs) | Create |
| `app/extension/src/state-feed.test.ts` | tests for `readStateText` | Create |
| `app/extension/src/extension.ts` | `activate()`: command + panel + wire state-feed (vscode glue) | Create |
| `app/extension/package.json` | extension manifest + scripts + devDeps | Create |
| `app/extension/tsconfig.json` | extension tsconfig (commonjs, vscode types) | Create |
| `app/extension/esbuild.mjs` | bundle `extension.ts` → `dist/extension.js` | Create |

**Message contract (host ↔ webview):**
- host → webview: `{ type: "state", json: <raw state.json text> }`
- webview → host: `{ type: "ready" }` (sent on subscribe; host replies with current state — fixes the mount race)

The `json` is the raw multi-line text (same payload the SSE host sends), parsed by the existing `parseStateEvent`.

---

### Task 1: `postMessageTransport`

**Files:**
- Modify: `app/src/transport.ts`
- Test: `app/src/transport.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `app/src/transport.test.ts`:

```ts
import { parseStateEvent, sseTransport, postMessageTransport } from "./transport";

class FakeTarget {
  handler: ((e: { data: unknown }) => void) | null = null;
  addEventListener(_type: "message", cb: (e: { data: unknown }) => void) {
    this.handler = cb;
  }
  removeEventListener() {
    this.handler = null;
  }
  emit(data: unknown) {
    this.handler?.({ data });
  }
}

test("postMessageTransport delivers state, posts ready, ignores non-state, unsubscribes", () => {
  const fake = new FakeTarget();
  const posted: unknown[] = [];
  const api = { postMessage: (m: unknown) => posted.push(m) };
  const transport = postMessageTransport(api, fake as unknown as Window);

  const seen: number[] = [];
  const unsubscribe = transport.subscribe(s => seen.push(s.level));

  expect(posted).toEqual([{ type: "ready" }]);
  fake.emit({ type: "state", json: JSON.stringify(sample) });
  fake.emit({ type: "other" }); // ignored
  fake.emit({ type: "state", json: "{bad" }); // malformed -> last good kept
  expect(seen).toEqual([5]);

  unsubscribe();
  expect(fake.handler).toBe(null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test app/src/transport.test.ts`
Expected: FAIL — `postMessageTransport is not a function` (not exported yet).

- [ ] **Step 3: Implement `postMessageTransport`**

Append to `app/src/transport.ts`:

```ts
export interface IVsCodeApi {
  postMessage(message: unknown): void;
}

interface IMessageTarget {
  addEventListener(type: "message", handler: (event: MessageEvent) => void): void;
  removeEventListener(type: "message", handler: (event: MessageEvent) => void): void;
}

// Host posts { type: "state", json } where json is the raw state.json text (same payload SSE sends).
export function postMessageTransport(
  api: IVsCodeApi,
  target: IMessageTarget = window,
): ITransport {
  return {
    subscribe(onState) {
      const handler = (event: MessageEvent) => {
        const message = event.data as { type?: string; json?: string };
        if (message?.type !== "state" || typeof message.json !== "string") {
          return;
        }
        const state = parseStateEvent(message.json);
        if (state) {
          onState(state);
        }
      };
      target.addEventListener("message", handler);
      api.postMessage({ type: "ready" }); // ask the host for the current state (mount-race fix)
      return () => target.removeEventListener("message", handler);
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test app/src/transport.test.ts`
Expected: PASS (all transport tests green).

- [ ] **Step 5: Commit**

```bash
git add app/src/transport.ts app/src/transport.test.ts
git commit -m "feat(app): postMessage transport for the VS Code webview host"
```

---

### Task 2: `selectTransport` + wire `main.tsx`

**Files:**
- Modify: `app/src/transport.ts`
- Test: `app/src/transport.test.ts`
- Modify: `app/src/main.tsx`

- [ ] **Step 1: Write the failing test**

Append to `app/src/transport.test.ts`:

```ts
import { selectTransport } from "./transport";

test("selectTransport picks postMessage when acquireVsCodeApi exists", () => {
  const posted: unknown[] = [];
  const fakeWin = {
    acquireVsCodeApi: () => ({ postMessage: (m: unknown) => posted.push(m) }),
    addEventListener() {},
    removeEventListener() {},
  };
  const transport = selectTransport(fakeWin as unknown as Window);
  transport.subscribe(() => {});
  expect(posted).toEqual([{ type: "ready" }]); // proves the postMessage branch was chosen
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test app/src/transport.test.ts`
Expected: FAIL — `selectTransport is not a function`.

- [ ] **Step 3: Implement `selectTransport`**

Append to `app/src/transport.ts`:

```ts
interface IVsCodeWindow {
  acquireVsCodeApi?: () => IVsCodeApi;
  addEventListener(type: "message", handler: (event: MessageEvent) => void): void;
  removeEventListener(type: "message", handler: (event: MessageEvent) => void): void;
}

// In a VS Code webview, acquireVsCodeApi is injected and may be called only once.
// Everywhere else (browser dev, prod SSE bridge) fall back to the SSE endpoint.
export function selectTransport(win: IVsCodeWindow): ITransport {
  if (typeof win.acquireVsCodeApi === "function") {
    return postMessageTransport(win.acquireVsCodeApi(), win);
  }
  return sseTransport("/events");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test app/src/transport.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire `main.tsx`**

Replace `app/src/main.tsx` contents with:

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./app";
import { selectTransport } from "./transport";
import "./styles.css";

const transport = selectTransport(window as unknown as Parameters<typeof selectTransport>[0]);
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App transport={transport} />
  </StrictMode>,
);
```

- [ ] **Step 6: Typecheck the app**

Run: `cd app && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add app/src/transport.ts app/src/transport.test.ts app/src/main.tsx
git commit -m "feat(app): select postMessage vs SSE transport by environment"
```

---

### Task 3: Stable Vite output names

**Files:**
- Modify: `app/vite.config.ts`

The webview references the built JS/CSS by exact name. Pin the output so the extension does not have to parse `index.html` for hashed filenames.

- [ ] **Step 1: Edit `app/vite.config.ts`**

Replace the `build` field so the file reads:

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev: Vite serves the app with HMR and proxies the SSE endpoint to the Bun bridge,
// so the app always calls "/events" in both dev and prod.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { "/events": "http://localhost:7070" },
  },
  build: {
    outDir: "dist",
    // Stable, unhashed names so the VS Code webview can reference assets/app.js + app.css directly.
    rollupOptions: {
      output: {
        entryFileNames: "assets/app.js",
        chunkFileNames: "assets/app-[name].js",
        assetFileNames: "assets/app.[ext]",
      },
    },
  },
});
```

- [ ] **Step 2: Build and verify the output names**

Run: `cd app && npm run build && ls dist/assets`
Expected: `dist/assets/app.js` and `dist/assets/app.css` exist (no content hashes).

- [ ] **Step 3: Commit**

```bash
git add app/vite.config.ts
git commit -m "build(app): pin stable bundle names for the webview host"
```

---

### Task 4: `buildWebviewHtml`

**Files:**
- Create: `app/extension/src/webview-html.ts`
- Test: `app/extension/src/webview-html.test.ts`

- [ ] **Step 1: Write the failing test**

Create `app/extension/src/webview-html.test.ts`:

```ts
import { test, expect } from "bun:test";
import { buildWebviewHtml } from "./webview-html";

test("buildWebviewHtml embeds URIs, nonce, and a strict CSP", () => {
  const html = buildWebviewHtml({
    scriptUri: "vscode-webview://abc/assets/app.js",
    styleUri: "vscode-webview://abc/assets/app.css",
    cspSource: "vscode-webview://abc",
    nonce: "N0NCE",
  });

  expect(html).toContain('src="vscode-webview://abc/assets/app.js"');
  expect(html).toContain('href="vscode-webview://abc/assets/app.css"');
  expect(html).toContain('nonce="N0NCE"');
  expect(html).toContain("script-src 'nonce-N0NCE'");
  expect(html).toContain('<div id="root"></div>');
  // no remote script origins — only the nonce is allowed to run scripts
  expect(html).not.toMatch(/script-src[^;]*https?:/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test app/extension/src/webview-html.test.ts`
Expected: FAIL — module not found / `buildWebviewHtml is not a function`.

- [ ] **Step 3: Implement `buildWebviewHtml`**

Create `app/extension/src/webview-html.ts`:

```ts
export interface IBuildWebviewHtmlArgs {
  scriptUri: string;
  styleUri: string;
  cspSource: string;
  nonce: string;
}

export const buildWebviewHtml = (args: IBuildWebviewHtmlArgs): string => {
  const { scriptUri, styleUri, cspSource, nonce } = args;
  const csp = [
    "default-src 'none'",
    `img-src ${cspSource} data:`,
    `font-src ${cspSource}`,
    `style-src ${cspSource}`,
    `script-src 'nonce-${nonce}'`,
  ].join("; ");
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="Content-Security-Policy" content="${csp};" />
    <link rel="stylesheet" href="${styleUri}" />
    <title>Commit Quest</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
  </body>
</html>`;
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test app/extension/src/webview-html.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/extension/src/webview-html.ts app/extension/src/webview-html.test.ts
git commit -m "feat(app/extension): pure webview HTML builder (CSP + nonce)"
```

---

### Task 5: `state-feed` (read + watch)

**Files:**
- Create: `app/extension/src/state-feed.ts`
- Test: `app/extension/src/state-feed.test.ts`

`readStateText` mirrors `app/server.ts`'s read (plain node fs — kept here so the Node extension never imports the Bun server). `watchState` watches the home dir (survives the reducer's tmp+rename) and debounces.

- [ ] **Step 1: Write the failing test**

Create `app/extension/src/state-feed.test.ts`:

```ts
import { test, expect } from "bun:test";
import { mkdtempSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { readStateText } from "./state-feed";

test("readStateText returns the file text, or null when absent", () => {
  const dir = mkdtempSync(join(tmpdir(), "cq-feed-"));
  try {
    expect(readStateText(dir)).toBe(null);
    writeFileSync(join(dir, "state.json"), '{"level":7}');
    expect(readStateText(dir)).toBe('{"level":7}');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test app/extension/src/state-feed.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `state-feed.ts`**

Create `app/extension/src/state-feed.ts`:

```ts
import { existsSync, readFileSync, watch, type FSWatcher } from "fs";
import { join } from "path";

// state.json is written atomically (tmp + rename), so a read is never partial; null if absent.
export const readStateText = (home: string): string | null => {
  const path = join(home, "state.json");
  if (!existsSync(path)) {
    return null;
  }
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
};

// Watch the home dir (survives the reducer's tmp+rename swap), debounce, emit the raw text.
export const watchState = (home: string, onJson: (json: string) => void): (() => void) => {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const watcher: FSWatcher = watch(home, (_event, filename) => {
    if (filename !== "state.json") {
      return;
    }
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      const text = readStateText(home);
      if (text) {
        onJson(text);
      }
    }, 50);
  });
  return () => {
    if (timer) {
      clearTimeout(timer);
    }
    watcher.close();
  };
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test app/extension/src/state-feed.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/extension/src/state-feed.ts app/extension/src/state-feed.test.ts
git commit -m "feat(app/extension): state.json read + debounced dir watcher (node fs)"
```

---

### Task 6: Extension scaffold + minimal `activate`

**Files:**
- Create: `app/extension/package.json`
- Create: `app/extension/tsconfig.json`
- Create: `app/extension/esbuild.mjs`
- Create: `app/extension/src/extension.ts`

- [ ] **Step 1: Create `app/extension/package.json`**

```json
{
  "name": "commit-quest-companion",
  "displayName": "Commit Quest Companion",
  "description": "Live Commit Quest companion panel in VS Code.",
  "version": "0.0.1",
  "private": true,
  "engines": { "vscode": "^1.90.0" },
  "main": "./dist/extension.js",
  "activationEvents": ["onCommand:commitQuest.openCompanion"],
  "contributes": {
    "commands": [
      { "command": "commitQuest.openCompanion", "title": "Commit Quest: Open Companion" }
    ]
  },
  "scripts": {
    "build": "node esbuild.mjs",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@types/node": "^25.0.0",
    "@types/vscode": "^1.90.0",
    "esbuild": "^0.24.0",
    "typescript": "^5.6.0"
  }
}
```

- [ ] **Step 2: Create `app/extension/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "moduleResolution": "node",
    "lib": ["ES2022"],
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["node", "vscode"]
  },
  "include": ["src"],
  "exclude": ["**/*.test.ts"]
}
```

- [ ] **Step 3: Create `app/extension/esbuild.mjs`**

```js
import { build } from "esbuild";

await build({
  entryPoints: ["src/extension.ts"],
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node18",
  external: ["vscode"], // provided by the VS Code host at runtime
  outfile: "dist/extension.js",
  sourcemap: true,
});
```

- [ ] **Step 4: Create a minimal `app/extension/src/extension.ts`**

```ts
import * as vscode from "vscode";

export const activate = (context: vscode.ExtensionContext): void => {
  context.subscriptions.push(
    vscode.commands.registerCommand("commitQuest.openCompanion", () => {
      vscode.window.showInformationMessage("Commit Quest companion — panel coming up next.");
    }),
  );
};

export const deactivate = (): void => {};
```

- [ ] **Step 5: Install deps and build**

Run: `cd app/extension && npm install && npm run build`
Expected: `dist/extension.js` is created with no errors.

- [ ] **Step 6: Typecheck**

Run: `cd app/extension && npm run typecheck`
Expected: no errors.

- [ ] **Step 7: Manual smoke (Extension Development Host)**

Open `app/extension` in VS Code, press F5 (launches an Extension Development Host). In the new window, run the command palette → *"Commit Quest: Open Companion"*.
Expected: the info message *"Commit Quest companion — panel coming up next."* appears. (If F5 needs a launch config, see Task 8's note.)

- [ ] **Step 8: Commit**

```bash
git add app/extension/package.json app/extension/tsconfig.json app/extension/esbuild.mjs app/extension/src/extension.ts
git commit -m "feat(app/extension): VS Code extension scaffold + open-companion command"
```

---

### Task 7: Webview panel + live state wiring

**Files:**
- Modify: `app/extension/src/extension.ts`

Flesh out `activate` to open a singleton webview panel, load the built app, and stream state into it.

- [ ] **Step 1: Replace `app/extension/src/extension.ts`**

```ts
import * as vscode from "vscode";
import { randomBytes } from "crypto";
import { join } from "path";
import { homedir } from "os";
import { buildWebviewHtml } from "./webview-html";
import { watchState, readStateText } from "./state-feed";

const HOME = process.env.AGENTRPG_HOME || join(homedir(), ".agentrpg");

let panel: vscode.WebviewPanel | undefined;
let disposeFeed: (() => void) | undefined;

const nonce = (): string => randomBytes(16).toString("base64");

const openPanel = (context: vscode.ExtensionContext): void => {
  if (panel) {
    panel.reveal(vscode.ViewColumn.Beside);
    return;
  }

  // app/extension/ -> app/dist (the Vite build output)
  const distRoot = vscode.Uri.joinPath(context.extensionUri, "..", "dist");
  panel = vscode.window.createWebviewPanel(
    "commitQuestCompanion",
    "Commit Quest",
    vscode.ViewColumn.Beside,
    { enableScripts: true, localResourceRoots: [distRoot], retainContextWhenHidden: true },
  );

  const { webview } = panel;
  const scriptUri = webview
    .asWebviewUri(vscode.Uri.joinPath(distRoot, "assets", "app.js"))
    .toString();
  const styleUri = webview
    .asWebviewUri(vscode.Uri.joinPath(distRoot, "assets", "app.css"))
    .toString();
  webview.html = buildWebviewHtml({
    scriptUri,
    styleUri,
    cspSource: webview.cspSource,
    nonce: nonce(),
  });

  // The webview asks for the current state once it has subscribed (mount-race fix).
  webview.onDidReceiveMessage((message: { type?: string }) => {
    if (message?.type === "ready") {
      const text = readStateText(HOME);
      if (text) {
        webview.postMessage({ type: "state", json: text });
      }
    }
  });

  disposeFeed = watchState(HOME, json => {
    webview.postMessage({ type: "state", json });
  });

  panel.onDidDispose(() => {
    disposeFeed?.();
    disposeFeed = undefined;
    panel = undefined;
  });
};

export const activate = (context: vscode.ExtensionContext): void => {
  context.subscriptions.push(
    vscode.commands.registerCommand("commitQuest.openCompanion", () => openPanel(context)),
  );
};

export const deactivate = (): void => {
  disposeFeed?.();
};
```

- [ ] **Step 2: Build the app and the extension**

Run: `cd app && npm run build && cd extension && npm run build && npm run typecheck`
Expected: both builds succeed; `app/dist/assets/app.js`+`app.css` and `app/extension/dist/extension.js` exist; typecheck clean.

- [ ] **Step 3: Manual smoke (Extension Development Host)**

F5 from `app/extension` → in the dev host run *"Commit Quest: Open Companion"*.
Expected: a panel opens beside the editor showing the current HUD (name / class / level / XP bar / streak / achievements). With a Claude Code session running (or by touching `~/.agentrpg/state.json`), the XP bar and stats update live. Resize the panel — note how the scene fits (this is the sizing signal for the next checkpoint).

- [ ] **Step 4: Commit**

```bash
git add app/extension/src/extension.ts
git commit -m "feat(app/extension): live webview panel wired to state.json via postMessage"
```

---

### Task 8: Full verification + docs

**Files:**
- Modify: `docs/reference/project-structure.md`

- [ ] **Step 1: Note `app/extension/` in the project structure**

In `docs/reference/project-structure.md`, under the `app/` tree (near the `server.ts` line), add:

```
│   ├── extension/                #   VS Code UI host (3.3): watches state.json -> postMessage -> webview
│   │   └── src/{extension,webview-html,state-feed}.ts
```

- [ ] **Step 2: Run the full test suite**

Run: `bun test 2>&1 | grep -E "pass|fail"`
Expected: all green, `0 fail` (includes the new transport / webview-html / state-feed tests). Do not pipe through `tail` — it hides the fail line.

- [ ] **Step 3: Typecheck every package**

Run:
```bash
bunx tsc --noEmit                       # root (core/tools/test)
cd app && npx tsc --noEmit && cd ..      # app (src + server.ts)
cd app/extension && npm run typecheck    # extension (commonjs + vscode types)
```
Expected: all clean.

- [ ] **Step 4: Format check**

Run: `bun run format && bun run format:check`
Expected: "All matched files use Prettier code style!"

- [ ] **Step 5: Commit**

```bash
git add docs/reference/project-structure.md
git commit -m "docs: record app/extension VS Code host in project structure"
```

> **F5 launch note (manual testing):** if pressing F5 in `app/extension` does not start an Extension Development Host, add `app/extension/.vscode/launch.json` with a single `extensionHost` config (`"args": ["--extensionDevelopmentPath=${workspaceFolder}"]`). This is a developer convenience file, not part of the shipped extension — only add it if your VS Code doesn't auto-detect the extension.

---

## Self-Review

**1. Spec coverage**
- Goal (render existing renderer in a panel via postMessage) → Tasks 1,2,7. ✓
- `postMessageTransport` + injectable for tests → Task 1. ✓
- Environment transport selection → Task 2. ✓
- `app/extension/` UI host (esbuild, not in `adapters/`) → Tasks 6,7. ✓
- Build wiring (stable names, CSP/nonce, webview URIs) → Tasks 3,4,7. ✓
- Initial-state race (`ready` handshake) → Task 1 (webview side) + Task 7 (host side). ✓
- Error handling (absent/malformed/dispose) → `readStateText`/`parseStateEvent`/`onDidDispose` in Tasks 5,1,7. ✓
- Testing (bun units for transport/html/read; manual EDH) → Tasks 1,4,5,7,8. ✓
- Non-goals (no reskin, no realm/anim, no core change) → respected; renderer/core untouched. ✓

**2. Placeholder scan:** no TBD/TODO; every code step has full code; commands have expected output. ✓

**3. Type consistency:** `ITransport`, `parseStateEvent`, `IVsCodeApi`, `postMessageTransport(api, target)`, `selectTransport(win)`, `buildWebviewHtml(IBuildWebviewHtmlArgs)`, `readStateText(home)`, `watchState(home, onJson)`, message shapes `{type:"state",json}` / `{type:"ready"}` — names/signatures match across tasks. ✓
