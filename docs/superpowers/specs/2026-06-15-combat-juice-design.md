# Commit Quest — combat juice (snappy attack + hit feedback + FF2 formation)

> **Status:** design approved 2026-06-15 (feel locked via animated mockup). Plan: `docs/superpowers/plans/`.
> Make the side-view scene combat read as a real fight: the hero strikes continuously while farming
> (not lagging behind XP pushes), each strike is a short-but-snappy dash-jab with recoil + hit
> feedback, and the pack stands in a staggered FF2 formation instead of a flat row.
> **Deferred (not this spec):** idle/guild walk-around and the scene's camera perspective — both wait
> on a later "scene view" decision. No new art; emoji placeholders stay (the sprite seam is untouched).

## Goal

Three changes to the existing living-scene combat (`app/src/`), all presentational and behind the
sprite seam:

1. **No more lag.** The hero currently only strikes when `combatBeats` sees `xp_total` rise — which
   trails the real action by the reduce-throttle + transport latency, so the hero stands idle between
   XP pushes. Drive strikes from the director's own tick instead (still paced by `STRIKE_THROTTLE_MS`),
   so combat is continuous while `activity === Farming`.
2. **Snappy dash-jab.** Replace the soft 14px / 0.4s lunge with a short (~40px) but fast forward +
   recoil + impact hold, on a sharp easing — reads as "hit", not "slide". Plus a stronger mob hurt
   (flinch + brightness flash); the slash hit-effect already exists.
3. **FF2 formation.** Mobs get a per-slot `{ right, bottom }` (staggered diagonal cluster) instead of
   the same `bottom` for every slot (a flat row).

## Architecture

App-only, presentational. The director (`use-scene-director`) already owns the strike fan-out
(`pulse(setAttacking…)`, hit-effect, mob hurt) and a 250ms tick; the only behaviour change is **what
the tick passes to `advance`** (`true` so it can strike, gated by the existing throttle). Mob layout
moves from a right-only `slotRight` to a `slotPos → { right, bottom }` consumed by `Monster` and
`HitEffects` (so the slash lands on the staggered mob). Animation feel is CSS keyframes whose
durations stay in sync with the `HERO_MS`/`MON_MS` constants (the file already documents this
contract). All new motion is covered by the existing `prefers-reduced-motion` block.

## Components / files

| File | Change |
|---|---|
| `app/src/use-scene-director.ts` | tick calls `advance(true)` (was `false`) → continuous strikes in Engage; `HERO_MS.attack` 400 → 280 and `MON_MS.hurt` 300 → 360 to match the new keyframes |
| `app/src/scene-phase.ts` | unchanged logic; `STRIKE_THROTTLE_MS` stays 700 (the pacing knob, now actually driving the rhythm) |
| `app/src/mob-slots.ts` | `slotPos(slot): { right: string; bottom: string }` — staggered FF2 formation, slot 0 front-most; keep it the single source both Monster and HitEffects import |
| `app/src/components/monster.tsx` | position the unit with `slotPos(slot)` (`right` + `bottom`) instead of `slotRight` |
| `app/src/components/hit-effect.tsx` | place the slash at `slotPos(e.slot)` (`right` + `bottom`) so it lands on the struck mob (was fixed `bottom: 30%`) |
| `app/src/styles.css` | `hero-attack` keyframe → snappy jab (fast ~40px forward, 1-frame hold, recoil, return) on a sharp bezier; `m-hurt` → flinch (translateX) + brightness flash; `.monster-unit` drops its fixed `bottom` (now set inline) |
| `test/…` / `app/src/*.test.ts` | `slotPos` returns distinct staggered `{right,bottom}` per slot; `mob-slots` stays the shared list |

**Out of scope:** `use-scene-director` hook timing is verified in the browser (the pure
`stepDirector` strike/throttle logic is already covered by `scene-phase.test.ts` and is unchanged).

## Details

### 1. Continuous strikes (the "lag" fix)
`use-scene-director.ts`, the low-frequency tick:
```ts
const id = setInterval(() => advance(true), TICK_MS); // was advance(false)
```
`stepDirector` only mutates the pack when `wantStrike && now - lastStrikeAt >= STRIKE_THROTTLE_MS`, so
the hero jabs at most every 700ms; the fan-out `pulse`/hit-effect only fires when a strike actually
lands (`next.pack[idx] !== before.pack[idx]`). The XP-beat effect keeps firing the XP floater (real
feedback) and may also `advance(true)` — harmless, the throttle dedupes. During Wander/Idle/Rest the
phase ignores `wantStrike`, so nothing strikes.

### 2. Snappy attack + hit feedback (CSS + constants)
`hero-attack` (≈0.28s, sharp in / recoil out):
```css
.hero-attack { animation: hero-attack 0.28s cubic-bezier(0.85, 0, 0.15, 1); }
@keyframes hero-attack {
  0%   { transform: translateX(0); }
  45%  { transform: translateX(40px); }   /* fast forward */
  55%  { transform: translateX(40px); }   /* impact hold */
  78%  { transform: translateX(-5px); }   /* recoil */
  100% { transform: translateX(0); }
}
```
`m-hurt` (flinch + flash, ≈0.36s):
```css
.m-hurt { animation: m-hurt 0.36s ease-out 1; }
@keyframes m-hurt {
  0%   { transform: translateX(0); filter: none; }
  30%  { transform: translateX(7px) scale(0.92); filter: brightness(2.2) saturate(0.4); }
  100% { transform: translateX(0); filter: none; }
}
```
Sync `HERO_MS.attack = 280` and `MON_MS.hurt = 360` so the transient classes clear exactly when their
keyframes end. The existing `.hit-effect` slash (gradient + drop-shadow, 0.32s) is kept.

### 3. FF2 formation
`mob-slots.ts`:
```ts
const MOB_SLOTS = [
  { right: "13%", bottom: "20%" }, // slot 0 — front (struck first)
  { right: "22%", bottom: "30%" }, // slot 1 — mid
  { right: "16%", bottom: "42%" }, // slot 2 — back
];
export const slotPos = (slot: number) => MOB_SLOTS[slot] ?? MOB_SLOTS[MOB_SLOTS.length - 1];
```
`Monster` sets `style={{ right, bottom }}` from `slotPos(slot)`; `.monster-unit` loses its fixed
`bottom: 24%`. `HitEffects` sets the slash `style={{ right, bottom }}` from `slotPos(e.slot)`. Exact
percentages are tuned in the browser; slot 0 must be the front-most (lowest) since `firstAlive` strikes
index 0 first.

## Error handling / edge cases

- **`slotPos` out of range** → clamps to the last slot (packs are ≤3, but defensive).
- **Reduced motion** → `.hero-attack`, `.m-hurt`, `.m-die`, `.hit-effect`, `.mob-spawn` are already in
  the `prefers-reduced-motion: reduce { animation: none }` block; the new keyframes inherit that. The
  formation (static `{right,bottom}`) is unaffected.
- **Idle/Rest** → no strikes (phase Wander); the continuous-strike change only acts in Engage.
- **Boss encounter active** → mobs/hit-effects aren't rendered (the encounter overlay replaces them),
  so the formation change can't collide with the boss.

## Testing

- `mob-slots`: `slotPos(0/1/2)` returns three distinct `{right,bottom}`; out-of-range clamps to the
  last. (pure unit test)
- `stepDirector` strike/throttle is already covered (`scene-phase.test.ts`) and unchanged.
- The tick→strike wiring, snappy easing, and formation/slash alignment are verified in the browser
  (Vite `serve` + the real `state.json`) at a short-wide panel size, since they are CSS/hook visuals.

## Scope / non-goals

- **No idle/guild walk-around** and **no camera-perspective change** — deferred to a later "scene view"
  decision (walk axes depend on it).
- **No new art** — emoji placeholders stay; the sprite seam (`background-image`) is untouched, so real
  PixelLab sprites later inherit all of this motion for free.
- **No combat-model change** — XP still drives XP; only the *visual* strike cadence is decoupled from
  XP-push latency.
