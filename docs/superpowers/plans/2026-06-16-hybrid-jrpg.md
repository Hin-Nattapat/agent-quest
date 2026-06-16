# Hybrid JRPG Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a top-down walkable guild **overworld** (4-direction PixelLab walk) for idle/rest and keep the existing side-view **battle** for farming, switched by activity with a world-transition banner.

**Architecture:** `SceneView` selects a `SceneMode` from activity and renders either a `BattleScene` (existing combat graph, extracted unchanged) or an `OverworldRoom` (guild room + a wandering `OverworldHero`). A multi-direction sprite manifest (extends PR #39) feeds both. Pure consumer-side; no `core/` changes.

**Tech Stack:** Bun + React 19 + Vite + TypeScript; `bun test` (pure helpers; no jsdom — components verified in the browser).

**Spec:** `docs/superpowers/specs/2026-06-16-hybrid-jrpg-design.md`

**Branch:** `feat/hybrid-jrpg` (stacked on `feat/frame-renderer` / PR #39).

**Conventions (CLAUDE.md + app/CLAUDE.md):** arrow-const only (no `function`); `interface I*`/`type T*`; **string enums** (never bare unions); 3+ params → single props object typed `I<Fn>Args`; no `any` (src or tests); braces on every if/else; no multi-line/nested ternaries; one component per file, `export default`; kebab-case; `app/` must not import runtime `core` (type-only `IState` only); comments explain WHY.

**Run tests:** `cd app && bun test 2>&1 | grep -E "pass|fail"` (never tail full output). Typecheck: `cd app && bun run typecheck 2>&1 | tail -3`.

---

## File Structure

- `app/public/sprites/mage/t1/idle/<dir>.png` + `walk/<dir>/<0..8>.png` — re-extracted 4-direction frames (replaces #39's flat layout) — Task 1.
- `app/src/facing.ts` — `Facing` enum + `facingFromDelta` — Task 2.
- `app/src/sprites.ts` — directional `ISpriteSet`, `heroSpriteSet`, `directionalFrames` (modify) — Task 3.
- `app/src/components/hero.tsx` — battle hero reads east from the directional manifest (modify) — Task 3.
- `app/src/scene-mode.ts` — `SceneMode` + `sceneModeFor` — Task 4.
- `app/src/scene-banner.ts` — `bannerScene` (transition input) — Task 5.
- `app/src/use-wander.ts` — `stepWander` pure + `useWander` hook — Task 6.
- `app/src/components/overworld-hero.tsx` — directional walking sprite — Task 7.
- `app/src/components/overworld-room.tsx` — guild room — Task 8.
- `app/src/styles.css` — guild room + overworld hero styles (modify) — Task 8.
- `app/src/components/battle-scene.tsx` — extracted side-view scene graph — Task 9.
- `app/src/components/scene-view.tsx` — mode switch + transition (modify) — Task 10.

---

## Task 1: Re-extract sprites into a 4-direction, action-grouped layout

**Files:**
- Create: `app/public/sprites/mage/t1/idle/{south,north,east,west}.png`, `app/public/sprites/mage/t1/walk/{south,north,east,west}/{0..8}.png`
- Delete: `app/public/sprites/mage/t1/idle.png`, `app/public/sprites/mage/t1/walk-0.png` … `walk-8.png`

No automated test (binary assets). Source frames live in the gitignored archive `art/pixellab/T1_Backend_Mage/`.

- [ ] **Step 1: Build the new layout from the archive**

```bash
cd /Users/calypso/Project/Ottery/commit-quest
ROOT=app/public/sprites/mage/t1
SRC=art/pixellab/T1_Backend_Mage
rm -f "$ROOT"/idle.png "$ROOT"/walk-*.png
for d in south north east west; do
  mkdir -p "$ROOT/idle" "$ROOT/walk/$d"
  cp "$SRC/rotations/$d.png" "$ROOT/idle/$d.png"
  for i in 0 1 2 3 4 5 6 7 8; do
    cp "$SRC/animations/walking_forward/$d/frame_00$i.png" "$ROOT/walk/$d/$i.png"
  done
done
```

- [ ] **Step 2: Verify the layout**

Run:
```bash
cd /Users/calypso/Project/Ottery/commit-quest
find app/public/sprites/mage/t1 -type f | sort
echo "idle count: $(ls app/public/sprites/mage/t1/idle | wc -l | tr -d ' ')"
echo "walk dirs: $(ls app/public/sprites/mage/t1/walk | tr '\n' ' ')"
echo "south frames: $(ls app/public/sprites/mage/t1/walk/south | wc -l | tr -d ' ')"
```
Expected: idle count 4; walk dirs `east north south west`; south frames 9; no `idle.png`/`walk-N.png` remain.

- [ ] **Step 3: Commit**

```bash
cd /Users/calypso/Project/Ottery/commit-quest
git add -A app/public/sprites
git commit -m "feat(app): re-extract Mage T1 sprites into 4-direction action layout"
```

---

## Task 2: `Facing` enum + `facingFromDelta`

**Files:**
- Create: `app/src/facing.ts`, `app/src/facing.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// app/src/facing.test.ts
import { test, expect } from "bun:test";
import { Facing, facingFromDelta } from "./facing";

test("facingFromDelta picks the dominant axis", () => {
  expect(facingFromDelta(5, 1)).toBe(Facing.East);
  expect(facingFromDelta(-5, 1)).toBe(Facing.West);
  expect(facingFromDelta(1, 5)).toBe(Facing.South);
  expect(facingFromDelta(1, -5)).toBe(Facing.North);
});

test("facingFromDelta breaks an axis tie toward vertical", () => {
  // |dx| == |dy| → the `>` test is false → vertical wins
  expect(facingFromDelta(3, 3)).toBe(Facing.South);
  expect(facingFromDelta(3, -3)).toBe(Facing.North);
});
```

- [ ] **Step 2: Run — expect FAIL (no module `./facing`)**

Run: `cd app && bun test src/facing.test.ts 2>&1 | grep -E "pass|fail|error"`

- [ ] **Step 3: Implement**

```ts
// app/src/facing.ts
export enum Facing {
  South = "south",
  North = "north",
  East = "east",
  West = "west",
}

// Movement vector → cardinal facing. Ties (|dx| == |dy|) fall through to vertical, which reads
// more naturally for a top-down sprite than a flickering diagonal.
export const facingFromDelta = (dx: number, dy: number): Facing => {
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? Facing.East : Facing.West;
  }
  return dy > 0 ? Facing.South : Facing.North;
};
```

- [ ] **Step 4: Run — expect 2 pass**

Run: `cd app && bun test src/facing.test.ts 2>&1 | grep -E "pass|fail"`

- [ ] **Step 5: Commit**

```bash
cd /Users/calypso/Project/Ottery/commit-quest
git add app/src/facing.ts app/src/facing.test.ts
git commit -m "feat(app): Facing enum + facingFromDelta"
```

---

## Task 3: Directional sprite manifest + battle hero update

**Files:**
- Modify: `app/src/sprites.ts`, `app/src/sprites.test.ts`, `app/src/components/hero.tsx`

The manifest becomes directional. `heroFrames(set, anim)` is replaced by `directionalFrames(set, facing, moving)`. The battle `Hero` keeps its behavior by reading the **east** entries.

- [ ] **Step 1: Rewrite `app/src/sprites.test.ts`**

```ts
import { test, expect } from "bun:test";
import { Facing } from "./facing";
import { heroSpriteSet, directionalFrames } from "./sprites";

test("heroSpriteSet resolves Mage T1 with 4 idle stills and 4×9 walk frames", () => {
  const set = heroSpriteSet("mage", 1);
  expect(set).toBeDefined();
  expect(set?.idle[Facing.East]).toBe("/sprites/mage/t1/idle/east.png");
  expect(set?.idle[Facing.South]).toBe("/sprites/mage/t1/idle/south.png");
  expect(set?.walk[Facing.West].length).toBe(9);
  expect(set?.walk[Facing.North][0]).toBe("/sprites/mage/t1/walk/north/0.png");
  expect(set?.walk[Facing.North][8]).toBe("/sprites/mage/t1/walk/north/8.png");
});

test("heroSpriteSet returns undefined for forms with no art", () => {
  expect(heroSpriteSet("mage", 2)).toBeUndefined();
  expect(heroSpriteSet("novice", 0)).toBeUndefined();
});

test("directionalFrames cycles walk when moving, else the idle still", () => {
  const set = heroSpriteSet("mage", 1);
  if (!set) {
    throw new Error("expected mage-t1 set");
  }
  expect(directionalFrames(set, Facing.East, true)).toEqual(set.walk[Facing.East]);
  expect(directionalFrames(set, Facing.South, false)).toEqual([set.idle[Facing.South]]);
});
```

- [ ] **Step 2: Run — expect FAIL (old exports gone / shape mismatch)**

Run: `cd app && bun test src/sprites.test.ts 2>&1 | grep -E "pass|fail|error"`

- [ ] **Step 3: Rewrite `app/src/sprites.ts`**

```ts
import { Facing } from "./facing";

export interface ISpriteSet {
  idle: Record<Facing, string>;
  walk: Record<Facing, string[]>;
}

const DIRS: Facing[] = [Facing.South, Facing.North, Facing.East, Facing.West];

// Build a set whose files live at /sprites/<root>/idle/<dir>.png and walk/<dir>/<0..8>.png.
const buildSet = (root: string, walkFrames: number): ISpriteSet => {
  const idle = {} as Record<Facing, string>;
  const walk = {} as Record<Facing, string[]>;
  for (const dir of DIRS) {
    idle[dir] = `/sprites/${root}/idle/${dir}.png`;
    walk[dir] = Array.from({ length: walkFrames }, (_, i) => `/sprites/${root}/walk/${dir}/${i}.png`);
  }
  return { idle, walk };
};

// key = `${line}-t${tier}`. Partial: only forms with real art appear; a missing key returns
// undefined so the renderer keeps the emoji placeholder (today only Mage T1 exists).
export const HERO_SPRITES: Partial<Record<string, ISpriteSet>> = {
  "mage-t1": buildSet("mage/t1", 9),
};

export const heroSpriteSet = (line: string, tier: number): ISpriteSet | undefined => {
  return HERO_SPRITES[`${line}-t${tier}`];
};

export const directionalFrames = (
  set: ISpriteSet,
  facing: Facing,
  moving: boolean,
): string[] => {
  if (moving) {
    return set.walk[facing];
  }
  return [set.idle[facing]];
};
```

- [ ] **Step 4: Update `app/src/components/hero.tsx`** (battle hero — east-facing, behavior unchanged)

Replace the import of `heroFrames` and the `frames` line. The file becomes:

```tsx
import { HeroAnim } from "../combat";
import { Facing } from "../facing";
import { assetUrl } from "../assets-base";
import { heroSpriteSet, directionalFrames } from "../sprites";
import { useSpriteFrame } from "../use-sprite-frame";

interface IProps {
  line: string;
  tier: number;
  anim: HeroAnim;
}

const WALK_FPS = 10;

const Hero = (props: IProps) => {
  const { line, tier, anim } = props;
  const set = heroSpriteSet(line, tier);
  const moving = anim === HeroAnim.Wander;
  const frames = set ? directionalFrames(set, Facing.East, moving) : [];
  const frame = useSpriteFrame(frames, WALK_FPS, moving);
  const style = frame ? { backgroundImage: `url(${assetUrl(frame)})` } : undefined;
  const artClass = frame ? " has-art" : "";
  return (
    <div
      className={`sprite hero hero-${line} hero-${anim}${artClass}`}
      style={style}
      aria-label="hero"
    />
  );
};

export default Hero;
```

- [ ] **Step 5: Run sprites test + typecheck**

Run: `cd app && bun test src/sprites.test.ts 2>&1 | grep -E "pass|fail"` (expect 3 pass) and `bun run typecheck 2>&1 | tail -3` (no errors — confirms nothing else imported the removed `heroFrames`).

- [ ] **Step 6: Commit**

```bash
cd /Users/calypso/Project/Ottery/commit-quest
git add app/src/sprites.ts app/src/sprites.test.ts app/src/components/hero.tsx
git commit -m "feat(app): directional sprite manifest; battle hero reads east"
```

---

## Task 4: `SceneMode` + `sceneModeFor`

**Files:**
- Create: `app/src/scene-mode.ts`, `app/src/scene-mode.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// app/src/scene-mode.test.ts
import { test, expect } from "bun:test";
import { ActivityState } from "./activity";
import { SceneMode, sceneModeFor } from "./scene-mode";

test("farming is Battle; idle and rest are Overworld", () => {
  expect(sceneModeFor(ActivityState.Farming)).toBe(SceneMode.Battle);
  expect(sceneModeFor(ActivityState.Idle)).toBe(SceneMode.Overworld);
  expect(sceneModeFor(ActivityState.Rest)).toBe(SceneMode.Overworld);
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `cd app && bun test src/scene-mode.test.ts 2>&1 | grep -E "pass|fail|error"`

- [ ] **Step 3: Implement**

```ts
// app/src/scene-mode.ts
import { ActivityState } from "./activity";

export enum SceneMode {
  Battle = "battle",
  Overworld = "overworld",
}

// Only active coding (Farming) drops into the side-view battle; idle/rest stay in the guild.
export const sceneModeFor = (activity: ActivityState): SceneMode => {
  if (activity === ActivityState.Farming) {
    return SceneMode.Battle;
  }
  return SceneMode.Overworld;
};
```

- [ ] **Step 4: Run — expect 1 pass**

- [ ] **Step 5: Commit**

```bash
cd /Users/calypso/Project/Ottery/commit-quest
git add app/src/scene-mode.ts app/src/scene-mode.test.ts
git commit -m "feat(app): SceneMode + sceneModeFor selector"
```

---

## Task 5: `bannerScene` — transition input for mode/world changes

**Files:**
- Create: `app/src/scene-banner.ts`, `app/src/scene-banner.test.ts`

`useTransition` (existing) fires a banner when the `theme` string it's given changes. We feed it a composite so the banner fires on **mode change** with a mode-appropriate label. Battle keeps a per-theme suffix so entering a new tier's battle still banners.

- [ ] **Step 1: Write the failing test**

```ts
// app/src/scene-banner.test.ts
import { test, expect } from "bun:test";
import { SceneMode } from "./scene-mode";
import { bannerScene } from "./scene-banner";

test("battle banner keys on mode+theme and labels Entering Battle", () => {
  const b = bannerScene(SceneMode.Battle, "lair_skyforge");
  expect(b.theme).toBe("battle:lair_skyforge");
  expect(b.label).toBe("Entering Battle");
});

test("overworld banner is a single stable key labelled Returning to Guild", () => {
  const b = bannerScene(SceneMode.Overworld, "lair_skyforge");
  expect(b.theme).toBe("overworld");
  expect(b.label).toBe("Returning to Guild");
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `cd app && bun test src/scene-banner.test.ts 2>&1 | grep -E "pass|fail|error"`

- [ ] **Step 3: Implement**

```ts
// app/src/scene-banner.ts
import type { IScene } from "./scene";
import { SceneMode } from "./scene-mode";

// Feeds useTransition a {theme,label}: a key that changes on mode (and battle tier-theme) so the
// banner fires, plus the label to show. Overworld is one room → one stable key, no inner banners.
export const bannerScene = (mode: SceneMode, sceneTheme: string): IScene => {
  if (mode === SceneMode.Battle) {
    return { theme: `battle:${sceneTheme}`, label: "Entering Battle" };
  }
  return { theme: "overworld", label: "Returning to Guild" };
};
```

> Note: `IScene` is `{ theme: string; label: string; ... }` in `app/src/scene.ts`. If `IScene` has required fields beyond `theme`/`label`, change the return type to a local `interface IBannerScene { theme: string; label: string }` and pass that to `useTransition` (its `shouldTransition`/effect read only `theme` and `label`). Check `app/src/scene.ts` first and pick whichever keeps the type honest.

- [ ] **Step 4: Run — expect 2 pass + typecheck**

Run: `cd app && bun test src/scene-banner.test.ts 2>&1 | grep -E "pass|fail"` and `bun run typecheck 2>&1 | tail -3`.

- [ ] **Step 5: Commit**

```bash
cd /Users/calypso/Project/Ottery/commit-quest
git add app/src/scene-banner.ts app/src/scene-banner.test.ts
git commit -m "feat(app): scene-banner input for mode/world transitions"
```

---

## Task 6: `use-wander` — ambient roam movement

**Files:**
- Create: `app/src/use-wander.ts`, `app/src/use-wander.test.ts`

`stepWander` is the pure per-tick integrator (tested). `useWander(roaming)` drives it with rAF: roam waypoints when `roaming`, else pin to the rest spot.

- [ ] **Step 1: Write the failing test**

```ts
// app/src/use-wander.test.ts
import { test, expect } from "bun:test";
import { Facing } from "./facing";
import { stepWander } from "./use-wander";

test("stepWander moves toward the target by speed*dt and faces the delta", () => {
  const r = stepWander({ xPct: 0, yPct: 0, targetX: 100, targetY: 0, speedPctPerSec: 50, dtMs: 100 });
  expect(r.reached).toBe(false);
  expect(r.pose.xPct).toBeCloseTo(5, 5); // 50%/s * 0.1s
  expect(r.pose.yPct).toBeCloseTo(0, 5);
  expect(r.pose.facing).toBe(Facing.East);
  expect(r.pose.moving).toBe(true);
});

test("stepWander snaps to the target and stops when within one step", () => {
  const r = stepWander({ xPct: 9.9, yPct: 0, targetX: 10, targetY: 0, speedPctPerSec: 50, dtMs: 100 });
  expect(r.reached).toBe(true);
  expect(r.pose.xPct).toBe(10);
  expect(r.pose.yPct).toBe(0);
  expect(r.pose.moving).toBe(false);
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `cd app && bun test src/use-wander.test.ts 2>&1 | grep -E "pass|fail|error"`

- [ ] **Step 3: Implement**

```ts
// app/src/use-wander.ts
import { useEffect, useRef, useState } from "react";
import { Facing, facingFromDelta } from "./facing";

export interface IWanderPose {
  xPct: number;
  yPct: number;
  facing: Facing;
  moving: boolean;
}

interface IStepWanderArgs {
  xPct: number;
  yPct: number;
  targetX: number;
  targetY: number;
  speedPctPerSec: number;
  dtMs: number;
}

// One integration tick toward the target. Snaps + stops when the remaining distance is within a
// single step (prevents overshoot jitter). Pure so the motion math is unit-tested without rAF.
export const stepWander = (
  props: IStepWanderArgs,
): { pose: IWanderPose; reached: boolean } => {
  const { xPct, yPct, targetX, targetY, speedPctPerSec, dtMs } = props;
  const dx = targetX - xPct;
  const dy = targetY - yPct;
  const dist = Math.hypot(dx, dy);
  const step = speedPctPerSec * (dtMs / 1000);
  const facing = facingFromDelta(dx, dy);
  if (dist <= step || dist < 0.5) {
    return { pose: { xPct: targetX, yPct: targetY, facing, moving: false }, reached: true };
  }
  return {
    pose: { xPct: xPct + (dx / dist) * step, yPct: yPct + (dy / dist) * step, facing, moving: true },
    reached: false,
  };
};

// Waypoints + rest spot in panel-relative percentages (so the room scales with the panel).
const WAYPOINTS = [
  { x: 25, y: 35 },
  { x: 70, y: 30 },
  { x: 72, y: 68 },
  { x: 35, y: 75 },
  { x: 22, y: 55 },
];
const REST_SPOT = { x: 50, y: 62 };
const SPEED_PCT_PER_SEC = 14;
const PAUSE_MIN_MS = 900;
const PAUSE_MAX_MS = 2200;

const prefersReducedMotion = (): boolean => {
  if (typeof window === "undefined" || !window.matchMedia) {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
};

// roaming=false (Rest) pins the hero to the rest spot facing south. reduced-motion holds the
// first waypoint. Otherwise the hero walks waypoint→waypoint with a randomized pause between legs.
export const useWander = (roaming: boolean): IWanderPose => {
  const restPose: IWanderPose = { xPct: REST_SPOT.x, yPct: REST_SPOT.y, facing: Facing.South, moving: false };
  const first = WAYPOINTS[0];
  const [pose, setPose] = useState<IWanderPose>(restPose);
  const wpRef = useRef(0);
  const pauseRef = useRef(0);
  const posRef = useRef({ x: first.x, y: first.y });
  const lastRef = useRef<number | null>(null);

  const active = roaming && !prefersReducedMotion();

  useEffect(() => {
    if (!active) {
      setPose(roaming ? { xPct: first.x, yPct: first.y, facing: Facing.South, moving: false } : restPose);
      lastRef.current = null;
      return;
    }
    let raf = 0;
    const tick = (now: number) => {
      if (lastRef.current === null) {
        lastRef.current = now;
      }
      const dtMs = now - lastRef.current;
      lastRef.current = now;
      if (pauseRef.current > 0) {
        pauseRef.current -= dtMs;
      } else {
        const target = WAYPOINTS[wpRef.current];
        const r = stepWander({
          xPct: posRef.current.x,
          yPct: posRef.current.y,
          targetX: target.x,
          targetY: target.y,
          speedPctPerSec: SPEED_PCT_PER_SEC,
          dtMs,
        });
        posRef.current = { x: r.pose.xPct, y: r.pose.yPct };
        setPose(r.pose);
        if (r.reached) {
          pauseRef.current = PAUSE_MIN_MS + (wpRef.current / WAYPOINTS.length) * (PAUSE_MAX_MS - PAUSE_MIN_MS);
          wpRef.current = (wpRef.current + 1) % WAYPOINTS.length;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // re-arm when roaming flips; WAYPOINTS/speed are module constants.
  }, [active]);

  return pose;
};
```

> Note: the pause length uses `wpRef`-derived spacing instead of `Math.random()` because `Math.random()` is unavailable in this codebase's deterministic contexts; varied-enough pauses without randomness. Keep it.

- [ ] **Step 4: Run — expect 2 pass + typecheck**

Run: `cd app && bun test src/use-wander.test.ts 2>&1 | grep -E "pass|fail"` and `bun run typecheck 2>&1 | tail -3`.

- [ ] **Step 5: Commit**

```bash
cd /Users/calypso/Project/Ottery/commit-quest
git add app/src/use-wander.ts app/src/use-wander.test.ts
git commit -m "feat(app): ambient wander movement hook + stepWander"
```

---

## Task 7: `OverworldHero` — directional walking sprite

**Files:**
- Create: `app/src/components/overworld-hero.tsx`

No unit test (React + rAF; verified in the browser at Task 10).

- [ ] **Step 1: Implement**

```tsx
// app/src/components/overworld-hero.tsx
import type { Facing } from "../facing";
import { assetUrl } from "../assets-base";
import { heroSpriteSet, directionalFrames } from "../sprites";
import { useSpriteFrame } from "../use-sprite-frame";

interface IProps {
  line: string;
  tier: number;
  facing: Facing;
  moving: boolean;
  xPct: number;
  yPct: number;
}

const WALK_FPS = 10;

const OverworldHero = (props: IProps) => {
  const { line, tier, facing, moving, xPct, yPct } = props;
  const set = heroSpriteSet(line, tier);
  const frames = set ? directionalFrames(set, facing, moving) : [];
  const frame = useSpriteFrame(frames, WALK_FPS, moving);
  const artClass = frame ? " has-art" : "";
  const style = {
    left: `${xPct}%`,
    top: `${yPct}%`,
    backgroundImage: frame ? `url(${assetUrl(frame)})` : undefined,
  };
  return (
    <div
      className={`sprite ow-hero hero-${line}${artClass}`}
      style={style}
      aria-label="hero"
    />
  );
};

export default OverworldHero;
```

- [ ] **Step 2: Typecheck**

Run: `cd app && bun run typecheck 2>&1 | tail -3` (no errors).

- [ ] **Step 3: Commit**

```bash
cd /Users/calypso/Project/Ottery/commit-quest
git add app/src/components/overworld-hero.tsx
git commit -m "feat(app): OverworldHero directional walking sprite"
```

---

## Task 8: `OverworldRoom` — the guild + styles

**Files:**
- Create: `app/src/components/overworld-room.tsx`
- Modify: `app/src/styles.css`

No unit test (verified in browser at Task 10).

- [ ] **Step 1: Implement `app/src/components/overworld-room.tsx`**

```tsx
// app/src/components/overworld-room.tsx
import { ActivityState } from "../activity";
import { useWander } from "../use-wander";
import OverworldHero from "./overworld-hero";

interface IProps {
  line: string;
  tier: number;
  activity: ActivityState;
}

const OverworldRoom = (props: IProps) => {
  const { line, tier, activity } = props;
  const roaming = activity !== ActivityState.Rest;
  const pose = useWander(roaming);
  const resting = activity === ActivityState.Rest;
  return (
    <div className="guild-room">
      <div className="guild-floor" aria-hidden="true" />
      <div className="guild-rug" aria-hidden="true" />
      <div className="guild-banner" aria-hidden="true">🛡️</div>
      <div className="guild-table" aria-hidden="true" />
      <div className="guild-npc" aria-hidden="true">🧑‍🌾</div>
      <div className="guild-chest" aria-hidden="true">🧰</div>
      <OverworldHero
        line={line}
        tier={tier}
        facing={pose.facing}
        moving={pose.moving}
        xPct={pose.xPct}
        yPct={pose.yPct}
      />
      {resting && (
        <div className="guild-zzz" style={{ left: `${pose.xPct}%`, top: `${pose.yPct}%` }}>
          💤
        </div>
      )}
    </div>
  );
};

export default OverworldRoom;
```

- [ ] **Step 2: Add styles to `app/src/styles.css`** (append at end)

```css
/* ── overworld guild room (top-down) ── */
.guild-room {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: radial-gradient(120% 80% at 50% 0%, #4a3a24 0%, #3a2e1f 45%, #2a2118 100%);
}
.guild-floor {
  position: absolute;
  left: 6%;
  right: 6%;
  top: 11%;
  bottom: 9%;
  border-radius: 6px;
  background:
    repeating-linear-gradient(0deg, #34281a 0 31px, #2e2316 31px 32px),
    repeating-linear-gradient(90deg, #34281a 0 31px, #2e2316 31px 32px);
  box-shadow: inset 0 0 0 2px #1c1610, inset 0 18px 40px rgba(0, 0, 0, 0.35);
}
.guild-rug {
  position: absolute;
  left: 50%;
  top: 46%;
  width: 130px;
  height: 130px;
  transform: translate(-50%, -50%) rotate(45deg);
  background: linear-gradient(135deg, #6b2a3a, #8a3a4a);
  opacity: 0.5;
  border: 2px solid #aa5566;
  border-radius: 8px;
}
.guild-banner {
  position: absolute;
  top: 12%;
  left: 50%;
  transform: translateX(-50%);
  width: 56px;
  height: 78px;
  display: grid;
  place-items: center;
  font-size: 24px;
  background: linear-gradient(#6a1a3a, #4a1430);
  border: 2px solid var(--gold, #cdae57);
  clip-path: polygon(0 0, 100% 0, 100% 80%, 50% 100%, 0 80%);
}
.guild-table {
  position: absolute;
  top: 24%;
  left: 12%;
  width: 60px;
  height: 38px;
  border-radius: 5px;
  background: linear-gradient(#5a3a1f, #3f2814);
  border: 2px solid #6e4a26;
}
.guild-npc {
  position: absolute;
  top: 33%;
  right: 14%;
  font-size: 28px;
  filter: drop-shadow(0 2px 0 rgba(0, 0, 0, 0.4));
}
.guild-chest {
  position: absolute;
  bottom: 14%;
  right: 12%;
  font-size: 28px;
}
.ow-hero {
  position: absolute;
  width: 64px;
  height: 64px;
  transform: translate(-50%, -85%);
  image-rendering: pixelated;
  background-repeat: no-repeat;
  background-size: contain;
  background-position: center bottom;
  filter: drop-shadow(0 3px 2px rgba(0, 0, 0, 0.45));
}
.guild-zzz {
  position: absolute;
  transform: translate(10px, -64px);
  font-size: 18px;
  animation: guild-zzz 2.4s ease-in-out infinite;
}
@keyframes guild-zzz {
  0%, 100% { opacity: 0.5; transform: translate(10px, -64px); }
  50% { opacity: 1; transform: translate(14px, -72px); }
}
```

> Note: `.ow-hero` has its own `position/transform/background` and does NOT reuse `.sprite`'s `left:30%`/`bottom:24%` battle placement — that's why it sets `position:absolute` + percentage `left/top` from props. The `.sprite.has-art::after { content: none }` rule from PR #39 still suppresses the emoji when art loads; the emoji fallback `::after` for `.ow-hero` without art uses the same `.hero-<line>::after`? No — add a fallback below.

Add an emoji fallback for the overworld hero when no art (so a form without a sprite still shows something):

```css
.ow-hero:not(.has-art)::after {
  content: "🧙";
  font-size: 34px;
}
```

- [ ] **Step 3: Typecheck**

Run: `cd app && bun run typecheck 2>&1 | tail -3` (no errors).

- [ ] **Step 4: Commit**

```bash
cd /Users/calypso/Project/Ottery/commit-quest
git add app/src/components/overworld-room.tsx app/src/styles.css
git commit -m "feat(app): guild OverworldRoom + top-down styles"
```

---

## Task 9: Extract `BattleScene` from `SceneView`

**Files:**
- Create: `app/src/components/battle-scene.tsx`
- Modify: `app/src/components/scene-view.tsx` (will be finalized in Task 10; here we only extract)

Pull the side-view scene graph (mobs + hit-effects + battle Hero + floaters + boss) and its combat hooks (`useEncounter`, `useSceneDirector`) into a self-contained component, so combat logic runs only in battle mode. No behavior change.

- [ ] **Step 1: Create `app/src/components/battle-scene.tsx`**

```tsx
// app/src/components/battle-scene.tsx
import type { IState } from "../../../core/state";
import type { IScene } from "../scene";
import { ActivityState } from "../activity";
import { useEncounter } from "../use-encounter";
import { useSceneDirector } from "../use-scene-director";
import Hero from "./hero";
import Monster from "./monster";
import HitEffects from "./hit-effect";
import BossEncounter from "./boss-encounter";
import FloatingText from "./floating-text";

interface IProps {
  state: IState;
  activity: ActivityState;
  sceneInfo: IScene;
  line: string;
  tier: number;
}

const BattleScene = (props: IProps) => {
  const { state, activity, sceneInfo, line, tier } = props;
  const encounter = useEncounter(state);
  const scene = useSceneDirector(state, activity);
  return (
    <>
      {!encounter &&
        scene.mobs.map((m, i) => {
          if (m.gone) {
            return null;
          }
          return <Monster key={i} scene={sceneInfo} anim={m.anim} hp={m.hpFraction} slot={i} />;
        })}
      {!encounter && <HitEffects effects={scene.effects} />}
      <Hero line={line} tier={tier} anim={scene.hero} />
      <FloatingText floaters={scene.floaters} />
      {encounter && <BossEncounter encounter={encounter} />}
    </>
  );
};

export default BattleScene;
```

- [ ] **Step 2: Typecheck (BattleScene compiles standalone before SceneView is rewired)**

Run: `cd app && bun run typecheck 2>&1 | tail -3`. Expect no errors in `battle-scene.tsx` itself (SceneView still has its own copy until Task 10 — that's fine, both compile).

- [ ] **Step 3: Commit**

```bash
cd /Users/calypso/Project/Ottery/commit-quest
git add app/src/components/battle-scene.tsx
git commit -m "feat(app): extract BattleScene (side-view combat graph)"
```

---

## Task 10: `SceneView` mode switch + transition; browser verification

**Files:**
- Modify: `app/src/components/scene-view.tsx`

- [ ] **Step 1: Rewrite `app/src/components/scene-view.tsx`**

```tsx
import { useState } from "react";
import type { IState } from "../../../core/state";
import type { TClientAction } from "../actions";
import { sceneNow } from "../scene-place";
import { ActivityState } from "../activity";
import { PanelId } from "../panels";
import { SceneMode, sceneModeFor } from "../scene-mode";
import { bannerScene } from "../scene-banner";
import { useTransition } from "../use-transition";
import BattleScene from "./battle-scene";
import OverworldRoom from "./overworld-room";
import WorldTransition from "./world-transition";
import PortraitFrame from "./portrait-frame";
import AreaTag from "./area-tag";
import MetaMenu from "./meta-menu";
import ActivityBar from "./activity-bar";
import PanelOverlay from "./panel-overlay";
import Sidebar from "./sidebar";

interface IProps {
  state: IState;
  activity: ActivityState;
  dispatch: (action: TClientAction) => void;
}

const SceneView = (props: IProps) => {
  const { state, activity, dispatch } = props;
  const [panel, setPanel] = useState<PanelId | null>(null);
  const sceneInfo = sceneNow({
    activity,
    lastEvent: state.last_event,
    tier: state.class?.tier ?? 0,
    line: state.class?.line,
    branch: state.class?.branch,
  });
  const mode = sceneModeFor(activity);
  const transition = useTransition(bannerScene(mode, sceneInfo.theme));
  const line = state.class?.line ?? "novice";
  const tier = state.class?.tier ?? 0;
  const sceneClass = mode === SceneMode.Battle ? `scene scene-${sceneInfo.theme}` : "scene scene-guild";

  return (
    <div className="companion">
      <div className={sceneClass}>
        <div className="sky" aria-hidden="true" />
        {mode === SceneMode.Battle && (
          <BattleScene
            state={state}
            activity={activity}
            sceneInfo={sceneInfo}
            line={line}
            tier={tier}
          />
        )}
        {mode === SceneMode.Overworld && (
          <OverworldRoom line={line} tier={tier} activity={activity} />
        )}
        <PortraitFrame state={state} />
        <AreaTag label={mode === SceneMode.Battle ? sceneInfo.label : "Guild Hall"} />
        <MetaMenu onOpen={setPanel} />
        <ActivityBar activity={activity} />
        <PanelOverlay
          activePanel={panel}
          state={state}
          onClose={() => setPanel(null)}
          dispatch={dispatch}
        />
        <WorldTransition active={transition.active} label={transition.label} />
      </div>
      <Sidebar state={state} onOpen={setPanel} />
    </div>
  );
};

export default SceneView;
```

> Note: the `.sky` div stays for the battle backdrop; the guild room paints its own background over the scene, so `.sky` is harmless in overworld (covered). If it visibly bleeds, gate it with `{mode === SceneMode.Battle && <div className="sky" .../>}`.

- [ ] **Step 2: Typecheck + full suite**

Run: `cd app && bun run typecheck 2>&1 | tail -3` (no errors — confirms the removed imports/hooks aren't referenced) and `bun test 2>&1 | grep -E "pass|fail"` (all pass).

- [ ] **Step 3: Browser verification — both modes**

Build + serve a fixture, then drive activity by editing `last_event.ts` freshness.

```bash
cd /Users/calypso/Project/Ottery/commit-quest/app
FAKE="$CLAUDE_JOB_DIR/tmp/fakehome2"; mkdir -p "$FAKE"
NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)
cat > "$FAKE/state.json" <<JSON
{ "version":1,"updated_at":"$NOW","xp_total":1200,"level":8,"xp_in_level":10,"xp_to_next":100,
  "stats":{"prompts":40,"actions":{"edit":20},"sessions":5,"by_source":{},"by_repo":{},"boss_defeated":0,"boss_fled":0},
  "class":{"line":"mage","tier":1,"form":"Backend Mage","icon":"⚔","affinity":{"mage":0.7,"ranger":0.1,"rogue":0.1,"sage":0.1}},
  "last_event":{"ts":"$NOW","type":"post_tool"},"inventory":[],"recent":[],"cosmetics":{} }
JSON
npm run build 2>&1 | tail -2
AGENTRPG_HOME="$FAKE" AGENTRPG_PORT=7172 nohup bun server.ts > "$CLAUDE_JOB_DIR/tmp/serve2.log" 2>&1 &
sleep 1.3
curl -s -o /dev/null -w "battle sprite %{http_code}\n" http://localhost:7172/sprites/mage/t1/walk/south/0.png
```

Then with Playwright: navigate `http://localhost:7172`, resize 420×720, screenshot. Fresh `last_event` ⇒ **Farming ⇒ Battle mode** (side-view, mobs + east-facing mage). To see **Overworld**, rewrite `last_event.ts` to ~2 minutes old (stale ⇒ Idle) so the guild room with the wandering mage shows; screenshot again. Confirm: battle looks unchanged; overworld shows the guild + a directional walking mage; the transition banner appears on the flip. Kill the server (`pkill -f "bun server.ts"`) and remove any screenshot artifacts when done.

- [ ] **Step 4: Commit**

```bash
cd /Users/calypso/Project/Ottery/commit-quest
git add app/src/components/scene-view.tsx
git commit -m "feat(app): switch scene by mode (battle vs guild) with transition"
```

---

## Task 11: Final integration — full build, suites, Prettier

**Files:** none (verification only)

- [ ] **Step 1: Full app + extension build/copy/package sanity**

```bash
cd /Users/calypso/Project/Ottery/commit-quest/app
npm run build 2>&1 | tail -2
node extension/scripts/copy-webview.mjs
ls extension/webview/sprites/mage/t1/walk/south | tr '\n' ' '; echo
```
Expected: build clean; copy prints the sprites line; `ls` shows `0.png … 8.png` (the new nested layout shipped).

- [ ] **Step 2: Both suites + typecheck**

```bash
cd /Users/calypso/Project/Ottery/commit-quest/app && bun test 2>&1 | grep -E "pass|fail"
cd /Users/calypso/Project/Ottery/commit-quest/app && bun run typecheck 2>&1 | tail -2
cd /Users/calypso/Project/Ottery/commit-quest/app/extension && bun test 2>&1 | grep -E "pass|fail"
```
Expected: all pass, 0 fail; typecheck clean.

- [ ] **Step 3: Prettier**

Run: `cd /Users/calypso/Project/Ottery/commit-quest && bun run format 2>&1 | tail -3`. If files changed: `git add -A && git commit -m "style: prettier"`.

---

## Self-Review (completed)

**Spec coverage:** Mode model §"Mode model" → Tasks 4 (`sceneModeFor`) + 10 (switch). Sprite system §1 → Tasks 1 (layout) + 2 (`Facing`) + 3 (manifest/hero). Wander §2 → Task 6. Guild room §3 → Tasks 7 (`OverworldHero`) + 8 (`OverworldRoom`). Battle reuse §4 → Task 9. SceneView switch §5 + transition → Tasks 5 (`bannerScene`) + 10. Fallback → Task 3 test (undefined) + Task 8 `.ow-hero:not(.has-art)::after`. Testing §"Testing" → Tasks 2/3/4/5/6 pure tests; components browser-verified (Task 10).

**Type consistency:** `Facing` (south/north/east/west), `facingFromDelta(dx,dy)`, `ISpriteSet { idle: Record<Facing,string>; walk: Record<Facing,string[]> }`, `heroSpriteSet(line,tier)`, `directionalFrames(set,facing,moving)`, `SceneMode`, `sceneModeFor(activity)`, `bannerScene(mode, sceneTheme)`, `stepWander(IStepWanderArgs)`, `IWanderPose`, `useWander(roaming)`, `OverworldHero` props `{line,tier,facing,moving,xPct,yPct}`, `OverworldRoom` props `{line,tier,activity}`, `BattleScene` props `{state,activity,sceneInfo,line,tier}` — consistent across tasks. `heroFrames` (PR #39) is fully removed in Task 3 and the only consumer (`hero.tsx`) is updated in the same task.

**Out of scope (per spec):** purposeful/reactive movement, multi-room, camera/scroll, battle rework, real guild tileset, true sit frame, diagonals, non-Mage-T1 art — none planned.
