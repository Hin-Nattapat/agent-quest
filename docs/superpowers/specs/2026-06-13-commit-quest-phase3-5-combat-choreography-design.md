# Phase 3.5 — AFK Combat Choreography + Animation State Machine design

> **Status:** design approved 2026-06-13. Plan: `docs/superpowers/plans/`.
> Builds on the reskin (3.4) + polish. Turns the static scene (hero + monster standing) into a
> living AFK combat loop driven by **real** signals, and produces the **list of animations to ask
> PixelLab to generate**. App-only except one small, idempotent reducer stat.

## Goal

While you code, the hero visibly fights the ambient monster: each bit of real XP lands a hit (with
a floating "+N XP"), the monster's cosmetic HP drains and it dies → a new one spawns; a real tool
failure makes the monster bite back (hero hurt); a level-up makes the hero celebrate. The
choreography is a client-side **animation state machine** over real state-diffs — and its design
doubles as the **PixelLab animation requirement list** (which poses/loops to generate, with frame
counts), built now with emoji/CSS placeholders behind the existing sprite seam.

## Design principles (from the AFK model)

- **Image ≠ numbers.** Every *trigger* is real (XP delta, failure delta, level delta, boss event,
  activity). The monster's HP is a **cosmetic** presentation value, never persisted, never "truth".
- **Honest floaters.** "+N XP" shows the real XP gained. A failure shows the hero getting hurt (a
  red flash), with **no fake damage number** (the hero has no HP).
- **Placeholder-first.** Build the whole state machine with emoji/CSS animations so it is visible
  and testable; real PixelLab sprite-sheets swap in later by editing CSS alone.

## Architecture

```
state.json (each push) ──► game-events.combatBeats(prev,next) ──► use-combat hook ──► hero/monster anim + floaters
                                  (pure diff)                       (timers, cosmetic HP, queue)
useActivity ──► activity (macro) ───────────────────────────────►  ┘
useEncounter ──► boss overlay (existing, unchanged) ─────────────►  scene-view
```

The one core change: a new **`stats.action_fails`** count (so the app can diff failures the same
way it diffs `boss_defeated`). Everything else is presentational in `app/`.

## The one core change: `stats.action_fails`

- `core/state.ts` — add `action_fails?: number` to `stats`.
- `core/reduce.ts` — during the fold, increment a counter on `EventType.ActionFail`; emit it as
  `stats.action_fails`. Idempotent (recompute from journal → same count). No other behavior changes.

## Signals → choreography (all triggers real)

| Signal | Source | Drives |
|---|---|---|
| activity (farming / idle / rest) | `useActivity` (existing) | macro state (rest hides combat; idle = no beats) |
| `xp_total` delta `> 0` | diff between state pushes | hero **attack** + floating **"+N XP"** + monster **hurt** (one hit) |
| `stats.action_fails` delta `> 0` | diff (new stat) | monster **attack** → hero **hurt** + red flash |
| `level` delta `> 0` | diff | hero **celebrate** (one-shot) |
| `boss_defeated` / `boss_fled` delta | `useEncounter` (existing) | boss encounter overlay (unchanged) |

## Data: pure combat-beats

`game-events.ts` gains a pure diff (alongside the existing `diffStates`):

```ts
export interface ICombatBeats {
  xp: number; // xp_total gained since prev (>= 0)
  hurt: boolean; // a new action_fail occurred
  leveledUp: boolean; // level increased
}

export const combatBeats = (prev: IState | null, next: IState): ICombatBeats => { … };
// null prev -> { xp: 0, hurt: false, leveledUp: false }
```

## Cosmetic monster HP (hit-count model)

To keep a **steady kill cadence** independent of XP magnitude (a batch of actions can be a big XP
delta), the monster is a fixed number of **hits**, not "HP = damage":

- `MONSTER_HITS = 5` (cosmetic constant). Each `xp > 0` beat = **one hit**.
- A pure helper `hitMonster(hits)` → `{ hits, died }`: `hits + 1`, `died = hits + 1 >= MONSTER_HITS`.
- On `died`: play monster **die** (one-shot), then **respawn** with `hits = 0`.
- The monster HP bar renders `(MONSTER_HITS - hits) / MONSTER_HITS`. Purely visual.

(The floating "+N XP" still shows the real N; the hit model only governs the death cadence.)

## Animation state machine

Highest-priority active animation wins; one-shots revert to the base when their timer ends. The
**base layer is the existing activity animation** (`farming` / `idle` / `rest` from `useActivity`,
already implemented in 3.2a); the combat one-shots override it temporarily.

**Hero** (priority high → low): `celebrate` (level-up, ~1.2s) → `hurt` (fail, ~0.5s) → `attack`
(xp beat, ~0.4s) → **base = activity** (`farming` / `idle` / `rest`).

**Monster** (priority high → low): `die` then `spawn` (HP empty) → `attack` (fail, ~0.5s) → `hurt`
(xp beat, ~0.3s) → `idle`/float (default). Hidden entirely while activity = Rest.

A pure resolver makes the priority testable:
`heroAnim({ celebrate, hurt, attack, activity }) → THeroAnim` (returns the activity value when no
one-shot is active) and `monsterAnim({ dying, attacking, hurt }) → TMonsterAnim`.

## Floating text

`floating-text.tsx` renders a small queue of transient floaters in the scene:
- `+N XP` (gold, rises + fades, ~900ms) on each `xp` beat.
- a red **hit flash** on the hero on each `hurt` beat (no number).
Each floater has a unique key; `use-combat` enqueues and auto-expires them.

## Files

| File | Responsibility | New/Mod |
|---|---|---|
| `core/state.ts` | `stats.action_fails?: number` | Modify |
| `core/reduce.ts` | count `action_fail` events | Modify |
| `app/src/game-events.ts` | `combatBeats(prev,next)` + `ICombatBeats` | Modify |
| `app/src/combat.ts` | `MONSTER_HITS`, `hitMonster`, `heroAnim`, `monsterAnim`, anim enums (pure) | Create |
| `app/src/use-combat.ts` | hook: diff → anim states + floaters + HP + respawn (timers) | Create |
| `app/src/components/hero.tsx` | accept hero anim state → class | Modify |
| `app/src/components/monster.tsx` | accept monster anim state + cosmetic HP bar | Modify |
| `app/src/components/floating-text.tsx` | render the floater queue | Create |
| `app/src/components/scene-view.tsx` | wire `useCombat`, pass anim states, render floaters | Modify |
| `app/src/styles.css` | keyframes: attack/hurt/celebrate/die/spawn, floater, monster HP bar | Modify |
| `core/state.ts` test + `app/src/*.test.ts` | reducer count, `combatBeats`, `hitMonster`, resolvers | Modify/Create |

## PixelLab animation requirement list (deliverable)

Update `art-prompts.md §3` with the full set this checkpoint exercises (placeholders now):

| Character | Animation | Type | Frames (suggested) | Used when |
|---|---|---|---|---|
| Hero | idle | loop | 2–4 | default / farming between beats |
| Hero | attack (cast) | one-shot | 4–6 | each XP beat |
| Hero | hurt | one-shot | 2–3 | on failure |
| Hero | celebrate | one-shot | 6–8 | level-up |
| Hero | walk | loop | 4–6 | *(deferred: monster-approach / transition)* |
| Monster | idle / float | loop | 2–4 | default |
| Monster | hurt | one-shot | 2–3 | hit by an XP beat |
| Monster | attack | one-shot | 4 | on failure (bites back) |
| Monster | die | one-shot | 4–6 | HP empty |
| Monster | spawn / approach | one-shot | 4 | *(deferred)* |

(Boss already has hit + flee from 3.2b.)

## Error handling

- First state (no prev) → no beats, no floaters; hero/monster sit in base idle/rest.
- A negative `xp_total` delta (shouldn't happen with the append-only journal) clamps to 0.
- Bursty pushes (several beats at once) are fine: floaters queue and stagger; the monster can take
  several hits in one push (cap the deaths/respawns processed per push at 1 to avoid flicker —
  excess hits roll into the next monster).
- Rest hides the monster mid-loop; the HP/anim reset on the next non-rest push.
- All animations honor `prefers-reduced-motion` (one-shots become instant; loops still convey state
  but without large motion).

## Testing

- **`core/reduce.ts`** (bun): a journal with N `action_fail` events → `stats.action_fails === N`;
  idempotent (fold twice → same); ordinary actions don't increment it.
- **`combatBeats`** (bun): xp delta, failure delta, level delta detected; null prev → zeros;
  negative xp clamps to 0.
- **`hitMonster`** (bun): increments; `died` true at `MONSTER_HITS`.
- **`heroAnim` / `monsterAnim`** (bun): priority order resolves correctly.
- **Hook / components / timers**: verified visually in the Extension Development Host (hero attacks
  as XP ticks, "+N XP" floats, monster HP drains → dies → respawns, a failure flashes hurt, a
  level-up celebrates).

## Scope / non-goals

- **Monster-approach walk** and **up-class world-transition** — deferred (own checkpoint; the hero
  `walk` + monster `spawn/approach` frames are listed for PixelLab but not wired here).
- **Real PixelLab sprite-sheets** — swapped behind the CSS seam later; this checkpoint ships emoji/
  CSS placeholder animations.
- **T4 realm mapping** — separate checkpoint.
