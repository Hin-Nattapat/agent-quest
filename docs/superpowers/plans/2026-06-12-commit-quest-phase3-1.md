# Commit Quest Phase 3.1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A live progression HUD — a React + Vite app fed by a Bun SSE bridge that watches `state.json`, viewable in VS Code's Simple Browser — built on a transport seam the Phase 3.3 extension reuses.

**Architecture:** New `app/` workspace (React 19 + Vite + TS), isolated from `core/adapter/hud`. A Bun `app/server.ts` watches `state.json` and pushes it over SSE; the React renderer consumes an `ITransport` (SSE now, `postMessage` in 3.3). Logic lives in pure helpers + a `useGameState` hook (TDD'd); React components are presentational (visually verified).

**Tech Stack:** React 19, Vite, TypeScript, Bun (bridge + tests). `core` stays jq+bun, dep-free.

**Reference:** Spec `docs/superpowers/specs/2026-06-12-commit-quest-phase3-1-design.md`. Repo conventions `CLAUDE.md`; **FE conventions** = the klang-web subset captured in `app/CLAUDE.md` (Task 1) — hook-driven React, component body order, derived-data discipline, string enums, kebab-case. End each commit body with `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. Run `bun run format` before committing. Branch: already on `feat/phase3.1-hud-webview`; spec committed.

---

## File Structure

```
app/
  CLAUDE.md            FE conventions (klang subset) for this workspace
  package.json         react, react-dom · devDeps: vite, @vitejs/plugin-react, typescript, @types/*
  tsconfig.json        jsx: react-jsx; covers src + server.ts
  vite.config.ts       react plugin; dev proxy /events → bun bridge :7070
  index.html
  server.ts            Bun bridge: watch state.json → SSE /events + serve dist  [readState, sseMessage tested]
  src/
    transport.ts       ITransport seam + parseStateEvent + sseTransport          [tested]
    view.ts            pure HUD helpers (xpPercent, classLabel, …)               [tested]
    use-game-state.ts  feature hook: subscribe to transport → IState | null
    app.tsx            composition only (useGameState → <Hud> / loading guard)
    main.tsx           wire sseTransport("/events") → <App>
    styles.css
    components/{hud,xp-bar,class-badge,title-tag,streak-badge,achievement-count}.tsx
  src/transport.test.ts · src/view.test.ts · server.test.ts   (run by root `bun test`)
```

Root `tsconfig.json` excludes `app/`; `.prettierignore` adds `app/dist` + `**/node_modules`.

---

## Task 1: scaffold the `app/` workspace + FE conventions

**Files:** Create `app/package.json`, `app/tsconfig.json`, `app/vite.config.ts`, `app/index.html`, `app/CLAUDE.md`; Modify root `tsconfig.json`, `.prettierignore`

- [ ] **Step 1: Create `app/package.json`**
```json
{
  "name": "commit-quest-app",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "serve": "bun server.ts",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@types/bun": "^1.1.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "typescript": "^5.6.0",
    "vite": "^6.0.0"
  }
}
```

- [ ] **Step 2: Create `app/tsconfig.json`**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "verbatimModuleSyntax": true
  },
  "include": ["src", "server.ts"]
}
```

- [ ] **Step 3: Create `app/vite.config.ts`**
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
  build: { outDir: "dist" },
});
```

- [ ] **Step 4: Create `app/index.html`**
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Commit Quest</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Create `app/CLAUDE.md`** (FE conventions for this workspace)
```markdown
# app/ — FE conventions

The React companion (Vite + React 19 + TS). A consumer of `state.json` via `ITransport`.
Adapted from the klang-web FE rules — only the parts that fit a small, read-only, single-view app.

## Layers
- **UI** in `src/components/` (presentational, props-in).
- **Logic** in hooks (`use-*.ts`) and pure helpers (`view.ts`). No business logic in components.
- **Data source** is `transport.ts` (the only place that knows about SSE / `EventSource`).
- `app.tsx` is **composition only** — a hook (or two) → guard → JSX.

## Components
- One component per file; functional; `export default`. Template:
  \`\`\`tsx
  interface IProps { state: IState; }
  const Hud = (props: IProps) => {
    const { state } = props;
    return <div className="hud">…</div>;
  };
  export default Hud;
  \`\`\`
- **Body order (never interleaved):** props/locals → hooks (`useX`) → `useState` → derived (`useMemo`) → `useEffect` → handlers → guards → JSX.
- Don't wrap a one-line element in a component. When *logic* bloats a component, extract a hook, not another component.

## Hooks & derived data
- Feature hook: `use-<x>.ts`, exports `useX`. `useEffect` is only for syncing with the outside world (e.g. subscribing to the transport) — not a generic "re-run on change".
- Anything derived from state is a module-level pure helper (`view.ts`) or a `useMemo` — never recomputed inline in JSX.

## Types & naming
- `interface I*` for shapes; `type T*` for unions/aliases. **String enums, never bare string-literal unions.**
- kebab-case file names. Import the shared `IState` **type-only** from `../../core/state` — never duplicate it, never import runtime `core` code.
```

- [ ] **Step 6: Exclude `app/` from the root typecheck + Prettier dist**

In the root `tsconfig.json`, add `app` to `exclude` (create the array if absent):
```json
  "exclude": ["node_modules", "app"]
```
Append to `.prettierignore`:
```
app/dist
**/node_modules
```

- [ ] **Step 7: Install app deps**

Run: `cd app && bun install`
Expected: installs react + vite toolchain into `app/node_modules`; exits 0.

- [ ] **Step 8: Commit**
```bash
cd /Users/calypso/Project/Ottery/commit-quest
bun run format
git add app/package.json app/tsconfig.json app/vite.config.ts app/index.html app/CLAUDE.md app/bun.lock tsconfig.json .prettierignore
git commit -m "chore(app): scaffold React+Vite workspace + FE conventions"
```

---

## Task 2: transport seam (`app/src/transport.ts`)

**Files:** Create `app/src/transport.ts`, `app/src/transport.test.ts`

- [ ] **Step 1: Write the failing test**

Create `app/src/transport.test.ts`:
```ts
import { test, expect } from "bun:test";
import { parseStateEvent, sseTransport } from "./transport";

const sample = {
  version: 1,
  xp_total: 100,
  level: 5,
  xp_in_level: 40,
  xp_to_next: 60,
  stats: { prompts: 0, actions: {}, sessions: 0, by_source: {}, by_repo: {} },
};

class FakeSource {
  listeners: Record<string, (e: { data: string }) => void> = {};
  closed = false;
  addEventListener(type: string, cb: (e: { data: string }) => void) {
    this.listeners[type] = cb;
  }
  close() {
    this.closed = true;
  }
  emit(type: string, data: string) {
    this.listeners[type]?.({ data });
  }
}

test("parseStateEvent parses valid state, returns null on garbage", () => {
  expect(parseStateEvent(JSON.stringify(sample))?.level).toBe(5);
  expect(parseStateEvent("{not json")).toBe(null);
});

test("sseTransport delivers parsed state and stops on unsubscribe", () => {
  const fake = new FakeSource();
  const transport = sseTransport("/events", () => fake as unknown as EventSource);
  const seen: number[] = [];
  const unsubscribe = transport.subscribe(s => seen.push(s.level));

  fake.emit("state", JSON.stringify(sample));
  fake.emit("state", JSON.stringify({ ...sample, level: 6 }));
  expect(seen).toEqual([5, 6]);

  unsubscribe();
  expect(fake.closed).toBe(true);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun test app/src/transport.test.ts`
Expected: FAIL — `transport` module not found.

- [ ] **Step 3: Create `app/src/transport.ts`**
```ts
import type { IState } from "../../core/state";

export interface ITransport {
  // Calls onState with the latest state, then on every change. Returns an unsubscribe fn.
  subscribe(onState: (state: IState) => void): () => void;
}

// Parse one SSE "state" payload; null on malformed JSON (the UI keeps the last good state).
export function parseStateEvent(data: string): IState | null {
  try {
    return JSON.parse(data) as IState;
  } catch {
    return null;
  }
}

type TMakeSource = (url: string) => EventSource;

export function sseTransport(
  url: string,
  makeSource: TMakeSource = u => new EventSource(u),
): ITransport {
  return {
    subscribe(onState) {
      const source = makeSource(url);
      source.addEventListener("state", event => {
        const state = parseStateEvent((event as MessageEvent).data);
        if (state) {
          onState(state);
        }
      });
      return () => source.close();
    },
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `bun test app/src/transport.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
bun run format
git add app/src/transport.ts app/src/transport.test.ts
git commit -m "feat(app): ITransport seam + SSE transport"
```

---

## Task 3: the bridge (`app/server.ts`)

**Files:** Create `app/server.ts`, `app/server.test.ts`

- [ ] **Step 1: Write the failing test**

Create `app/server.test.ts`:
```ts
import { test, expect } from "bun:test";
import { mkdtempSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { readState, sseMessage } from "./server";

function tmpHome(): string {
  return mkdtempSync(join(tmpdir(), "cq-app-"));
}

test("readState returns the file text, or null when absent", () => {
  const home = tmpHome();
  expect(readState(home)).toBe(null);
  writeFileSync(join(home, "state.json"), '{"level":7}');
  expect(readState(home)).toBe('{"level":7}');
  rmSync(home, { recursive: true, force: true });
});

test("sseMessage frames a state event", () => {
  expect(sseMessage('{"level":7}')).toBe('event: state\ndata: {"level":7}\n\n');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun test app/server.test.ts`
Expected: FAIL — `server` module not found.

- [ ] **Step 3: Create `app/server.ts`**
```ts
import { existsSync, readFileSync, watch } from "fs";
import { join } from "path";
import { homedir } from "os";

const HOME = process.env.AGENTRPG_HOME || join(homedir(), ".agentrpg");
const PORT = Number(process.env.AGENTRPG_PORT) || 7070;
const DIST = join(import.meta.dir, "dist");

// Raw state.json text (atomic writes from the reducer mean reads are never partial); null if absent.
export function readState(home: string): string | null {
  const path = join(home, "state.json");
  if (!existsSync(path)) {
    return null;
  }
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

export function sseMessage(stateJson: string): string {
  return `event: state\ndata: ${stateJson}\n\n`;
}

if (import.meta.main) {
  const encoder = new TextEncoder();
  const clients = new Set<ReadableStreamDefaultController<Uint8Array>>();

  const pushAll = () => {
    const text = readState(HOME);
    if (!text) {
      return;
    }
    const frame = encoder.encode(sseMessage(text));
    for (const controller of clients) {
      try {
        controller.enqueue(frame);
      } catch {
        clients.delete(controller);
      }
    }
  };

  // Watch the home dir (survives the reducer's tmp+rename swap) and debounce.
  let timer: ReturnType<typeof setTimeout> | null = null;
  watch(HOME, (_event, filename) => {
    if (filename !== "state.json") {
      return;
    }
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(pushAll, 50);
  });

  Bun.serve({
    port: PORT,
    async fetch(req) {
      const url = new URL(req.url);
      if (url.pathname === "/events") {
        let self: ReadableStreamDefaultController<Uint8Array>;
        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            self = controller;
            clients.add(controller);
            const text = readState(HOME);
            if (text) {
              controller.enqueue(encoder.encode(sseMessage(text)));
            }
          },
          cancel() {
            clients.delete(self);
          },
        });
        return new Response(stream, {
          headers: {
            "content-type": "text/event-stream",
            "cache-control": "no-cache",
            connection: "keep-alive",
          },
        });
      }
      const rel = url.pathname === "/" ? "/index.html" : url.pathname;
      const file = Bun.file(join(DIST, rel));
      if (await file.exists()) {
        return new Response(file);
      }
      return new Response(Bun.file(join(DIST, "index.html"))); // SPA fallback
    },
  });
  console.log(`commit-quest app on http://localhost:${PORT}`);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `bun test app/server.test.ts`
Expected: PASS (only `readState`/`sseMessage` run; the `import.meta.main` block is skipped under test).

- [ ] **Step 5: Commit**
```bash
bun run format
git add app/server.ts app/server.test.ts
git commit -m "feat(app): Bun SSE bridge watching state.json"
```

---

## Task 4: view helpers (`app/src/view.ts`)

**Files:** Create `app/src/view.ts`, `app/src/view.test.ts`

- [ ] **Step 1: Write the failing test**

Create `app/src/view.test.ts`:
```ts
import { test, expect } from "bun:test";
import { xpPercent, displayName, classLabel, titleSuffix, streakText } from "./view";

const base = {
  version: 1,
  xp_total: 0,
  level: 1,
  xp_in_level: 0,
  xp_to_next: 100,
  stats: { prompts: 0, actions: {}, sessions: 0, by_source: {}, by_repo: {} },
} as any;

test("xpPercent: 0, mid, and MAX at cap", () => {
  expect(xpPercent(base)).toBe(0);
  expect(xpPercent({ ...base, xp_in_level: 40, xp_to_next: 60 })).toBe(40);
  expect(xpPercent({ ...base, xp_in_level: 1000, xp_to_next: 0 })).toBe(100);
});

test("name / class / title / streak text", () => {
  expect(displayName(base)).toBe("Adventurer");
  expect(displayName({ ...base, name: "Calypso" })).toBe("Calypso");
  expect(classLabel(base)).toBe("Novice");
  expect(classLabel({ ...base, class: { line: "mage", icon: "⚔", form: "Server Sorcerer" } })).toBe(
    "⚔ Server Sorcerer",
  );
  expect(titleSuffix(base)).toBe("");
  expect(titleSuffix({ ...base, cosmetics: { title: "the Undying", theme_color: null } })).toBe(
    " the Undying",
  );
  expect(streakText(base)).toBe("");
  expect(streakText({ ...base, streak: { current_days: 3, best_days: 3, last_active: "" } })).toBe(
    "🔥 3d",
  );
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun test app/src/view.test.ts`
Expected: FAIL — `view` module not found.

- [ ] **Step 3: Create `app/src/view.ts`**
```ts
import type { IState } from "../../core/state";

export function xpPercent(state: IState): number {
  if (state.xp_to_next <= 0) {
    return 100; // MAX at the level cap
  }
  const span = state.xp_in_level + state.xp_to_next;
  return Math.round((state.xp_in_level / span) * 100);
}

export function displayName(state: IState): string {
  return state.name ?? "Adventurer";
}

export function classLabel(state: IState): string {
  const klass = state.class;
  if (!klass || !klass.line) {
    return "Novice";
  }
  return `${klass.icon} ${klass.form}`.trim();
}

export function titleSuffix(state: IState): string {
  const title = state.cosmetics?.title;
  return title ? ` the ${title}` : "";
}

export function streakText(state: IState): string {
  const days = state.streak?.current_days ?? 0;
  return days > 0 ? `🔥 ${days}d` : "";
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `bun test app/src/view.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
bun run format
git add app/src/view.ts app/src/view.test.ts
git commit -m "feat(app): pure HUD view helpers"
```

---

## Task 5: the React HUD (hook + components)

**Files:** Create `app/src/use-game-state.ts`, `app/src/components/{xp-bar,class-badge,title-tag,streak-badge,achievement-count,hud}.tsx`, `app/src/app.tsx`, `app/src/main.tsx`, `app/src/styles.css`

> Presentational React — verified visually in Task 6 (the testable logic is already covered in Tasks 2–4). Follow `app/CLAUDE.md`: hook-driven, component body order, props-in.

- [ ] **Step 1: Create the feature hook `app/src/use-game-state.ts`**
```ts
import { useEffect, useState } from "react";
import type { IState } from "../../core/state";
import type { ITransport } from "./transport";

// Subscribes to the transport (the only outside-world sync) and exposes the latest state.
export function useGameState(transport: ITransport): IState | null {
  const [state, setState] = useState<IState | null>(null);

  useEffect(() => {
    const unsubscribe = transport.subscribe(setState);
    return unsubscribe;
  }, [transport]);

  return state;
}
```

- [ ] **Step 2: Create the leaf components**

`app/src/components/xp-bar.tsx`:
```tsx
import type { IState } from "../../../core/state";
import { xpPercent } from "../view";

interface IProps {
  state: IState;
}

const XpBar = (props: IProps) => {
  const { state } = props;
  const pct = xpPercent(state);
  const atMax = state.xp_to_next <= 0;

  return (
    <div className="xp-bar" role="progressbar" aria-valuenow={pct}>
      <div className="xp-bar-fill" style={{ width: `${pct}%` }} />
      <span className="xp-bar-label">{atMax ? "MAX" : `${pct}%`}</span>
    </div>
  );
};

export default XpBar;
```

`app/src/components/class-badge.tsx`:
```tsx
import type { IState } from "../../../core/state";
import { classLabel } from "../view";

interface IProps {
  state: IState;
}

const ClassBadge = (props: IProps) => {
  const { state } = props;
  return <span className="class-badge">{classLabel(state)}</span>;
};

export default ClassBadge;
```

`app/src/components/title-tag.tsx`:
```tsx
import type { IState } from "../../../core/state";
import { displayName, titleSuffix } from "../view";

interface IProps {
  state: IState;
}

const TitleTag = (props: IProps) => {
  const { state } = props;
  return (
    <span className="title-tag">
      {displayName(state)}
      {titleSuffix(state)}
    </span>
  );
};

export default TitleTag;
```

`app/src/components/streak-badge.tsx`:
```tsx
import type { IState } from "../../../core/state";
import { streakText } from "../view";

interface IProps {
  state: IState;
}

const StreakBadge = (props: IProps) => {
  const { state } = props;
  const text = streakText(state);
  if (!text) {
    return null;
  }
  return <span className="streak-badge">{text}</span>;
};

export default StreakBadge;
```

`app/src/components/achievement-count.tsx`:
```tsx
import type { IState } from "../../../core/state";

interface IProps {
  state: IState;
}

const AchievementCount = (props: IProps) => {
  const { state } = props;
  const earned = state.achievements?.earned.length ?? 0;
  const points = state.achievements?.points ?? 0;
  return (
    <span className="achievement-count">
      🏆 {earned} ({points} pts)
    </span>
  );
};

export default AchievementCount;
```

- [ ] **Step 3: Create the `Hud` composition `app/src/components/hud.tsx`**
```tsx
import type { IState } from "../../../core/state";
import TitleTag from "./title-tag";
import ClassBadge from "./class-badge";
import XpBar from "./xp-bar";
import StreakBadge from "./streak-badge";
import AchievementCount from "./achievement-count";

interface IProps {
  state: IState;
}

const Hud = (props: IProps) => {
  const { state } = props;

  return (
    <div className="hud">
      <header className="hud-head">
        <TitleTag state={state} />
        <ClassBadge state={state} />
      </header>
      <div className="hud-level">Lv.{state.level}</div>
      <XpBar state={state} />
      <footer className="hud-meta">
        <StreakBadge state={state} />
        <AchievementCount state={state} />
      </footer>
    </div>
  );
};

export default Hud;
```

- [ ] **Step 4: Create `app/src/app.tsx`** (composition + loading guard)
```tsx
import type { ITransport } from "./transport";
import { useGameState } from "./use-game-state";
import Hud from "./components/hud";

interface IProps {
  transport: ITransport;
}

const App = (props: IProps) => {
  const { transport } = props;
  const state = useGameState(transport);

  if (!state) {
    return <div className="loading">Connecting…</div>;
  }

  return <Hud state={state} />;
};

export default App;
```

- [ ] **Step 5: Create `app/src/main.tsx`** (wire the SSE transport)
```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./app";
import { sseTransport } from "./transport";
import "./styles.css";

const transport = sseTransport("/events");
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App transport={transport} />
  </StrictMode>,
);
```

- [ ] **Step 6: Create `app/src/styles.css`**
```css
:root {
  color-scheme: dark;
  --bg: #14161b;
  --panel: #1d212b;
  --fill: #4cc2ff;
  --text: #e6e6e6;
  --muted: #8b93a3;
}
* {
  box-sizing: border-box;
}
body {
  margin: 0;
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  background: var(--bg);
  color: var(--text);
  display: grid;
  place-items: center;
  min-height: 100vh;
}
.hud {
  width: min(520px, 92vw);
  background: var(--panel);
  border-radius: 14px;
  padding: 20px 24px;
  display: grid;
  gap: 12px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.35);
}
.hud-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
}
.title-tag {
  font-size: 1.4rem;
  font-weight: 600;
}
.class-badge {
  color: var(--muted);
}
.hud-level {
  font-size: 0.95rem;
  color: var(--muted);
}
.xp-bar {
  position: relative;
  height: 22px;
  background: #0e1015;
  border-radius: 11px;
  overflow: hidden;
}
.xp-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #2f86c5, var(--fill));
  transition: width 600ms ease;
}
.xp-bar-label {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  font-size: 0.8rem;
}
.hud-meta {
  display: flex;
  justify-content: space-between;
  color: var(--muted);
  font-size: 0.9rem;
}
.loading {
  color: var(--muted);
  font-family: ui-monospace, monospace;
}
```

- [ ] **Step 7: Commit**
```bash
cd /Users/calypso/Project/Ottery/commit-quest
bun run format
git add app/src/use-game-state.ts app/src/components app/src/app.tsx app/src/main.tsx app/src/styles.css
git commit -m "feat(app): live progression HUD (useGameState + components)"
```

---

## Task 6: verify — tests, types, build, and a live run

- [ ] **Step 1: Logic tests + root typecheck + format**

Run: `bun test && bunx tsc --noEmit && bun run format:check`
Expected: all tests pass (core + `app/*.test.ts`); root tsc clean (app excluded); formatting clean.

- [ ] **Step 2: App typecheck + build**

Run: `cd app && bun run typecheck && bun run build`
Expected: no type errors; `app/dist/` produced.

- [ ] **Step 3: Live run in Simple Browser**

Run the bridge: `cd app && AGENTRPG_HOME="$HOME/.agentrpg" bun server.ts`
In VS Code: Command Palette → **Simple Browser: Show** → `http://localhost:7070`.
Expected: the HUD renders the current character (name + title, class, level, XP bar, streak, achievements).

- [ ] **Step 4: Confirm it updates live**

In another terminal: `bun ~/.agentrpg/tools/rpg.ts name <something>` (or just keep coding — real CC
activity re-reduces). 
Expected: the browser HUD updates within ~1s **without a reload** (the XP bar animates, the
name/level/title reflect the new `state.json`). Stop the bridge with Ctrl-C.

- [ ] **Step 5: Commit any formatting fixes** (if Step 1 changed files)
```bash
bun run format
git add -A app
git commit -m "chore(app): formatting" --allow-empty
```

---

## Task 7: docs + finish

- [ ] **Step 1: Document the `app/` box in the layout reference**

In `docs/reference/project-structure.md`, add an `app/` entry describing it as a Phase 3.1
consumer of `state.json` (Bun SSE bridge + React HUD, transport seam reused by the 3.3 extension).
Match the file's existing format.

- [ ] **Step 2: Commit**
```bash
git add docs/reference/project-structure.md
git commit -m "docs: add app/ companion workspace to the project structure"
```

- [ ] **Step 3: Finish the branch** — superpowers:finishing-a-development-branch (grouping commit +
push + PR, "Part of #<Phase 3 epic>"). Note in the PR that `app/` adds React/Vite **only inside the
workspace** — `core/adapter/hud/tools` stay jq+bun and `install.sh` is unaffected.

---

## Self-Review notes (already applied)

- **Spec coverage:** workspace + stack §2/§7 (Task 1); transport seam §4 (Task 2); bridge §5 (Task 3);
  view helpers §6 (Task 4); `useGameState` + HUD components §6 (Task 5); DoD §9 — tests/types/build +
  live update (Task 6); out-of-scope respected (no sprite/Canvas, no extension, no tail).
- **No placeholders:** every file's full contents are given; tests have real assertions; the live-update
  check has concrete commands.
- **Type/name consistency:** `ITransport`/`parseStateEvent`/`sseTransport`/`TMakeSource`, `readState`/
  `sseMessage`, `xpPercent`/`displayName`/`classLabel`/`titleSuffix`/`streakText`, `useGameState`,
  `IProps` per component. `IState` is imported **type-only** from `../../core/state` (src depth) and
  `../../../core/state` (components depth) — only the components use the deeper path, and they are not
  loaded by `bun test`, so no resolution surprises. `server.ts` imports no `core` (forwards raw JSON),
  keeping the bridge contract-light. `verbatimModuleSyntax` in app/tsconfig enforces the `import type`
  discipline so no runtime `core` code leaks into the bundle.
```
