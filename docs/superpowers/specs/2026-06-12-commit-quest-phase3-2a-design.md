# Commit Quest — Phase 3.2a Design (AFK farming scene)

> Second slice of Phase 3 (the companion app). 3.1 put a live progression HUD on `state.json`.
> 3.2a turns it into an **MMORPG AFK-farming scene**: the hero animates in three states
> (farming/idle/rest), and the **scene + monster change by class tier**. Theme is full fantasy
> MMORPG — no "office". Conventions: `CLAUDE.md` + `app/CLAUDE.md` (hook-driven React).

---

## 1. What 3.2a proves

The companion shows a fantasy hero in a **tier-themed scene** (grassland → forest → dungeon →
secret realm) who **farms monsters while the agent is active**, stands idle when nothing is
happening, and **rests in the tavern** after a session ends. The animation is decoupled from
individual tools — the depth stays in the numbers (`state.json`), the picture is a light AFK
loop. Real PixelLab sprites swap in later behind a sprite seam; 3.2a ships with placeholders.

## 2. Locked decisions (brainstorm 2026-06-12)

| # | Topic | Decision |
|---|---|---|
| G1 | Theme | **Full MMORPG fantasy** (hero, not a desk worker). Re-skins the HUD card into a fantasy scene; classes/deeds/titles are already medieval. |
| G2 | Animation model | **AFK farming** — three states only: **farming** (active), **idle** (no activity), **rest** (session ended). No per-tool poses → light renderer, no pacing problem, fits the throttled reduce (only "active?" is needed). |
| G3 | Image ≠ numbers | Animation is generalized; **XP / affinity (§6.4) / loot stay computed from real events** in the reducer. Depth lives in the numbers flowing in, not in distinct poses. |
| G4 | Scene/monster axis | **Tier (5 tiers), not level or repo.** `repo` stays a stat (`by_repo`); it never drives the picture (unpredictable, often many at once). |
| G5 | Active signal | The reducer adds `last_event { ts, type }`; the **app** decides state with a pure `activityState(lastEvent, now)` + a client timer (the reducer stays time-free/idempotent). `ACTIVE_WINDOW` = **60 s**. **Lifecycle events are not "work":** `session_end` → `rest`, `session_start` → `idle` (farming begins only on a real recent work event — action/prompt/…). |
| G6 | 3.2a scope | Scene + hero + the **three animation states** + tier-driven scene/monster + the HUD overlay, with **placeholder sprites**. Boss events (`action_fail`), loot-drop visuals, and the up-class world-transition are **3.2b**; branch (T4 a/b) realms are **3.2c**. |
| G7 | Build as a skeleton | Components are **structure only** (semantic CSS classes, empty elements); **all visuals live in `styles.css`** (placeholder now). Real PixelLab sprite-sheets + animations swap in by editing CSS only — one surface, no component churn. |

## 3. Architecture

```
 reducer adds last_event{ts,type} ─► state.json ─SSE─► app
                                                         ├─ useGameState → IState
                                                         ├─ useActivity → activityState(last_event, now)  [pure + client timer]
                                                         └─ SceneView(state, activity):
                                                              sceneFor(class.tier) → theme + monster   [pure]
                                                              <Scene bg> <Monster> <Hero activity> <Hud overlay>
```

Only one small `core` change (the `last_event` field); everything else lives in `app/`. The
renderer reuses the 3.1 transport seam and the `Hud` component (now an overlay).

## 4. The active signal

**Reducer (`core/reduce.ts` + `core/state.ts`):** after the sorted fold, record the latest event:
`state.last_event = { ts, type }` from the last element of the `ts`-sorted events (or omit when the
journal is empty). Deterministic and idempotent — it is a fact about the journal, not wall-clock.

**App (`app/src/activity.ts`, pure, tested):**
```ts
export enum ActivityState {
  Farming = "farming",
  Idle = "idle",
  Rest = "rest",
}
export const ACTIVE_WINDOW_MS = 60_000;

// now is wall-clock ms; the reducer never sees it, so it stays time-free/idempotent.
export function activityState(
  lastEvent: IState["last_event"],
  now: number,
  windowMs = ACTIVE_WINDOW_MS,
): ActivityState {
  if (!lastEvent) return ActivityState.Idle;
  if (lastEvent.type === EventType.SessionEnd) return ActivityState.Rest;
  if (lastEvent.type === EventType.SessionStart) return ActivityState.Idle; // opened, not working yet
  return now - Date.parse(lastEvent.ts) < windowMs ? ActivityState.Farming : ActivityState.Idle;
}
```

**Client timer (`app/src/use-activity.ts`):** while idle, `state.json` doesn't change, so the bridge
sends no push — the hook keeps a `now` in state, bumps it every ~5 s, and re-derives, so
farming→idle happens on time without a new event.

`app/` may import the **events contract** (`EventType` enum + types) from `core/events.ts` — it is the
shared wire contract, like `IState`. Game logic (reduce/classes/…) stays out of the bundle.

## 5. Scene mapping (`app/src/scene.ts`, pure, tested)

```ts
export enum SceneTheme {
  Grassland = "grassland",
  Forest = "forest",
  Dungeon = "dungeon",
  SecretRealm = "secret_realm",
}
export interface IScene { theme: SceneTheme; label: string; monster: string; }

export function sceneFor(tier: number): IScene { … }
```

| tier | theme | label | monster (placeholder) |
|---|---|---|---|
| 0–1 | Grassland | "Grassland outside town" | bug slime 🟢 |
| 2 | Forest | "Whispering Forest" | error wraith 👻 |
| 3 | Dungeon | "The Deep Dungeon" | dungeon brute 👹 |
| 4 | Secret Realm | "Secret Realm" | realm king 👑 |

Tier comes from `state.class?.tier ?? 0`. Branch-specific T4 realms (Cloud vs Kernel, …) are 3.2c.

## 6. Renderer — a CSS skeleton (G7)

3.2a is a **template/skeleton**: components emit **structure only** — empty elements with semantic
classes — and **`styles.css` owns every visual**. Placeholders today (emoji via `::after content`,
gradient backgrounds, simple keyframes); real PixelLab sprite-sheets + animations (`steps()`, design
§10.3) drop in by editing **CSS alone** — the single swap surface, no component churn.

- `components/scene-view.tsx` — `(state, activity)` → `<div class="scene scene-<theme>">` containing
  `<Monster>`, `<Hero>`, and the `<Hud>` overlay. Layout/positioning only.
- `components/hero.tsx` — `(activity, line)` → `<div class="sprite hero hero-<line> hero-<activity>">`
  (empty). CSS renders the placeholder + the per-state animation (`hero-farming` bob, `hero-idle`
  sway, `hero-rest` sit).
- `components/monster.tsx` — `(scene)` → `<div class="sprite monster monster-<theme>">` (empty;
  hidden in `rest`). CSS renders it.
- `app.tsx` — `useGameState` + `useActivity` → `<SceneView>` (replaces the bare `<Hud>`).
- `styles.css` — **the art surface:** tier backgrounds, the placeholder hero/monster visuals, and the
  three hero animations, each marked as a sprite-swap point.

## 7. Components

| File | Change |
|---|---|
| `core/state.ts` | `last_event?: { ts: string; type: EventType }` |
| `core/reduce.ts` | set `last_event` from the latest sorted event |
| `app/src/activity.ts` | `ActivityState` enum + `activityState()` (new) |
| `app/src/scene.ts` | `SceneTheme` + `sceneFor()` (new) |
| `app/src/use-activity.ts` | `useActivity(state)` hook + client timer (new) |
| `app/src/components/{scene-view,hero,monster}.tsx` | the scene (new) |
| `app/src/app.tsx` | render `<SceneView>` instead of `<Hud>` |
| `app/src/styles.css` | tier backgrounds + activity animations |
| `app/CLAUDE.md` | note: the events contract (`EventType`) may be imported, game logic may not |

## 8. Testing

- **`core/reduce.test.ts`** — `last_event` is the latest event by `ts` (`{ts,type}`); absent for an
  empty journal; idempotent on recompute.
- **`app/src/activity.test.ts`** — `activityState`: recent work event → `Farming`; old event →
  `Idle`; `session_end` → `Rest`; `session_start` → `Idle`; no event → `Idle`; the `now − ts ===
  window` boundary.
- **`app/src/scene.test.ts`** — `sceneFor` for tiers 0/1/2/3/4 (theme + monster).
- **Manual (UI):** open the app; with the agent active the hero farms; pause ~60 s → idle; the scene
  matches the current tier; a `rpg respec`/level change swaps the scene. (Presentational React +
  the timer are verified visually, per the 3.1 precedent.)

## 9. Definition of done

1. `bun test` green (core + the new `app/*.test.ts`); `bunx tsc --noEmit` (root) + `tsc -p app` clean;
   `bun run format:check` clean; `vite build` succeeds.
2. The live app shows a tier-themed scene with a hero that is **farming while active, idle when quiet,
   resting after a session ends**, and the scene/monster reflect the current class tier.
3. The reducer's `last_event` is the only `core` change; `activityState`/`sceneFor` are pure and
   covered.

## 10. Out of scope (→ later)

- **3.2b:** `action_fail` → a boss appears; recovery/test-pass → boss down + XP/loot-drop visual; the
  **up-class world-transition** animation; the **monster-approaches-the-hero** walk animation (needs
  design — placeholder monster is static in 3.2a).
- **3.2c:** branch (T4 a/b) secret realms + per-realm bosses.
- **Art integration:** real PixelLab sprite-sheets + CSS `steps()` / Canvas animation + costume-by-tier
  (the hero's look changing per tier) — drops in behind the sprite seam.
- Multi-character; leaderboard; the model/cost/ctx tail in the scene HUD.
