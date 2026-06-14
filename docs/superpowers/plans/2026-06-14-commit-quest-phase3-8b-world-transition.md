# Phase 3.8b — World Transition + Guild Scene Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the instant scene snap with a ~1.2s fade + "Now Entering" banner whenever the scene theme changes (tier-up / branch / class / guild↔field), and add a guild backdrop the hero rests in when fresh-opened or after a session ends.

**Architecture:** App-only, cosmetic. A pure `sceneNow(...)` composes "place" (Guild vs Field) into one `IScene` — Guild on Rest or a fresh `session_start`, else the 3.7 `sceneFor` realm. A `useTransition` hook fires off the composed `scene.theme` changing (skipping first mount) and a `<WorldTransition>` overlay plays the fade + banner. The 3.8a scene-director is untouched (it already shows no mobs when not Farming, so the guild is naturally empty).

**Tech Stack:** Bun + TypeScript, `bun test`, React 19 (Vite), plain CSS.

**Spec:** `docs/superpowers/specs/2026-06-14-commit-quest-phase3-8b-world-transition-design.md`

---

## Context for the implementer

- **`app/src/` FE style:** arrow `const` / `export function` hooks, string enums (PascalCase members, string values), `I*`/`T*` prefixes, no `any`, braces on every if/else, kebab-case files. `core` is **type-only** EXCEPT `core/events.ts` (`EventType`) which is the shared wire contract and MAY be imported at runtime (per `app/CLAUDE.md`).
- Run tests: `cd app && bun test 2>&1 | grep -E "pass|fail"` — **never** `tail`.
- `app/src/scene.ts` already has `enum SceneTheme`, `interface IScene { theme, label, monster }`, and `sceneFor(tier, line?, branch?): IScene` (3.7). `app/src/activity.ts` has `enum ActivityState { Farming, Idle, Rest }`. `core/events.ts` has `enum EventType { SessionStart = "session_start", SessionEnd = "session_end", … }`. `state.last_event` is `{ ts: string; type: EventType } | undefined`.
- `scene-view.tsx` currently computes `const sceneInfo = sceneFor(state.class?.tier ?? 0, state.class?.line, state.class?.branch)` and renders `.scene-${sceneInfo.theme}` + `<AreaTag label={sceneInfo.label}>`. This plan swaps that one line for `sceneNow({...})` so the guild backdrop + label come for free, and adds the transition overlay.
- The 3.8a director (`useSceneDirector`) returns `mobs: []` whenever not Farming, so the guild (Rest / fresh-Idle, both non-Farming) renders empty with the hero in the Wander stroll — no director change needed.

---

## Task 1: Guild scene + pure `sceneNow` place resolver

**Files:**
- Modify: `app/src/scene.ts`
- Create: `app/src/scene-place.ts`
- Test: `app/src/scene-place.test.ts`

- [ ] **Step 1: Add the guild theme + constant to `app/src/scene.ts`**

Add `Guild = "guild"` as the last member of the `SceneTheme` enum (after `Ascendant`):

```ts
  // T4 main-line pre-branch fallback
  Ascendant = "ascendant",
  // Home base (3.8b) — shown on Rest / fresh session_start
  Guild = "guild",
}
```

Immediately AFTER the `export interface IScene { … }` block, add:

```ts
export const GUILD_SCENE: IScene = {
  theme: SceneTheme.Guild,
  label: "The Guild",
  monster: "",
};
```

- [ ] **Step 2: Write the failing test — create `app/src/scene-place.test.ts`:**

```ts
import { test, expect } from "bun:test";
import { EventType } from "../../core/events";
import { ActivityState } from "./activity";
import { SceneTheme } from "./scene";
import { ScenePlace, placeFor, sceneNow } from "./scene-place";

const ev = (type: EventType) => ({ ts: "2026-06-14T00:00:00.000Z", type });

test("placeFor: guild on rest or a fresh session_start, else field", () => {
  expect(placeFor(ActivityState.Rest, ev(EventType.SessionEnd))).toBe(ScenePlace.Guild);
  expect(placeFor(ActivityState.Idle, ev(EventType.SessionStart))).toBe(ScenePlace.Guild);
  expect(placeFor(ActivityState.Idle, ev(EventType.Prompt))).toBe(ScenePlace.Field);
  expect(placeFor(ActivityState.Farming, ev(EventType.Prompt))).toBe(ScenePlace.Field);
  expect(placeFor(ActivityState.Idle, undefined)).toBe(ScenePlace.Field);
});

test("sceneNow: guild place → GUILD_SCENE; field place → sceneFor", () => {
  const guild = sceneNow({
    activity: ActivityState.Rest,
    lastEvent: ev(EventType.SessionEnd),
    tier: 4,
    line: "mage",
    branch: "a",
  });
  expect(guild.theme).toBe(SceneTheme.Guild);
  expect(guild.label).toBe("The Guild");

  const field = sceneNow({
    activity: ActivityState.Farming,
    lastEvent: ev(EventType.Prompt),
    tier: 4,
    line: "mage",
    branch: "a",
  });
  expect(field.theme).toBe(SceneTheme.SkyforgeAether);
  expect(field.label).toBe("Skyforge Aether");

  const t1 = sceneNow({
    activity: ActivityState.Idle,
    lastEvent: ev(EventType.Prompt),
    tier: 1,
  });
  expect(t1.theme).toBe(SceneTheme.Grassland);
});
```

(`EventType.Prompt` is an existing member of `core/events.ts` — a normal work event. If its exact name differs, use any non-session member; the point is "not SessionStart/SessionEnd".)

- [ ] **Step 3: Run to verify it fails**

Run: `cd app && bun test src/scene-place.test.ts 2>&1 | grep -E "pass|fail"`
Expected: FAIL — `scene-place` module does not exist.

- [ ] **Step 4: Implement `app/src/scene-place.ts`**

```ts
import { EventType } from "../../core/events";
import type { IState } from "../../core/state";
import { ActivityState } from "./activity";
import { type IScene, sceneFor, GUILD_SCENE } from "./scene";

export enum ScenePlace {
  Guild = "guild",
  Field = "field",
}

// Guild when resting (session ended) or freshly opened (session_start, nothing done yet).
export const placeFor = (
  activity: ActivityState,
  lastEvent: IState["last_event"],
): ScenePlace => {
  if (activity === ActivityState.Rest) {
    return ScenePlace.Guild;
  }
  if (activity === ActivityState.Idle && lastEvent?.type === EventType.SessionStart) {
    return ScenePlace.Guild;
  }
  return ScenePlace.Field;
};

export interface ISceneNowArgs {
  activity: ActivityState;
  lastEvent: IState["last_event"];
  tier: number;
  line?: string | null;
  branch?: string | null;
}

export const sceneNow = (args: ISceneNowArgs): IScene => {
  const { activity, lastEvent, tier, line, branch } = args;
  if (placeFor(activity, lastEvent) === ScenePlace.Guild) {
    return GUILD_SCENE;
  }
  return sceneFor(tier, line, branch);
};
```

- [ ] **Step 5: Run to verify it passes**

Run: `cd app && bun test src/scene-place.test.ts 2>&1 | grep -E "pass|fail"`
Expected: PASS, 0 fail.

- [ ] **Step 6: Commit**

```bash
git add app/src/scene.ts app/src/scene-place.ts app/src/scene-place.test.ts
git commit -m "feat(app): guild scene + pure sceneNow place resolver"
```

---

## Task 2: `use-transition` hook

**Files:**
- Create: `app/src/use-transition.ts`
- (No unit test — timer/effect glue, verified by the suite staying green + the panel. The pure input it watches is tested in Task 1.)

- [ ] **Step 1: Create `app/src/use-transition.ts`**

```ts
import { useEffect, useRef, useState } from "react";
import type { IScene } from "./scene";

export const TRANSITION_MS = 1200;

export interface ITransitionView {
  active: boolean;
  label: string | null;
}

// Plays a one-shot transition whenever the scene THEME changes (never on first mount).
export function useTransition(scene: IScene): ITransitionView {
  const prevTheme = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [view, setView] = useState<ITransitionView>({ active: false, label: null });

  useEffect(() => {
    return () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
    };
  }, []);

  useEffect(() => {
    const prev = prevTheme.current;
    prevTheme.current = scene.theme;
    if (prev === null || prev === scene.theme) {
      return; // first mount, or no real change
    }
    setView({ active: true, label: scene.label });
    if (timer.current) {
      clearTimeout(timer.current);
    }
    timer.current = setTimeout(() => {
      setView(v => ({ active: false, label: v.label }));
    }, TRANSITION_MS);
    // `scene.label` is intentionally read fresh when the theme flips, not a dep.
  }, [scene.theme]);

  return view;
}
```

- [ ] **Step 2: Type-check (the hook compiles standalone)**

Run: `cd app && bunx tsc --noEmit 2>&1 | grep -E "use-transition|error TS" | head`
Expected: no error mentioning `use-transition` (other unrelated errors, if any, are addressed in Task 3).

Run: `cd app && bun test 2>&1 | grep -E "pass|fail"`
Expected: all pass (no behavior wired yet; this just confirms nothing broke).

- [ ] **Step 3: Commit**

```bash
git add app/src/use-transition.ts
git commit -m "feat(app): use-transition hook (theme-change → timed banner)"
```

---

## Task 3: `<WorldTransition>` overlay + wire `scene-view`

**Files:**
- Create: `app/src/components/world-transition.tsx`
- Modify: `app/src/components/scene-view.tsx`
- (Presentational + wiring — verified by tsc clean + suite green + the panel.)

- [ ] **Step 1: Create `app/src/components/world-transition.tsx`**

```tsx
interface IProps {
  active: boolean;
  label: string | null;
}

const WorldTransition = (props: IProps) => {
  const { active, label } = props;
  if (!active) {
    return null;
  }
  return (
    <div className="world-transition" aria-hidden="true">
      <div className="world-banner">
        <span className="world-eyebrow">Now Entering</span>
        <span className="world-realm">{label}</span>
      </div>
    </div>
  );
};

export default WorldTransition;
```

- [ ] **Step 2: Rewrite `app/src/components/scene-view.tsx`**

Swap `sceneFor` for `sceneNow`, add `useTransition` + the overlay. Full file:

```tsx
import { useState } from "react";
import type { IState } from "../../../core/state";
import { sceneNow } from "../scene-place";
import { ActivityState } from "../activity";
import { PanelId } from "../panels";
import { useEncounter } from "../use-encounter";
import { useSceneDirector } from "../use-scene-director";
import { useTransition } from "../use-transition";
import Hero from "./hero";
import Monster from "./monster";
import HitEffects from "./hit-effect";
import WorldTransition from "./world-transition";
import BossEncounter from "./boss-encounter";
import PortraitFrame from "./portrait-frame";
import AreaTag from "./area-tag";
import ActivityBar from "./activity-bar";
import FloatingText from "./floating-text";
import PanelOverlay from "./panel-overlay";
import Sidebar from "./sidebar";

interface IProps {
  state: IState;
  activity: ActivityState;
}

const SceneView = (props: IProps) => {
  const { state, activity } = props;
  const [panel, setPanel] = useState<PanelId | null>(null);
  const encounter = useEncounter(state);
  const scene = useSceneDirector(state, activity);
  const sceneInfo = sceneNow({
    activity,
    lastEvent: state.last_event,
    tier: state.class?.tier ?? 0,
    line: state.class?.line,
    branch: state.class?.branch,
  });
  const transition = useTransition(sceneInfo);
  const line = state.class?.line ?? "novice";

  return (
    <div className="companion">
      <div className={`scene scene-${sceneInfo.theme}`}>
        <div className="sky" aria-hidden="true" />
        {!encounter &&
          scene.mobs.map((m, i) => (
            <Monster key={i} scene={sceneInfo} anim={m.anim} hp={m.hpFraction} slot={i} />
          ))}
        {!encounter && <HitEffects effects={scene.effects} />}
        <Hero line={line} anim={scene.hero} />
        <FloatingText floaters={scene.floaters} />
        {encounter && <BossEncounter encounter={encounter} />}
        <PortraitFrame state={state} />
        <AreaTag label={sceneInfo.label} />
        <ActivityBar activity={activity} />
        <PanelOverlay activePanel={panel} state={state} onClose={() => setPanel(null)} />
        <WorldTransition active={transition.active} label={transition.label} />
      </div>
      <Sidebar state={state} onOpen={setPanel} />
    </div>
  );
};

export default SceneView;
```

- [ ] **Step 3: Type-check + full suite**

Run: `cd app && bunx tsc --noEmit 2>&1 | grep -E "error TS" | head`
Expected: no output (clean).

Run: `cd app && bun test 2>&1 | grep -E "pass|fail"`
Expected: all pass, 0 fail.

Run: `grep -rn "sceneFor" app/src/components`
Expected: no output (scene-view no longer calls `sceneFor` directly; it goes through `sceneNow`).

- [ ] **Step 4: Commit**

```bash
git add app/src/components/world-transition.tsx app/src/components/scene-view.tsx
git commit -m "feat(app): world-transition overlay + guild via sceneNow in scene-view"
```

---

## Task 4: Guild backdrop + transition CSS + art note

**Files:**
- Modify: `app/src/styles.css`
- Modify: `docs/reference/art-prompts.md`
- (Presentational — verified in the panel.)

- [ ] **Step 1: Add the guild backdrop gradient**

In `app/src/styles.css`, immediately AFTER the `.scene-ascendant .sky { … }` rule (~line 91), add:

```css
.scene-guild .sky {
  background:
    radial-gradient(circle at 50% 78%, #6b3a1e88, transparent 60%),
    linear-gradient(180deg, #1c1208, #3a2614 55%, #50341c);
}
```

- [ ] **Step 2: Add the world-transition overlay CSS**

Append near the end of `app/src/styles.css`, BEFORE the `@media (prefers-reduced-motion: reduce)` block:

```css
/* ── world transition (3.8b): fade + "Now Entering" banner ── */
.world-transition {
  position: absolute;
  inset: 0;
  z-index: 30;
  display: grid;
  place-items: center;
  pointer-events: none;
  animation: world-fade 1.2s ease-in-out forwards;
}
@keyframes world-fade {
  0% {
    background: #0a0712e6;
    opacity: 0;
  }
  18% {
    background: #0a0712e6;
    opacity: 1;
  }
  70% {
    background: #0a0712e6;
    opacity: 1;
  }
  100% {
    background: #0a071200;
    opacity: 0;
  }
}
.world-banner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  animation: world-banner-rise 1.2s ease-out forwards;
}
@keyframes world-banner-rise {
  0% {
    transform: translateY(8px);
    opacity: 0;
  }
  25% {
    opacity: 1;
  }
  80% {
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
}
.world-eyebrow {
  font-family: "Pixelify Sans", monospace;
  font-size: 11px;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: var(--gold-soft);
}
.world-realm {
  font-family: "MedievalSharp", serif;
  font-size: 24px;
  color: var(--text);
  text-shadow: 2px 2px 0 #000;
}
```

- [ ] **Step 3: Extend the reduced-motion block**

Inside the existing `@media (prefers-reduced-motion: reduce) {` block, add a rule so the transition does not sweep (the JS timer still toggles it off after ~1.2s — it just appears/clears without the fade animation):

```css
  .world-transition,
  .world-banner {
    animation: none;
  }
```

- [ ] **Step 4: Note the new art targets in `docs/reference/art-prompts.md`**

In §7.4 ("หมายเหตุ implementation"), append a bullet:

```
- **3.8b** ฉาก **กิล/เมือง** (home base, โทนอุ่น) + world-transition (fade + ป้าย "Now Entering") — โค้ดใช้ `.scene-guild` + `sceneNow` (Rest/fresh session_start = กิล); ตอนนี้ gradient placeholder, art เสียบหลัง CSS seam
```

- [ ] **Step 5: Build + suite sanity**

Run: `cd app && bun test 2>&1 | grep -E "pass|fail"`
Expected: all pass, 0 fail.

Run: `grep -c "scene-guild\|world-transition\|world-realm\|@keyframes world-fade" app/src/styles.css`
Expected: 5 or more.

- [ ] **Step 6: Commit**

```bash
git add app/src/styles.css docs/reference/art-prompts.md
git commit -m "feat(app): guild backdrop + world-transition fade/banner CSS"
```

---

## Self-Review

**Spec coverage:**
- `SceneTheme.Guild` + `GUILD_SCENE` → Task 1. ✅
- `placeFor` (Rest / fresh session_start → Guild; else Field) + `sceneNow` → Task 1 (tested). ✅
- `useTransition` (theme-change → timed banner, skip first mount, StrictMode-safe) → Task 2. ✅
- `<WorldTransition>` fade + "Now Entering" banner → Task 3 + Task 4 CSS. ✅
- `scene-view` swaps `sceneFor`→`sceneNow`, adds transition overlay → Task 3. ✅
- Guild backdrop CSS + reduced-motion + art note → Task 4. ✅
- App-only, no core change, director untouched (guild empty via existing non-Farming → mobs:[]) → all tasks. ✅
- Testing: pure `placeFor`/`sceneNow` (Task 1); transition + visual (panel). ✅

**Placeholder scan:** none — every code step has full content.

**Type consistency:** `ScenePlace`, `placeFor(activity, lastEvent)`, `sceneNow(ISceneNowArgs)`, `GUILD_SCENE`, `SceneTheme.Guild` defined in Task 1 and consumed identically in Task 3 (`sceneNow({...})`). `ITransitionView { active, label }` + `useTransition(scene: IScene)` defined in Task 2, consumed in Task 3 (`transition.active`, `transition.label`) and `<WorldTransition active label>`. CSS class names (`.scene-guild`, `.world-transition`, `.world-banner`, `.world-eyebrow`, `.world-realm`) match the component markup in Task 3. `EventType` imported at runtime is permitted by `app/CLAUDE.md`.

**Note:** Task 2 and Task 3 are integration/presentational (timer + wiring) — a standard model is fine; the only judgment is StrictMode safety in `use-transition` (timer cleared on unmount; first-mount guard via `prevTheme` ref), which mirrors the established `use-scene-director` pattern.
