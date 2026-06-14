# Phase 3.8b — World Transition + Guild Scene design

> **Status:** design approved 2026-06-14. Plan: `docs/superpowers/plans/`.
> Two scene-swap features sharing one mechanism: (1) a **world-transition** (fade + realm banner)
> whenever the scene theme changes — tier-up, branch pick, or class pick; (2) a **guild scene** the
> hero rests in when fresh-opened or after a session ends. App-only, behind the sprite seam
> (CSS/emoji placeholders).

## Goal

- **World-transition:** when the rendered scene theme changes, instead of an instant snap, play a
  ~1.2s fade-out → a centered banner (a static **"Now Entering"** eyebrow above the destination
  label, e.g. "Skyforge Aether" / "The Guild") → fade-in. The single trigger is **"the scene theme
  changed"** — which naturally covers tier-up, branch pick, class pick, and field↔guild swaps. The
  banner shows `scene.label` verbatim, so no per-place phrasing logic is needed.
- **Guild scene:** the hero hangs at a warm town/guild backdrop when **fresh-opened** (SessionStart,
  not started working) or **after a session ends** (Rest). Out in the field he fights waves (Farming)
  or strolls (quiet mid-session Idle) exactly as 3.8a already does.

## Constraints

- **App-only, cosmetic.** No `core`/reducer change. Tier/branch/form already live in `state.class`;
  `last_event.type` already distinguishes a fresh `session_start` from quiet mid-work. `state` is
  imported type-only.
- **Behind the sprite seam.** Guild backdrop + transition are CSS/emoji placeholders; real art swaps
  in later by editing `styles.css`.
- **Reuse 3.8a.** The scene-director (waves/wander) is unchanged — it already produces no mobs when
  not Farming, so the guild (Rest / fresh-Idle) shows no monsters and the hero just strolls/idles.
- **Reduced motion.** The transition needs a `@media (prefers-reduced-motion: reduce)` path (instant
  swap / crossfade, no fade-to-black sweep).
- **Match-the-file style.** `app/src/` FE style; `export function`/arrow `const`; string enums; pure
  helpers + `use-*` hooks; `core` type-only.

## Architecture

```
state.class { tier, line, branch }   +   activity (Farming/Idle/Rest)   +   state.last_event.type
        │
        ▼
sceneNow({ activity, lastEvent, tier, line, branch })  → IScene  (PURE)
   place = Guild  when activity === Rest, OR (Idle AND last_event.type === session_start)
   place = Field  otherwise (Farming, or quiet mid-session Idle)
   Guild → GUILD_SCENE ({ theme: Guild, label: "The Guild", monster: "" })
   Field → sceneFor(tier, line, branch)                              (3.7, unchanged)
        │
        ▼
scene-view renders  .scene-${scene.theme}  +  AreaTag {scene.label}
useTransition(scene)  → detects scene.theme change (skip first mount) → holds a transition
   { active, label } for TRANSITION_MS  →  <WorldTransition> fade overlay + banner
   (the 3.8a director keeps driving mobs/hero independently; mobs only appear when Farming)
```

The key simplification: **`sceneNow` composes the place (guild vs field) into one `IScene`, and the
transition fires purely off `scene.theme` changing.** One rule, both features — opening the agent
(guild→realm), tiering up (realm→realm), and going home (realm→guild) all transition the same way.

## Pure core (testable in `bun test`)

### `scene.ts` (extend)
Add a guild theme + a guild scene constant:
```ts
export enum SceneTheme { /* …existing… */ Guild = "guild" }
export const GUILD_SCENE: IScene = { theme: SceneTheme.Guild, label: "The Guild", monster: "" };
```

### `scene-place.ts` (new) — where is the hero right now
```ts
import { EventType } from "../../core/events";
import { ActivityState } from "./activity";
import { type IScene, sceneFor, GUILD_SCENE } from "./scene";
import type { IState } from "../../core/state";

export enum ScenePlace { Guild = "guild", Field = "field" }

// Guild when resting (session ended) or freshly opened (session_start, nothing done yet).
export const placeFor = (activity: ActivityState, lastEvent: IState["last_event"]): ScenePlace => {
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
`EventType` is the shared wire contract (allowed at runtime in `app/` per `app/CLAUDE.md`).

## The transition (hook + overlay — verified visually)

### `use-transition.ts` (new)
Watches the composed scene's `theme`; when it changes (and a previous theme existed — **never on
first mount**), it records an active transition carrying the **destination** label for
`TRANSITION_MS` (~1200ms), then clears it. StrictMode-safe (timer cleared on unmount). Returns:
```ts
export interface ITransitionView { active: boolean; label: string | null; }
export function useTransition(scene: IScene): ITransitionView;
```
Implementation: a `useRef` holds the last-seen theme; a `useEffect([scene.theme])` compares, sets
`{ active: true, label: scene.label }`, and schedules a timeout to set `active: false`.

### `components/world-transition.tsx` (new)
A full-bleed overlay rendered only while `active`: a fade layer that darkens then clears, with a
centered pixel banner — a static **"Now Entering"** eyebrow above the destination `label` (the realm
name, or "The Guild"). Uniform for every place, so the component needs no place logic. Pure
presentational — props `{ active, label }`.

## Components / files

| File | Responsibility | New/Mod |
|---|---|---|
| `app/src/scene.ts` | `SceneTheme.Guild` + `GUILD_SCENE` const | Modify |
| `app/src/scene-place.ts` | `ScenePlace`, `placeFor`, `sceneNow` (pure) | Create |
| `app/src/scene-place.test.ts` | unit tests for `placeFor` / `sceneNow` | Create |
| `app/src/use-transition.ts` | theme-change → timed transition hook | Create |
| `app/src/components/world-transition.tsx` | fade overlay + realm banner | Create |
| `app/src/components/scene-view.tsx` | swap `sceneFor(...)` → `sceneNow({...})`; add `useTransition` + `<WorldTransition>` | Modify |
| `app/src/styles.css` | `.scene-guild .sky` warm backdrop (+ a couple of guild decor placeholders); `.world-transition` fade + `.world-banner`; reduced-motion | Modify |
| `docs/reference/art-prompts.md` | note the guild backdrop + world-transition as a new art target | Modify |

`scene-view` change: replace `const sceneInfo = sceneFor(state.class?.tier ?? 0, …)` with
`const sceneInfo = sceneNow({ activity, lastEvent: state.last_event, tier: state.class?.tier ?? 0,
line: state.class?.line, branch: state.class?.branch })`, then
`const transition = useTransition(sceneInfo)` and render `<WorldTransition active={transition.active}
label={transition.label} />` inside the scene. The `.scene-${sceneInfo.theme}` class and
`<AreaTag label={sceneInfo.label}>` already read from `sceneInfo`, so the guild backdrop + label come
for free.

## Data flow & edge cases

- **First mount:** `useTransition` records the initial theme without firing (no "from" world → no
  flash on load).
- **No flapping:** quiet mid-session Idle stays `Field` (same theme as Farming), so Farming↔Idle does
  **not** transition. Only guild↔field and realm↔realm flip the theme.
- **Guild shows no mobs:** the 3.8a director yields `mobs: []` whenever not Farming, so Rest /
  fresh-Idle (both non-Farming) already render an empty guild. No director change.
- **Hero in guild:** non-Farming → director's Wander phase → `HeroAnim.Wander` stroll. The hero
  "เดินเล่นในกิล" as intended; no special-casing.
- **Missing `last_event`:** `placeFor` treats it as not-SessionStart → Field (matches `activityState`,
  which returns Idle for a null event). Defensive, no crash.

## Testing

`bun test`:
- **`placeFor`**: Rest → Guild; Idle + `session_start` → Guild; Idle + a work event → Field; Farming
  → Field; null `lastEvent` → Field.
- **`sceneNow`**: guild place → `GUILD_SCENE` (theme Guild, label "The Guild"); field place → matches
  `sceneFor(tier,line,branch)` (e.g. T4 mage/a → Skyforge Aether; T1 → Grassland).
- Visual (VS Code panel): open agent → guild backdrop, hero strolling, no mobs; first action → fade
  + "Entered: <realm>" → field with waves; tier-up → realm→realm transition; end session → fade →
  "The Guild"; reduced-motion → instant swap.

## Scope / non-goals

- **Transition style = fade + banner (option A).** No portal sprite, no hero-walks-through-a-door
  (that's a later upgrade once real sprites land).
- **Guild backdrop = CSS gradient + a few emoji decor** placeholders; real town/guild art later.
- **No new core/reducer field, no new event.** Everything derives from existing `state`.
- **Boss encounter unchanged** — it still pre-empts the field; a boss cannot occur in the guild
  (guild is non-Farming, and encounters are rate-based on actions which only happen while working).
