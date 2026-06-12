# Commit Quest Phase 3.2a Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the HUD into an MMORPG AFK-farming scene — the hero farms while active, idles when quiet, rests after a session ends, and the scene/monster change by class tier — built as a CSS skeleton that accepts real sprites later.

**Architecture:** One small `core` change: the reducer records `last_event {ts,type}` in `state.json`. The app derives `activityState` (pure + a client timer) and `sceneFor(tier)` (pure), then renders a `SceneView` whose components are structure-only — `styles.css` owns every visual (placeholder now, PixelLab sprite-sheets later, by editing CSS alone).

**Tech Stack:** React 19 + Vite (app), Bun (core + tests). `core` stays jq+bun, dep-free.

**Reference:** Spec `docs/superpowers/specs/2026-06-12-commit-quest-phase3-2a-design.md`. Conventions `CLAUDE.md` + `app/CLAUDE.md` (hook-driven React, component body order, string enums, kebab-case). End each commit body with `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. Run `bun run format` before committing. Branch: already on `feat/phase3.2-character-costume`; spec committed.

---

## File Structure

| File | Change |
|---|---|
| `core/state.ts` | `last_event?: { ts: string; type: EventType }` |
| `core/reduce.ts` | set `last_event` from the latest `ts`-sorted event |
| `app/src/activity.ts` | `ActivityState` enum + `activityState()` (new) |
| `app/src/scene.ts` | `SceneTheme` + `sceneFor()` (new) |
| `app/src/use-activity.ts` | `useActivity(state)` hook + client timer (new) |
| `app/src/components/{scene-view,hero,monster}.tsx` | the scene (new) |
| `app/src/app.tsx` | render `<SceneView>` instead of `<Hud>` |
| `app/src/styles.css` | the art surface: scene/hero/monster placeholders + animations |
| `app/CLAUDE.md` | note the events contract may be imported at runtime |

---

## Task 1: `core` — record `last_event`

**Files:** Modify `core/state.ts`, `core/reduce.ts`; Test `test/core/reduce.test.ts` (append)

- [ ] **Step 1: Add the field to `core/state.ts`**

Import `EventType` (type-only) and add the field to `IState` (after `unlocked_secret_classes`):
```ts
import type { EventType } from "./events";
```
```ts
  unlocked_secret_classes?: SecretLine[];
  last_event?: { ts: string; type: EventType };
```

- [ ] **Step 2: Write the failing test**

Append to `test/core/reduce.test.ts`:
```ts
test("last_event is the latest event by ts (or undefined when empty)", () => {
  const cfg = loadConfig(makeHome());
  const evs = [
    { ts: "2026-06-11T12:00:00Z", source: "claude-code", session_id: "s", type: "prompt", repo: "cq" },
    { ts: "2026-06-11T12:05:00Z", source: "claude-code", session_id: "s", type: "session_end", repo: "cq" },
    { ts: "2026-06-11T12:02:00Z", source: "claude-code", session_id: "s", type: "action", action: "run", repo: "cq" },
  ] as any;
  expect(reduce(evs, cfg, "2026-06-11").last_event).toEqual({
    ts: "2026-06-11T12:05:00Z",
    type: "session_end",
  });
  expect(reduce([], cfg, "2026-06-11").last_event).toBeUndefined();
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `bun test test/core/reduce.test.ts`
Expected: FAIL — `last_event` undefined for the populated case.

- [ ] **Step 4: Set `last_event` in `core/reduce.ts`**

Inside `reduce`, just after the `if (profile?.name) { prelim.name = profile.name; }` block, add:
```ts
  const lastEv = sorted[sorted.length - 1];
  if (lastEv) {
    prelim.last_event = { ts: lastEv.ts, type: lastEv.type };
  }
```
(`sorted` is the `ts`-sorted events array already built at the top of the fold.)

- [ ] **Step 5: Run to verify it passes**

Run: `bun test test/core/reduce.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**
```bash
bun run format
git add core/state.ts core/reduce.ts test/core/reduce.test.ts
git commit -m "feat(core): record last_event {ts,type} for the live activity signal"
```

---

## Task 2: `app/src/activity.ts` — the AFK state machine

**Files:** Create `app/src/activity.ts`, `app/src/activity.test.ts`

- [ ] **Step 1: Write the failing test**

Create `app/src/activity.test.ts`:
```ts
import { test, expect } from "bun:test";
import { activityState, ActivityState, ACTIVE_WINDOW_MS } from "./activity";

const NOW = Date.parse("2026-06-11T12:00:00Z");
const ev = (type: string, agoMs: number) =>
  ({ ts: new Date(NOW - agoMs).toISOString(), type }) as any;

test("activityState maps the last event + recency to a state", () => {
  expect(activityState(undefined, NOW)).toBe(ActivityState.Idle);
  expect(activityState(ev("action", 5_000), NOW)).toBe(ActivityState.Farming);
  expect(activityState(ev("action", 120_000), NOW)).toBe(ActivityState.Idle);
  expect(activityState(ev("session_end", 1_000), NOW)).toBe(ActivityState.Rest);
  expect(activityState(ev("session_end", 999_999), NOW)).toBe(ActivityState.Rest);
  expect(activityState(ev("session_start", 1_000), NOW)).toBe(ActivityState.Idle);
  // boundary: exactly the window is not "recent" -> idle
  expect(activityState(ev("action", ACTIVE_WINDOW_MS), NOW)).toBe(ActivityState.Idle);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun test app/src/activity.test.ts`
Expected: FAIL — `activity` module not found.

- [ ] **Step 3: Create `app/src/activity.ts`**
```ts
import { EventType } from "../../core/events";
import type { IState } from "../../core/state";

export enum ActivityState {
  Farming = "farming",
  Idle = "idle",
  Rest = "rest",
}

export const ACTIVE_WINDOW_MS = 60_000;

// `now` is wall-clock ms — kept in the app so the reducer stays time-free/idempotent.
export function activityState(
  lastEvent: IState["last_event"],
  now: number,
  windowMs = ACTIVE_WINDOW_MS,
): ActivityState {
  if (!lastEvent) {
    return ActivityState.Idle;
  }
  if (lastEvent.type === EventType.SessionEnd) {
    return ActivityState.Rest;
  }
  if (lastEvent.type === EventType.SessionStart) {
    return ActivityState.Idle; // opened the agent, not working yet
  }
  return now - Date.parse(lastEvent.ts) < windowMs
    ? ActivityState.Farming
    : ActivityState.Idle;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `bun test app/src/activity.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
bun run format
git add app/src/activity.ts app/src/activity.test.ts
git commit -m "feat(app): activityState — AFK farming/idle/rest from last_event"
```

---

## Task 3: `app/src/scene.ts` — tier → scene/monster

**Files:** Create `app/src/scene.ts`, `app/src/scene.test.ts`

- [ ] **Step 1: Write the failing test**

Create `app/src/scene.test.ts`:
```ts
import { test, expect } from "bun:test";
import { sceneFor, SceneTheme } from "./scene";

test("sceneFor maps tier to a theme + monster", () => {
  expect(sceneFor(0).theme).toBe(SceneTheme.Grassland);
  expect(sceneFor(1).theme).toBe(SceneTheme.Grassland);
  expect(sceneFor(2).theme).toBe(SceneTheme.Forest);
  expect(sceneFor(3).theme).toBe(SceneTheme.Dungeon);
  expect(sceneFor(4).theme).toBe(SceneTheme.SecretRealm);
  expect(sceneFor(5).theme).toBe(SceneTheme.SecretRealm);
  expect(sceneFor(2).monster).toBe("Error Wraith");
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun test app/src/scene.test.ts`
Expected: FAIL — `scene` module not found.

- [ ] **Step 3: Create `app/src/scene.ts`**
```ts
export enum SceneTheme {
  Grassland = "grassland",
  Forest = "forest",
  Dungeon = "dungeon",
  SecretRealm = "secret_realm",
}

export interface IScene {
  theme: SceneTheme;
  label: string;
  monster: string; // semantic name; the placeholder/sprite visual lives in styles.css
}

export function sceneFor(tier: number): IScene {
  if (tier >= 4) {
    return { theme: SceneTheme.SecretRealm, label: "Secret Realm", monster: "Realm King" };
  }
  if (tier === 3) {
    return { theme: SceneTheme.Dungeon, label: "The Deep Dungeon", monster: "Dungeon Brute" };
  }
  if (tier === 2) {
    return { theme: SceneTheme.Forest, label: "Whispering Forest", monster: "Error Wraith" };
  }
  return { theme: SceneTheme.Grassland, label: "Grassland outside town", monster: "Bug Slime" };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `bun test app/src/scene.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
bun run format
git add app/src/scene.ts app/src/scene.test.ts
git commit -m "feat(app): sceneFor — tier maps to scene theme + monster"
```

---

## Task 4: the AFK scene (hook + components + CSS skeleton)

**Files:** Create `app/src/use-activity.ts`, `app/src/components/{scene-view,hero,monster}.tsx`; Modify `app/src/app.tsx`, `app/src/styles.css`, `app/CLAUDE.md`

> Presentational + a timer hook — verified by build + visually (the logic is covered in Tasks 1–3).

- [ ] **Step 1: Create the hook `app/src/use-activity.ts`**
```ts
import { useEffect, useState } from "react";
import type { IState } from "../../core/state";
import { activityState, ActivityState } from "./activity";

const TICK_MS = 5000;

// Re-derives on a timer because, while idle, state.json doesn't change (no SSE push).
export function useActivity(state: IState | null): ActivityState {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, []);

  if (!state) {
    return ActivityState.Idle;
  }
  return activityState(state.last_event, now);
}
```

- [ ] **Step 2: Create `app/src/components/hero.tsx`** (structure only)
```tsx
import type { ActivityState } from "../activity";

interface IProps {
  line: string;
  activity: ActivityState;
}

const Hero = (props: IProps) => {
  const { line, activity } = props;
  return <div className={`sprite hero hero-${line} hero-${activity}`} aria-label="hero" />;
};

export default Hero;
```

- [ ] **Step 3: Create `app/src/components/monster.tsx`** (structure only)
```tsx
import type { IScene } from "../scene";

interface IProps {
  scene: IScene;
}

const Monster = (props: IProps) => {
  const { scene } = props;
  return <div className={`sprite monster monster-${scene.theme}`} aria-label={scene.monster} />;
};

export default Monster;
```

- [ ] **Step 4: Create `app/src/components/scene-view.tsx`**
```tsx
import type { IState } from "../../../core/state";
import { sceneFor } from "../scene";
import { ActivityState } from "../activity";
import Hero from "./hero";
import Monster from "./monster";
import Hud from "./hud";

interface IProps {
  state: IState;
  activity: ActivityState;
}

const SceneView = (props: IProps) => {
  const { state, activity } = props;
  const scene = sceneFor(state.class?.tier ?? 0);
  const line = state.class?.line ?? "novice";

  return (
    <div className={`scene scene-${scene.theme}`}>
      {activity !== ActivityState.Rest && <Monster scene={scene} />}
      <Hero line={line} activity={activity} />
      <div className="scene-hud">
        <Hud state={state} />
      </div>
    </div>
  );
};

export default SceneView;
```

- [ ] **Step 5: Wire `app/src/app.tsx`**

Replace the file with:
```tsx
import type { ITransport } from "./transport";
import { useGameState } from "./use-game-state";
import { useActivity } from "./use-activity";
import SceneView from "./components/scene-view";

interface IProps {
  transport: ITransport;
}

const App = (props: IProps) => {
  const { transport } = props;
  const state = useGameState(transport);
  const activity = useActivity(state);

  if (!state) {
    return <div className="loading">Connecting…</div>;
  }

  return <SceneView state={state} activity={activity} />;
};

export default App;
```

- [ ] **Step 6: Append the scene styles to `app/src/styles.css`** (the art swap surface)
```css

/* ── Phase 3.2a: AFK scene · CSS owns every visual (swap these for PixelLab sprites later) ── */
.scene {
  position: relative;
  width: min(560px, 94vw);
  height: 320px;
  border-radius: 14px;
  overflow: hidden;
  border: 2px solid #b08a3e;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.45);
}
.scene-grassland {
  background: linear-gradient(180deg, #2e4d23, #1a2c13);
}
.scene-forest {
  background: linear-gradient(180deg, #16331f, #0c1d12);
}
.scene-dungeon {
  background: linear-gradient(180deg, #2a2230, #141019);
}
.scene-secret_realm {
  background: linear-gradient(180deg, #3a2c54, #15102a);
}

/* sprite = swap surface: placeholder via ::after content -> replace with a background sprite-sheet */
.sprite {
  position: absolute;
  width: 64px;
  height: 64px;
  display: grid;
  place-items: center;
  font-size: 40px;
}
.hero {
  left: 38%;
  bottom: 18px;
}
.hero::after {
  content: "🧙";
}
.hero-farming {
  animation: hero-bob 0.5s steps(2) infinite;
}
.hero-idle {
  animation: hero-sway 2.4s ease-in-out infinite;
}
.hero-rest {
  opacity: 0.85;
}
.hero-rest::after {
  content: "🧙";
  filter: grayscale(0.4);
}
.monster {
  right: 16%;
  bottom: 22px;
  font-size: 34px;
}
.monster-grassland::after {
  content: "🟢";
}
.monster-forest::after {
  content: "👻";
}
.monster-dungeon::after {
  content: "👹";
}
.monster-secret_realm::after {
  content: "👑";
}
@keyframes hero-bob {
  from {
    transform: translateY(0);
  }
  to {
    transform: translateY(-6px);
  }
}
@keyframes hero-sway {
  0%,
  100% {
    transform: translateX(0);
  }
  50% {
    transform: translateX(4px);
  }
}

/* HUD as a top overlay on the scene */
.scene-hud {
  position: absolute;
  left: 10px;
  right: 10px;
  top: 10px;
}
.scene-hud .hud {
  width: auto;
  background: #1d212bdd;
  padding: 10px 14px;
}
```

- [ ] **Step 7: Note the events-contract import rule in `app/CLAUDE.md`**

Under the "Types & naming" section, append:
```markdown
- The **events contract** (`EventType` enum + types) from `core/events.ts` MAY be imported at runtime
  (it is the shared wire contract, like `IState`). Game logic — `reduce`, `classes`, etc. — may not.
```

- [ ] **Step 8: Typecheck + build the app**

Run: `cd app && bun run typecheck && bun run build`
Expected: no type errors; `app/dist/` rebuilt.

- [ ] **Step 9: Commit**
```bash
cd /Users/calypso/Project/Ottery/commit-quest
bun run format
git add app/src/use-activity.ts app/src/components/scene-view.tsx app/src/components/hero.tsx app/src/components/monster.tsx app/src/app.tsx app/src/styles.css app/CLAUDE.md
git commit -m "feat(app): AFK farming scene (useActivity + scene/hero/monster, CSS skeleton)"
```

---

## Task 5: verify — tests, types, build, and a live run

- [ ] **Step 1: Logic tests + root typecheck + format**

Run: `bun test && bunx tsc --noEmit && bun run format:check`
Expected: all pass (core + `app/*.test.ts`); root tsc clean (app excluded); formatting clean.

- [ ] **Step 2: App typecheck + build**

Run: `cd app && bun run typecheck && bun run build`
Expected: clean; `app/dist/` produced.

- [ ] **Step 3: Live run**

Run the bridge (pick a free port; 7077 worked earlier):
`cd app && AGENTRPG_HOME="$HOME/.agentrpg" AGENTRPG_PORT=7077 bun server.ts`
Open `http://localhost:7077` in Simple Browser.
Expected: a tier-themed scene (Calypso is a Mage → tier from level) with the hero + a monster and
the HUD overlay.

- [ ] **Step 4: Confirm the AFK states**

- While the agent is working, the hero **bobs (farming)**.
- Leave it ~60 s with no activity → the hero **sways (idle)**, monster still present.
- After a session ends (`on-session-end` fires) → the hero **rests** and the monster disappears.
- A class-tier change (`rpg respec` / leveling) swaps the **scene + monster**.
Stop the bridge with Ctrl-C.

- [ ] **Step 5: Commit any formatting fixes** (if Step 1 changed files)
```bash
bun run format
git add -A app
git commit -m "chore(app): formatting" --allow-empty
```

---

## Task 6: docs + finish

- [ ] **Step 1: Update the `app/` box in the layout reference**

In `docs/reference/project-structure.md`, update the `app/src/` listing to add `activity.ts`,
`scene.ts`, `use-activity.ts`, and `components/{scene-view,hero,monster}.tsx` (the AFK scene), and
note that the 3.2 line in the comment now covers the farming scene. Match the file's format.

- [ ] **Step 2: Commit**
```bash
git add docs/reference/project-structure.md
git commit -m "docs: app/ AFK scene files in the project structure"
```

- [ ] **Step 3: Finish the branch** — superpowers:finishing-a-development-branch (grouping commit +
push + PR, "Part of Phase 3"). Note in the PR that the only `core` change is `last_event`; the scene
is a CSS skeleton (placeholders swap for PixelLab sprites by editing CSS).

---

## Self-Review notes (already applied)

- **Spec coverage:** `last_event` §4 (Task 1); `activityState` incl. session_start→idle §4/G5 (Task 2);
  `sceneFor` §5 (Task 3); `useActivity` + scene components + CSS-skeleton §6/G7 + app wiring + the
  events-contract import note §4 (Task 4); DoD §9 — tests/types/build + live AFK states (Task 5);
  out-of-scope respected (no boss/loot/up-class/branch realms, no real sprites/Canvas).
- **No placeholders:** every file's full contents are given; the `activityState` boundary and the
  empty-journal `last_event` cases have real assertions; the live check lists concrete state triggers.
- **Type/name consistency:** `IState.last_event {ts, type: EventType}`, `ActivityState` (Farming/Idle/
  Rest), `ACTIVE_WINDOW_MS`, `activityState(lastEvent, now, windowMs?)`, `SceneTheme`, `IScene`,
  `sceneFor(tier)`, `useActivity(state)`, `SceneView`/`Hero`/`Monster` with `IProps`. The app imports
  `EventType` at runtime (events contract) and `IState` type-only; CSS class names (`scene-<theme>`,
  `hero-<activity>`, `monster-<theme>`) match the enum string values exactly so the styles bind.
```
