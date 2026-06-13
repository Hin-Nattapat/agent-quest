# Phase 3.3 (pulled forward) — VS Code Companion Panel (minimal shell)

> **Status:** design approved 2026-06-13. Implementation plan: `docs/superpowers/plans/`.
> **Reorder note:** 3.3 (VS Code panel — originally the *final* target) is pulled ahead of the
> pixel-MMORPG UI reskin / realm / animation work. Rationale: the panel is the **real
> container**; its actual dimensions in VS Code are what we measure the canvas-sizing decision
> against, instead of guessing from a browser.

## Goal

Render the **existing** Commit Quest companion (current plain HUD renderer, unchanged) inside a
VS Code webview panel, fed live by `~/.agentrpg/state.json` through a `postMessage` transport.
This gives a real, resizable container to (a) evaluate canvas/world sizing for the upcoming pixel
reskin and (b) prove the transport seam (SSE → postMessage) end-to-end.

## Non-goals (explicitly deferred)

- **No pixel-MMORPG UI reskin.** The renderer is hosted as-is. The reskin + canvas-sizing
  decision (480×270 vs 320×180, tilemap, pixel panels) is the *next* checkpoint, informed by
  this panel.
- **No realm mapping / monster-approach / world-transition** (later checkpoints).
- **No new gameplay/`core` changes.** `core/`, `hud/`, `adapters/claude-code/` untouched.
- **No marketplace packaging.** Run via the Extension Development Host (F5). `.vsix` packaging
  is a later concern.

## Architecture & the seam

The extension is a **UI host** (reads `state.json`, renders) — it is **not agent-aware**, so per
CLAUDE.md §1 it must **not** live in `adapters/` (which is agent-aware only). It lives in the
companion domain `app/`, alongside the existing browser host (`server.ts` + SSE). `app/` now has
**two hosts feeding one renderer** through `ITransport`:

```
                                  ┌─ browser host:  app/server.ts ── SSE /events ──┐
reducer → ~/.agentrpg/state.json ─┤                                                ├→ renderer (unchanged)
                                  └─ VS Code host:  app/extension/ ── postMessage ─┘     via ITransport
```

The renderer (`SceneView`, `hud`, hooks, `view.ts`) and `core/` are **100% unchanged**. Only the
transport selection (`main.tsx`) and a new transport implementation are added on the `app/` side.

## File structure

```
app/
  server.ts                 # (unchanged) browser host · SSE
  src/
    transport.ts            # + postMessageTransport(...)  ← new export
    main.tsx                # ~ pick transport by environment
    …renderer…              # unchanged
  extension/                # ← NEW · VS Code UI host (own npm package, esbuild)
    package.json            #   manifest: contributes.commands, main, engines.vscode; devDeps esbuild/@types/vscode/typescript
    tsconfig.json
    esbuild.mjs             #   bundle src/extension.ts → dist/extension.js (cjs, external: vscode)
    src/
      extension.ts          #   activate(): register command → create/reveal singleton WebviewPanel (ViewColumn.Beside)
      webview-html.ts       #   buildWebviewHtml({scriptUri,styleUri,cspSource,nonce}) → string  (pure)
      state-feed.ts         #   watchState(home, onJson): fs.watch + debounce + readState → callback; returns dispose
```

### Unit responsibilities

| Unit | Responsibility | Depends on | Tested |
|---|---|---|---|
| `transport.ts` `postMessageTransport` | subscribe to incoming `{type:'state', json}` messages → `IState`; post `{type:'ready'}` on subscribe | injected message target + vscode api handle | unit (bun) |
| `main.tsx` | choose `postMessageTransport` if `window.acquireVsCodeApi` exists, else `sseTransport("/events")` | transport.ts | trivial |
| `webview-html.ts` | build the panel HTML with webview URIs + CSP + nonce | nothing (pure string) | unit (bun) |
| `state-feed.ts` | watch home dir, debounce 50ms, read `state.json`, emit raw JSON | node `fs`; reuse `readState` shape from `server.ts` | manual (EDH) |
| `extension.ts` | command + panel lifecycle glue; wire state-feed ↔ panel; dispose watcher on panel close | vscode API | manual (EDH) |

## Data flow & initial-state race

```
host:   fs.watch(HOME) ─filter state.json─ debounce 50ms ─ readState ─ panel.webview.postMessage({type:'state', json})
webview: window 'message' ─ postMessageTransport ─ parseStateEvent(json) ─ onState ─ useGameState ─ SceneView
```

The reducer writes atomically (tmp + rename), so watching the **dir** (not the file) survives the
swap — same approach as `server.ts`.

**Race:** the panel HTML may mount *after* the host's first push. Fix: on subscribe, the webview
posts `{type:'ready'}` back via `acquireVsCodeApi().postMessage`; the host, on receiving `ready`,
(re)sends the current state. This mirrors how the SSE transport receives initial state on connect.
`acquireVsCodeApi()` may only be called **once** per webview — call it once at `main.tsx` module
top and pass the handle into the transport.

## Build wiring (the fiddly part — decided)

VS Code webviews cannot load assets by absolute path; every asset URI must come from
`webview.asWebviewUri`. To avoid parsing Vite's hashed output:

1. `app/vite.config.ts` → set `base: "./"` and pin **stable output names** via
   `build.rollupOptions.output` → `assets/app.js`, `assets/app.css` (no content hash). The browser
   host (`server.ts`) serves these fine too; the SSE dev path is unaffected.
2. `webview-html.ts` hand-builds the HTML referencing those two files through `asWebviewUri`, with
   a strict CSP: `default-src 'none'; img-src ${cspSource} data:; style-src ${cspSource};
   script-src 'nonce-<nonce>';` and the `<script>` carrying the nonce.
3. The extension references `app/dist/`. Its `build` runs the app build first, then esbuilds the
   extension: `"build": "cd .. && vite build && cd extension && node esbuild.mjs"` (or equivalent).
   `vscode` is marked `external` in esbuild (provided by the host).

## Error handling

- `state.json` absent → host posts nothing; webview keeps showing the existing `Connecting…`
  state until the first push (same as SSE).
- malformed JSON → `parseStateEvent` returns `null` → keep last good state (existing behavior).
- panel disposed → `state-feed` dispose() stops the watcher (no leak). Re-running the command
  reveals the existing panel or recreates it (singleton).
- CSP blocks anything not nonce'd / not from `cspSource` — no inline scripts, no remote origins.

## Testing

- **`postMessageTransport`** (bun): inject a fake `EventTarget` as the message target and a fake
  vscode-api stub. `subscribe(onState)` → dispatch a `message` event `{data:{type:'state',
  json}}` → assert `onState` called with the parsed `IState`; malformed json → not called;
  assert `{type:'ready'}` posted on subscribe; unsubscribe removes the listener. (Same
  injection style as `sseTransport`'s `makeSource`.)
- **`webview-html.ts`** (bun): assert the returned HTML contains both webview URIs, the nonce on
  the script tag, and the CSP meta — and that it contains no bare `http(s)://` script origins.
- **`state-feed` / `extension`**: VS Code API surface — verified manually in the Extension
  Development Host (F5): run *"Commit Quest: Open Companion"*, panel opens beside the editor,
  HUD shows live state, the XP bar moves as the journal updates, resizing the panel lets us
  judge canvas sizing for the next checkpoint.

## What this unblocks (next checkpoints, not in scope here)

1. **Canvas sizing decision** — measured in the real panel (480×270 vs 320×180 vs 384×216; tile
   16px; sprite 48×48 / boss 64×64 per `art-prompts.md §1`).
2. **Pixel-MMORPG UI reskin** — tilemap world, portrait/status frame, pixel panels, pixel font,
   side menu, bottom status tray (AFK has no skill bar → status tray). Reference: retro 2D MMO.
3. **T4 realm mapping** — `sceneFor(tier, line, branch)` → 13 realms (`art-prompts.md §7`).
4. **Monster-approach walk** and **up-class world-transition** animations.
