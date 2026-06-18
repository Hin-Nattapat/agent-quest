# Monster Counter-Attack (trade-blows battle) — Design

**Status:** approved
**Date:** 2026-06-18
**Scope:** `app/` battle director + a hand-made hero-hit VFX. Pure cosmetic; no `core`/transport/reducer change.
**Builds on:** the existing scene director (`advance`/`stepDirector` strike loop, `STRIKE_THROTTLE_MS`, the mob `attack` frames, `IHitEffect`).

## Goal

Make the battle read as an **exchange of blows**: after the hero strikes, a **random** still-alive mob attacks back — playing its own attack animation and firing a hand-made impact VFX on the hero, who flinches. No new art. The hit/flinch is **delayed to the attack's contact moment** (not the windup start) so the trade looks smooth.

## Why

Today only the hero attacks on the throttle cadence; mobs bite back only on a real failure (`beats.hurt`). The fight looks one-sided. Mobs already have `attack` frames (starter mobs now; T4 mobs as they import), so a cosmetic counter-attack beat — reusing those frames + a CSS impact — makes every mob feel alive and the fight feel two-sided, with zero art cost.

## Decisions (settled during brainstorming)

- **Counter after every hero strike** that doesn't clear the pack (the user prefers a constant trade; easy to gate later). Scheduled ~`COUNTER_DELAY_MS` after the strike, landing mid-throttle so hero/mob alternate.
- **Random mob, no `Math.random`** — a deterministic hash of a monotonic counter picks among the *alive* slots (matches `packSize`'s `hashInt` style; `app/` avoids `Math.random` like `core`).
- **Per-slot attack state** — replace the single `monAttack` bool with `attackSlot: number | null` so *any* mob (not just the front target) can be the attacker.
- **Hand-made hero-hit VFX** — one generic `.hero-hit` impact at the hero anchor (monsters have no per-style). The hero flinches (`heroHurt` pulse). No art.
- **Contact windup** — the impact effect + the victim's flinch/hurt fire `CONTACT_MS` *after* the attacker's animation starts, on **both** sides (hero→mob and mob→hero), so the blood/impact lands on the contact frame and the trade looks smooth. The attacker's animation still starts at t=0.
- **Cosmetic only** — no HP/`state` change (like every existing VFX). The mob `attack` art carries the motion; mobs without it fall back to the `m-attack` lunge (no regression).

## Sequence (one throttle window, `STRIKE_THROTTLE_MS = 1600`)

```
t = 0           hero strike: hero attack animation starts (pulse setAttacking)
t = CONTACT_MS  → mob hit effect + mob hurt/die land (the hero's blow connects)
t = COUNTER_DELAY_MS            random alive mob: attack animation starts (attackSlot = idx)
t = COUNTER_DELAY_MS + CONTACT  → hero-hit VFX + hero flinch land (the mob's blow connects)
t = 1600        next hero strike …
```

`COUNTER_DELAY_MS ≈ 800` (mid-throttle), `CONTACT_MS ≈ 180` (a touch under the melee attack so the impact reads as contact, not windup). Both tunable.

## Components

### 1. Random alive picker — `app/src/combat.ts`

```ts
// Deterministic pick among the still-alive pack slots (no Math.random — matches packSize/hashInt).
// Returns -1 if the pack is empty/cleared.
export const randAlive = (pack: number[], seed: number): number => {
  const alive = pack.map((h, i) => (h > 0 ? i : -1)).filter(i => i >= 0);
  if (alive.length === 0) {
    return -1;
  }
  return alive[hashInt(seed) % alive.length];
};
```
(`hashInt` already exists in `combat.ts`; export-or-reuse in module scope.)

### 2. Director — `app/src/use-scene-director.ts`

- **State:** drop `monAttack: boolean`; add `attackSlot: number | null` (which mob is mid-attack) and a `heroHits: number[]` effect list (ids, like `effects`/`floaters`).
- **Constants:** `COUNTER_DELAY_MS = 800`, `CONTACT_MS = 180`, `HERO_HIT_MS = 360` (clear the `.hero-hit` class; matches its keyframe).
- **`addHeroHit()`** — push an id, auto-remove after `HERO_HIT_MS` (mirrors `addEffect`).
- **`counterAttack()`** — `const idx = randAlive(dirRef.current.pack, seqRef.current)`; if `idx < 0` return; `setAttackSlot(idx)` + clear it after `MON_MS.attack`; after `CONTACT_MS` → `addHeroHit()` + `pulse(setHeroHurt, HERO_MS.hurt)`.
- **Hero strike windup (in `advance`):** keep the hero attack pulse at t=0, but wrap the *impact* (the `addEffect` + `setMonHurt`/`setDyingSlot`) in `later(…, CONTACT_MS)` so the mob reacts on contact. After a strike that leaves the pack alive (`!packCleared(next.pack)`), `later(counterAttack, COUNTER_DELAY_MS)`.
- **Failure bite (`beats.hurt`):** reuse the new path — `setAttackSlot(firstAlive(dir.pack))`, then `later(() => { addHeroHit(); pulse(setHeroHurt, …); }, CONTACT_MS)`. Keep the hurt floater.
- **Mob render:** `attacking: attackSlot === i` (was `isTarget && monAttack`), so the chosen mob animates regardless of being the front target.
- **View:** add `heroHits` to `ISceneView`.

### 3. Hero-hit VFX render — `app/src/components/battle-scene.tsx` (+ small `HeroHit`)

Render the `heroHits` ids as `.hero-hit` spans anchored at the hero (`left:22%; bottom:18%`, same as `.hero`), as a sibling layer (like `HitEffects`). Only when `!encounter`.

### 4. CSS — `app/src/styles.css`

`.hero-hit` — a quick impact burst at the hero anchor (a short-lived radial/claw flash, ~`HERO_HIT_MS`). Add to the `prefers-reduced-motion` block (instant/short fade) alongside the other effects.

## Data flow

director tick → `advance(true)` strike → (windup) mob impact → (delay) `counterAttack` → random mob `attackSlot` + (windup) hero-hit + flinch. All view-local; `state`/`core`/throttle/XP unchanged.

## Fallback / no-regression

- Mobs without `attack` frames → `monster.tsx` already falls back to the `m-attack` lunge.
- Pack cleared / Wander → `randAlive` returns -1, no counter.
- The real-failure bite still fires (now via `attackSlot` + the windup).
- `prefers-reduced-motion` → `.hero-hit` is a brief fade; pulses already hold frame 0.

## Testing (bun test pure helper; visuals in browser)

- `randAlive`: returns only alive indices; -1 on an all-zero pack; varies with `seed`; stable for a fixed `(pack, seed)`.
- Browser: hero strikes then a random mob attacks back ~mid-throttle; hero flinches + `.hero-hit` appears on the mob's contact frame (not its windup); different mobs take turns; existing hero strike + mob hurt/die still work; mage cast unaffected.

## Files touched

`app/src/combat.ts` (`randAlive` + export `hashInt` if needed), `app/src/use-scene-director.ts` (attackSlot + heroHits + counter + contact windup), `app/src/components/battle-scene.tsx` (render hero-hit), `app/src/components/hero-hit.tsx` (new, small), `app/src/styles.css` (`.hero-hit`).

## Out of scope (deliberate)

Real combat damage/HP, per-monster attack styles or themed counter-VFX (one generic impact for now), traveling projectiles, boss counter-attacks, and tuning of the exact delays beyond sensible defaults.
