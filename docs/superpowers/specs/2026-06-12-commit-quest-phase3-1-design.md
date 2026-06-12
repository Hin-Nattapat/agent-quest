# Commit Quest — Phase 3.1 Design (live progression HUD web view)

> First slice of Phase 3 (companion app, design §10). Phases 0–2 produced `state.json` (the pure
> reducer's output). 3.1 puts a **live, visual progression HUD** on top of it: a React + Vite app
> fed by a Bun **SSE bridge** that watches `state.json`, viewable in VS Code's **Simple Browser**.
> It proves data flows `state.json → React UI` in realtime and lays the **transport seam** that the
> Phase 3.3 VS Code extension reuses unchanged. Conventions: `CLAUDE.md` (the `app/` workspace
> relaxes the "jq+bun only" rule; `core/adapter/hud` stay untouched).

---

## 1. What 3.1 proves

When XP/level/class/title change (from real CC activity or a `rpg` command → reducer → `state.json`),
a browser view updates **live** — an animated XP bar, the class badge, the equipped title, level,
streak, and achievement count. No character sprite yet (that is 3.2). The renderer is **transport-
agnostic**, so 3.3 swaps the SSE feed for the extension's `postMessage` with zero renderer changes.

## 2. Locked decisions (brainstorm 2026-06-12)

| # | Topic | Decision |
|---|---|---|
| F1 | Final target | A **VS Code extension panel** (Phase 3.3). 3.1 builds the renderer + transport seam first in a browser (faster iteration; same bundle later embeds in the webview). |
| F2 | Stack | **React 19 + Vite + TypeScript + Canvas 2D** (Canvas arrives in 3.2). Chosen for reviewability/familiarity over a vanilla/lean build. A **separate `app/` workspace**; npm deps live only there. |
| F3 | Renderer ownership | **Our own renderer** for a single global character (our model is one character; Pixel Agents is multi-character). **No fork** of Pixel Agents — its sprite art (MIT) may be borrowed in 3.2. |
| F4 | Transport | **SSE push** (`fs.watch(state.json)` → push) behind an `ITransport` seam, so 3.3 substitutes a `postMessage` transport. |
| F5 | 3.1 scope | The **progression HUD** only: name · class+icon · title · level · animated XP bar · streak · achievements count. Character/costume/loot visuals are 3.2. |
| F6 | Contract | The app imports `IState` **type-only** from `core/state.ts` — one source of truth, no runtime coupling to `core/`. |

## 3. Architecture

```
 state.json ──(fs.watch)──► app/server.ts (Bun) ──SSE /events──► ITransport ──► React renderer ──► DOM
   (reducer output)            bridge: static dist + SSE          (sseTransport)   (useGameState → Hud)
```

- `core/adapter/hud` unchanged. The bridge is a **read-only consumer** of `state.json` (like the
  statusline) — it never runs the reducer or writes state.
- **A (3.1):** `app/server.ts` serves the Vite-built bundle and the SSE endpoint; open its URL in
  Simple Browser.
- **B (3.3):** the same React bundle loads in a webview; a `postMessageTransport` replaces
  `sseTransport`. Nothing else in the renderer changes.

## 4. The transport seam (`app/src/transport.ts`)

```ts
import type { IState } from "../../core/state";

export interface ITransport {
  // Calls onState with the latest state immediately-ish, then on every change.
  // Returns an unsubscribe function.
  subscribe(onState: (state: IState) => void): () => void;
}

// Parses one SSE "state" payload; null on malformed JSON (the UI keeps the last good state).
export function parseStateEvent(data: string): IState | null { … }

// Default transport for the browser (A). EventSource ctor injectable for tests.
export function sseTransport(url: string, makeSource = (u: string) => new EventSource(u)): ITransport { … }
```

`parseStateEvent` and the subscribe/unsubscribe bookkeeping are pure and unit-tested; the live
`EventSource` is exercised via an injected fake.

## 5. The bridge (`app/server.ts`, Bun)

- `readState(home)` — parse `$AGENTRPG_HOME/state.json`; returns `null` if missing/unreadable (pure,
  tested).
- `sseMessage(stateJson)` — format `event: state\ndata: <json>\n\n` (pure, tested).
- `Bun.serve({ port: AGENTRPG_PORT ?? 7070 })`:
  - `GET /events` → an SSE stream: push the current state on connect, then push again on each
    `fs.watch(statePath)` change (debounced ~50 ms; multiple clients tracked in a `Set` of
    controllers).
  - any other path → serve `app/dist` static files (prod). In dev, Vite serves the app and proxies
    `/events` to this bridge (so the app always calls `/events`).

## 6. React renderer (`app/src/`)

- `useGameState(transport): IState | null` — subscribes on mount, unsubscribes on unmount, keeps the
  last good state.
- `view.ts` — pure helpers, unit-tested: `xpPercent(state)` (0–100, `MAX` at cap), `displayName`,
  `titleSuffix`, `classLabel(state)` (icon + form, `Novice` fallback), `streakText`.
- Components: `App.tsx` → `Hud.tsx` composing `XpBar.tsx` (width via CSS transition → smooth fill;
  a brief pulse when `level` increases), `ClassBadge.tsx`, `TitleTag.tsx`, `StreakBadge.tsx`,
  `AchievementCount.tsx`. Styling in `styles.css` (no UI framework).
- `main.tsx` wires `sseTransport("/events")` into `<App>`.

## 7. Workspace layout

```
app/
  package.json        deps: react, react-dom · devDeps: vite, @vitejs/plugin-react, typescript, @types/react, @types/react-dom
  tsconfig.json       jsx: react-jsx; references ../core for the IState type
  vite.config.ts      react plugin; dev proxy /events → http://localhost:7070
  index.html
  server.ts           Bun bridge (static dist + SSE)
  src/{main.tsx, App.tsx, transport.ts, useGameState.ts, view.ts, styles.css, components/*}
```

Root `tsconfig.json` **excludes** `app/` (it has JSX + its own config); `bunx tsc --noEmit` keeps
covering `core/hud/tools/test`. The app type-checks via `tsc -p app` / `vite build`.

## 8. Testing

TDD the data path in `bun test` (no DOM needed); verify the React presentation visually (it is a UI):

- **`app/transport.test.ts`** — `parseStateEvent` parses a valid `IState`, returns `null` on garbage;
  `sseTransport` with a **fake EventSource** delivers parsed state to `onState` and stops after
  unsubscribe.
- **`app/server.test.ts`** — `readState` parses a seeded `state.json`, returns `null` when absent;
  `sseMessage` emits a well-formed `event: state\ndata: …\n\n` frame.
- **`app/view.test.ts`** — `xpPercent` (0, mid, `MAX` at cap), `classLabel`/`titleSuffix`/`streakText`
  for Novice, a classed character, and an equipped title.
- **Manual (UI):** `vite build` → `bun app/server.ts`; open the URL in Simple Browser; run a `rpg`
  command (or real CC activity) and watch the XP bar / level / title update live.

React component unit tests (testing-library + happy-dom) are deferred to 3.2, when the visual surface
grows; 3.1's logic is fully covered above and the presentation is small and visually verified.

## 9. Definition of done

1. `bun test` green (incl. the new `app/*.test.ts`); `bunx tsc --noEmit` clean for the root;
   `tsc -p app` clean; `bun run format:check` clean.
2. `bun app/server.ts` serves the built app and an SSE feed; the page shows the current `state.json`
   as a styled HUD.
3. Editing state (a `rpg name`/`class`/`title`, or real activity) updates the browser HUD **live**
   (XP bar animates, level/title/streak reflect the new state) without a reload.
4. The renderer consumes only `ITransport` — no SSE/`EventSource` reference outside `transport.ts` —
   so 3.3 can substitute `postMessage`.

## 10. Out of scope (→ later)

- **3.2:** character sprite + costume by class tier, loot as room/furniture, level-up burst, Canvas.
- **3.3:** the VS Code **extension** — host-side `state.json` watcher → `postMessageTransport`, webview
  packaging, the panel contribution (the final target).
- model/cost/ctx tail in the web HUD; multi-character; leaderboard (Phase 4).
