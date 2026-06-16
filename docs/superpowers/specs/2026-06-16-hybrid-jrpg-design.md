# Hybrid JRPG Engine — Design

**Status:** approved
**Date:** 2026-06-16
**Scope:** `app/` companion (Vite + React 19). Pure consumer of `state.json` — no `core/` changes.
**Builds on:** the frame renderer (PR #39, branch `feat/frame-renderer`). This branch is stacked on it; the multi-direction sprite system extends that PR's `sprites.ts` / `hero.tsx` / `use-sprite-frame.ts` and the `public/sprites/` layout.

## Goal

Turn the single side-view scene into a **hybrid JRPG**: a top-down walkable **guild room** (the hero roams in 4 directions using the PixelLab walk frames) when the dev is idle/resting, and the existing **side-view battle** (FF2 formation + combat juice) when the dev is actively coding. A mode transition swaps between them. This finally uses the full PixelLab export (4-direction walk + directional stills) instead of the east-only sliver.

## Why

PixelLab's "Low Top-Down" export gives 8 directional stills + a 4-direction (N/S/E/W) walk cycle of 9 frames each. The current renderer (PR #39) consumes only the east-facing still + east walk, wasting ~7/8 of the art because the scene is side-view. A top-down overworld is the asset's native fit and delivers the long-wanted "walk around the guild while idle" ambience.

## Decisions (settled during brainstorming)

- **Overworld = one fixed guild room**, no scrolling/camera (fits the narrow VS Code sidebar panel). Multi-room/zones are out of scope.
- **Movement = ambient autonomous wander** (waypoint roam + pauses). Purposeful movement (walk-to-chest, greet NPC) and reactive event juice are out of scope.
- **Rest** → hero stands at a fixed rest spot facing south with a 💤 floater (no true "sit" frame exists yet; gen one later).
- **Battle mode = the existing side-view combat scene, reused as-is.** No combat rework.
- **Art** = CSS placeholders for the guild room (like the approved `~/cq-overworld.html` mockup); real tileset later behind the same CSS seam. Only Mage T1 has a sprite; all other forms/Novice fall back to the existing emoji.

## Mode model

`SceneView` picks the central scene by activity. The portrait frame, sidebar, activity bar, floating panels, and world-transition are **mode-independent overlays** — only the central scene swaps.

| `ActivityState` | Mode | Central scene |
|---|---|---|
| `Farming` | **Battle** | side-view combat (existing `useSceneDirector` + `Monster` + `HitEffects` + `FloatingText` + battle `Hero`) |
| `Idle` | **Overworld** | guild room, hero wanders 4-dir |
| `Rest` | **Overworld** | hero idle at the rest spot + 💤 |

```ts
export enum SceneMode {
  Battle = "battle",
  Overworld = "overworld",
}

export const sceneModeFor = (activity: ActivityState): SceneMode =>
  activity === ActivityState.Farming ? SceneMode.Battle : SceneMode.Overworld;
```

Switching modes reuses the existing `WorldTransition` (fade + banner): "Entering Battle" when `Battle` becomes active, "Returning to Guild" when `Overworld` resumes.

## Components

### 1. Multi-direction sprite system (extends PR #39)

**`Facing` enum** (string values match the PixelLab folder names and are the wire/lookup keys):

```ts
export enum Facing {
  South = "south",
  North = "north",
  East = "east",
  West = "west",
}
```

**Folder layout — grouped by action, then direction** (readable, extensible):

```
public/sprites/<line>/t<tier>/
  idle/  south.png  north.png  east.png  west.png
  walk/  south/0.png … 8.png
         north/0.png … 8.png
         east/0.png  … 8.png
         west/0.png  … 8.png
```

This replaces PR #39's flat `idle.png` + `walk-0..8.png`. The raw PixelLab export already has every needed frame under `art/pixellab/T1_Backend_Mage/` (`rotations/<dir>.png`, `animations/walking_forward/<dir>/frame_00N.png`); we extract the four cardinal directions.

**Manifest** (`sprites.ts`) becomes directional:

```ts
export interface ISpriteSet {
  idle: Record<Facing, string>;
  walk: Record<Facing, string[]>;
}
export const heroSpriteSet = (line: string, tier: number): ISpriteSet | undefined => { … };
```

Missing key → `undefined` → emoji fallback (unchanged safety net; only `mage-t1` exists).

A small selector returns the frame list for a facing + moving flag:

```ts
export const directionalFrames = (set: ISpriteSet, facing: Facing, moving: boolean): string[] =>
  moving ? set.walk[facing] : [set.idle[facing]];
```

**Battle `Hero` (existing, minimally adapted):** keeps its `HeroAnim`-driven CSS keyframes over a still; reads the **east** entries from the new directional manifest (`set.idle.east` / `set.walk.east`) so the PR #39 behavior is preserved through the manifest shape change. No visual change to battle.

**`OverworldHero`** (new): cycles directional walk frames. Props `{ line, tier, facing, moving }`; uses `directionalFrames` + the existing `useSpriteFrame`.

### 2. Wander movement — `use-wander.ts`

A hook that roams the hero between waypoints expressed in **percentage** room coordinates (so it adapts to the panel's width/height), computing facing from the movement vector and pausing between legs.

Pure, testable core:

```ts
export const facingFromDelta = (dx: number, dy: number): Facing => {
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? Facing.East : Facing.West;
  }
  return dy > 0 ? Facing.South : Facing.North;
};

export interface IWanderPose { xPct: number; yPct: number; facing: Facing; moving: boolean; }

// advance one tick toward `target`; returns new pose + whether the waypoint was reached.
export const stepWander = (props: IStepWanderArgs): { pose: IWanderPose; reached: boolean } => { … };
```

The hook drives `stepWander` with `requestAnimationFrame` dt, picks the next waypoint on arrival, and holds a randomized pause (idle) before the next leg. `prefers-reduced-motion` → hero holds still at a waypoint (no roaming).

For **Rest**, the hook is bypassed: the hero is pinned to a fixed rest-spot percentage coordinate, `facing: South`, `moving: false`.

### 3. Guild room — `overworld-room.tsx`

The top-down room: CSS-placeholder floor (tiles) + a few decor elements (banner, table, rug, chest, an NPC emoji), a title, a hint line — matching the approved mockup. Hosts `OverworldHero` (positioned by the wander pose) with a soft drop shadow, plus a 💤 floater during Rest. Real tileset art swaps in later behind the same `background-image` seam used elsewhere.

### 4. Battle — reuse

The current side-view scene graph (`useSceneDirector`, `Monster`, `HitEffects`, `FloatingText`, battle `Hero`) is extracted into a `BattleScene` grouping (if not already cohesive) and rendered only when `SceneMode.Battle`. Its logic is untouched.

### 5. `SceneView` — the switch

`SceneView` computes `sceneModeFor(activity)` and renders `BattleScene` or `OverworldRoom`, wrapped by the existing overlays and `WorldTransition`. The transition fires on mode change.

## Data flow

`state.json` → `useActivity` (Farming / Idle / Rest) → `SceneView` → `sceneModeFor` →
- **Battle:** existing `useSceneDirector` path (unchanged), or
- **Overworld:** `use-wander` (or Rest pin) → `OverworldHero` → directional manifest + `useSpriteFrame`.

No transport or `core/` changes — entirely consumer-side, honoring the `app/` seam (type-only `IState`).

## Error handling / fallback

- **No art for `(line, tier)`** → `heroSpriteSet` returns `undefined` → both battle Hero and OverworldHero fall back to the emoji placeholder (the guild room still renders; the hero is an emoji that wanders).
- **`prefers-reduced-motion`** → wander holds still; walk frames don't cycle (handled by `useSpriteFrame`).
- **Unknown facing files** → manifest lists only existing files.

## Testing (bun test, pure-helper level; no jsdom)

- `sceneModeFor(activity)` → Battle for Farming, Overworld otherwise.
- `facingFromDelta(dx, dy)` → correct cardinal for each quadrant and the axis-tie rule (dx==dy favors vertical via the `>` test).
- `stepWander(...)` → moves toward target at `speed*dt`, clamps at the target (reached=true within epsilon), sets facing from the delta.
- `heroSpriteSet` → `mage-t1` resolves a full `Record<Facing,...>` (4 idle + 4×9 walk); unknown → `undefined`.
- `directionalFrames(set, facing, moving)` → `walk[facing]` when moving, `[idle[facing]]` otherwise.
- Overworld/Hero rendering verified in the browser (serve + Playwright), not unit-rendered.

## File structure (new / changed)

- `app/public/sprites/mage/t1/idle/*.png` + `walk/<dir>/*.png` — re-extracted 4-direction frames (replaces flat layout).
- `app/src/facing.ts` — `Facing` enum (+ `facingFromDelta` may live here or in `use-wander.ts`).
- `app/src/sprites.ts` — directional `ISpriteSet` + `heroSpriteSet` + `directionalFrames` (modify).
- `app/src/components/hero.tsx` — read east from directional manifest (modify, no behavior change).
- `app/src/use-wander.ts` — `stepWander` pure + `useWander` hook (create).
- `app/src/components/overworld-hero.tsx` — directional walking sprite (create).
- `app/src/components/overworld-room.tsx` — guild room (create).
- `app/src/scene-mode.ts` — `SceneMode` enum + `sceneModeFor` (create).
- `app/src/components/battle-scene.tsx` — extract the existing side-view scene graph (create/refactor).
- `app/src/components/scene-view.tsx` — switch on `SceneMode`, wire transition (modify).
- `app/src/styles.css` — guild room + overworld hero styles (modify).

## Out of scope (deliberate)

Purposeful movement (walk-to-chest, NPC greet), reactive event-driven motion, multi-room zones, camera/scrolling, battle rework, real guild tileset art, a true "sit" frame, diagonal walk, and any line/tier beyond Mage T1. Each layers onto this core without a rewrite.
