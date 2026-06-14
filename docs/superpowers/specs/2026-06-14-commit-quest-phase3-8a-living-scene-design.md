# Phase 3.8a — Living Scene (wave-paced combat + idle wander) design

> **Status:** design approved 2026-06-14. Plan: `docs/superpowers/plans/`.
> Turns the always-on single ambient monster into a **paced "living scene"**: the hero strolls the
> field when the agent is quiet, and fights **waves of 1–3 monsters FF-style** (step-forward strikes
> + hit effects) when the agent is active — with rest gaps so it never grinds non-stop. App-only,
> cosmetic, behind the existing sprite seam (emoji + CSS placeholders).

## Goal

The scene reads as alive and *paced*, not a treadmill:
- **Quiet (Idle/Rest):** hero **wanders** — strolls left/right — for visual rest; no monsters.
- **Active (Farming):** a **wave of 1–3 monsters** pops in; the hero fights them one at a time
  Final-Fantasy-style (lunge in → slash effect → target flash + shake → dissolve on kill), then a
  short **rest gap** (hero wanders) before the next wave.

The single lone monster "moonwalking in on every respawn" problem is avoided entirely: monsters
**pop in place** (no walking), the only locomotion is the hero's calm wander between waves.

## Constraints

- **App-only, cosmetic.** No `core/`/reducer change. Ambient waves/kills drop **nothing** — loot
  stays gated by the rate-based **boss** encounter (`boss_rate`, unchanged). The wave pacing is a
  *visual/feel* control only (user-confirmed: "แค่เรื่องภาพ/ความรู้สึกพอ ไม่ต้องแตะ core").
- **Numbers stay real.** XP bar/level/affinity still follow real events exactly ("image follows
  numbers"). The director only paces the *combat presentation* — it batches strikes into waves and
  inserts lulls; it never invents or withholds XP.
- **Behind the sprite seam.** Everything is emoji + CSS keyframes now (lunge/flash/shake/slash/
  spawn-pop/dissolve/stroll); real PixelLab sheets swap in later by editing `styles.css`.
- **Match-the-file style.** `app/src/` is FE-style: `export function`/`export const` arrows, string
  enums (PascalCase members), `use-*` hooks own logic, components presentational, `core` imported
  type-only.
- **Reduced motion.** Every animation needs a `@media (prefers-reduced-motion: reduce)` path (keep
  flash, drop lunge/shake/stroll → crossfade/instant).

## Architecture

A thin **scene director** sits between the existing activity signal and the view, owning a 2-state
phase machine. It subsumes the current `useCombat` (single-monster) into a pack-aware paced loop.

```
activityState(last_event, now)  ──►  Farming | Idle | Rest      (exists, unchanged)
combatBeats(prev, next)         ──►  { xp, hurt, leveledUp }     (exists, unchanged)
        │
        ▼
useSceneDirector(state, activity)
   phase: Wander ⇄ Engage
     Idle/Rest, or a rest-gap between waves  → Wander  (hero strolls; pack empty)
     Farming and past the rest-gap           → Engage  (spawn pack of packSize(waveIndex))
     pack cleared → REST_GAP_MS of Wander → re-Engage if still Farming
   strikes are THROTTLED (≈1 per STRIKE_THROTTLE_MS), spending accumulated xp beats onto firstAlive
        │
        ▼
view: { phase, heroAnim, pack: [{ anim, hpFraction }], floaters, effects[] }
   scene-view renders the pack (map), the hero (wander/lunge transforms), and a <HitEffect> layer
   boss encounter still pre-empts the whole field (existing `!encounter` guard)
```

## Pure core (testable in `bun test`)

### `combat.ts` (extend) — pack model

The existing anim resolvers (`heroAnim`/`monsterAnim`) and `MONSTER_HITS`/`hitMonster` stay; add a
small **pack** model. A pack is a plain `number[]` of remaining hits per monster (`0` = dead).

```ts
export const PACK_HITS = 3; // cosmetic hits to fell one pack mob (lighter than a solo MONSTER_HITS=5)

// Deterministic-but-varied wave size in 1..3 from the wave index (pure → testable, no Math.random
// in the logic path). Integer hash keeps successive waves from looking patterned.
export const packSize = (waveIndex: number): number => 1 + (hashInt(waveIndex) % 3);

export const makePack = (size: number): number[] => Array(size).fill(PACK_HITS);
export const firstAlive = (pack: number[]): number => pack.findIndex(h => h > 0); // -1 if cleared
export const strike = (pack: number[], idx: number): number[] =>
  pack.map((h, i) => (i === idx ? Math.max(0, h - 1) : h));
export const packCleared = (pack: number[]): boolean => pack.every(h => h <= 0);
```

`hashInt` is a small pure 32-bit integer hash (xorshift/`Math.imul` mix) defined in `combat.ts`.

`heroAnim` gains an **optional** `wander?: boolean` input (default falsy — keeps the existing
`combat.test.ts` `heroAnim` cases green without edits) so the resolver returns the new
`HeroAnim.Wander` when the phase is Wander and no attack/hurt/celebrate pulse is active. Priority
stays: celebrate > hurt > attack > (wander ? Wander : activity-base).

### `scene-phase.ts` (new) — the pure director reducer

The entire pacing brain is **one pure function** `stepDirector(state, input) → state`, so phase
transitions, wave spawning, the throttled strike, pack clearing, and the rest gap are all unit-tested
without timers. The hook (below) only feeds it `Date.now()` + a tick + real beats.

```ts
export enum ScenePhase {
  Wander = "wander",
  Engage = "engage",
}

export const REST_GAP_MS = 4000;        // calm wander between waves
export const STRIKE_THROTTLE_MS = 700;  // min gap between hero strikes (paces the fight)
export const SPAWN_STAGGER_MS = 120;    // pop-in stagger across a pack (view-only)

export interface IDirectorState {
  phase: ScenePhase;
  pack: number[];            // remaining hits per mob; [] in Wander
  waveIndex: number;
  restUntil: number | null;  // wall-clock ms the rest gap ends (null = not resting)
  lastStrikeAt: number;
}
export interface IDirectorInput { now: number; activity: ActivityState; wantStrike: boolean; }
export const initDirector: IDirectorState; // Wander, empty pack

// agent active AND not still inside a rest gap
export const shouldEngage = (activity: ActivityState, now: number, restUntil: number | null): boolean;

// Wander→Engage spawns makePack(packSize(waveIndex)); Engage applies a throttled strike to
// firstAlive, clears→Wander+restUntil, and abandons the pack if activity leaves Farming.
export const stepDirector = (state: IDirectorState, input: IDirectorInput): IDirectorState;
```

`HeroAnim.Wander = "wander"` is added to the `HeroAnim` enum in `combat.ts`.

## The director hook (timer/effect — verified visually)

`use-scene-director.ts` replaces `use-combat.ts`. It owns: `phase`, `waveIndex`, `pack: number[]`,
the strike throttle, the floater queue, the wander, and the hit-effect list. StrictMode-safe timers
(cleared only on unmount, same pattern as the current `useCombat`). **`IFloater`/`FloaterKind` move
here** from `use-combat.ts` (and `floating-text.tsx` updates its import) so deleting `use-combat.ts`
leaves no orphan type. It returns:

```ts
export interface IMobView { anim: MonsterAnim; hpFraction: number; }
export interface IHitEffect { id: number; slot: number; } // slash burst at pack slot
export interface ISceneView {
  phase: ScenePhase;
  hero: HeroAnim;
  mobs: IMobView[];        // [] in Wander
  floaters: IFloater[];
  effects: IHitEffect[];   // transient slash/impact bursts to render
}
```

The hook derives each mob's transient anim (hurt/attack/die) and the hero pulses from the
**director-state diff** (a strike that lowered `pack[idx]` → hurt, or → die when it hits 0), keeping
visuals anchored to the same diff philosophy as the rest of the app. Only the current target
(`firstAlive`) reacts at a time (FF one-at-a-time); the rest idle.

Behaviour:
- **Wander:** `pack = []`, `hero = Wander` (CSS stroll). Entered on Idle/Rest and during a rest gap.
- **Engage entry:** when `shouldEngage`, build `makePack(packSize(waveIndex))`, monsters pop in
  staggered (`SPAWN_STAGGER_MS`), `waveIndex += 1`.
- **Strike (throttled):** accumulated `combatBeats.xp` is spent at most once per `STRIKE_THROTTLE_MS`
  — pulse hero `Attack` (CSS lunge toward the target), push a `HitEffect` at `firstAlive`, `strike`
  that monster (pulse its `Hurt`, or `Die` + dissolve when it reaches 0), and emit a `+N XP` floater.
  Beats that arrive during Wander still advance the real XP bar (in the portrait) but trigger **no**
  strike.
- **action_fail beat:** target monster pulses `Attack` (lunges at hero), hero `Hurt` + screen red
  flash (existing behaviour, now inside the FF frame).
- **level beat:** hero `Celebrate`.
- **Pack cleared:** `packCleared` → enter Wander, start the `REST_GAP_MS` timer → re-engage if still
  Farming.

`hpFraction` per monster = `remainingHits / PACK_HITS` (drives the small per-mob HP bar).

## Components / files

| File | Responsibility | New/Mod |
|---|---|---|
| `app/src/combat.ts` | + `HeroAnim.Wander`; pack model (`PACK_HITS`, `packSize`, `hashInt`, `makePack`, `firstAlive`, `strike`, `packCleared`); `heroAnim` takes `wander` | Modify |
| `app/src/scene-phase.ts` | `ScenePhase` enum, timing constants, `shouldEngage` | Create |
| `app/src/use-scene-director.ts` | the paced director hook (replaces `use-combat.ts`) | Create |
| `app/src/use-combat.ts` | removed (folded into the director) | Delete |
| `app/src/components/hit-effect.tsx` | one-shot slash/impact burst at a target slot | Create |
| `app/src/components/floating-text.tsx` | update `IFloater` import to `use-scene-director` | Modify |
| `app/src/components/monster.tsx` | render **one** mob given `{ theme/emoji, anim, hpFraction, slot }`; small HP bar; spawn-pop / dissolve / hurt / attack classes; **per-mob nameplate dropped** to reduce clutter (`scene-view` maps the pack into N `<Monster>`) | Modify |
| `app/src/components/scene-view.tsx` | use `useSceneDirector`; **map `pack` → N `<Monster>`** spread across the right side + hero (wander/lunge) + `<HitEffect>` layer; keep the `!encounter` boss guard; Wander → no pack | Modify |
| `app/src/styles.css` | keyframes: `hero-wander` stroll, hero/monster `lunge`, `hit-flash`, `shake`, `slash`, monster `spawn-pop`, `dissolve`; all with `prefers-reduced-motion` fallbacks | Modify |

## Testing

`bun test` (pure units):
- **`packSize`**: returns ∈ {1,2,3} across a range of indices; deterministic (same index → same size);
  not constant (varies across indices).
- **pack model**: `makePack(n)` length/fill; `strike` decrements only the target and floors at 0;
  `firstAlive` returns the leftmost alive index and `-1` when cleared; `packCleared` true only when
  all `<= 0`.
- **`stepDirector`**: Wander→Engage spawns a 1–3 pack when farming; stays Wander when idle; a
  throttled strike damages the leftmost mob and ignores too-soon strikes; clearing the pack sets a
  rest gap and re-engages only once `now >= restUntil`; leaving Farming mid-wave abandons the pack.
- **`heroAnim`**: `wander` flag yields `HeroAnim.Wander` only when no celebrate/hurt/attack pulse;
  pulses still take priority.

Visual (VS Code panel, same as 3.5): wander stroll, wave pop-in (1–3), throttled FF strikes (lunge +
slash + flash + shake), dissolve→rest-gap→next wave, boss still pre-empts, reduced-motion path.

## Scope / non-goals

- **Cosmetic only — no core change.** Waves/kills give no loot; loot stays boss-rate-gated.
- **Pack = N copies of the scene's theme emoji** (placeholder). No distinct per-mob species/names in
  3.8a; per-mob nameplates dropped (small HP bar only).
- **Wander = simple left/right stroll** — no pathfinding, no roaming AI.
- **No world-transition** (tier-change scene swap) — that is **3.8b**.
- **Deferred follow-up — Guild/Town rest scene.** A dedicated guild backdrop where the hero rests
  when a session is fresh/quiet (Rest, or "opened but not started yet") is wanted but **not in
  3.8a**. It is a *scene swap*, same family as the 3.8b world-transition — design the two together
  later. For 3.8a, Wander happens on the **current tier scene** (the hunting ground).
