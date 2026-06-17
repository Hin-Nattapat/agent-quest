# Mage Cast Combat — Design

**Status:** approved
**Date:** 2026-06-17
**Scope:** `app/` companion battle scene. Pure consumer-side rendering; no `core/` changes.
**Builds on:** the Mage sprite line incl. cast frames (PR #43, merged) — `public/sprites/mage/<tier>/cast/<0..8>.png` (east, 9 frames) exist for all 5 forms.

## Goal

Replace the generic dash-jab battle attack with a class-appropriate attack, starting with the **mage**: the mage **stays in place**, plays its PixelLab **cast** animation on each strike, and fires an **instant teal zap** at the target monster (which flinches). A per-class `AttackStyle` seam lets other lines (ranger=shoot, rogue=melee) get their own attack later by adding a style + frames — for now non-mage lines keep the existing dash.

## Why

The mage currently lunges forward (`.hero-attack` dash keyframe) to "hit" — wrong for a spellcaster. The cast frames are already extracted (PR #43) but unused; the battle attack should be a stand-and-cast + a ranged zap, matching the mage fantasy. The battle hero is also smaller than the overworld hero (64 vs 92px) — fixed here.

## Decisions (settled during brainstorming)

- **Mage only this round** + an `AttackStyle` seam. `mage → Cast`, every other line `→ Melee` (the existing dash). Adding a class later = extend the style map + add frames.
- **Instant zap, not a traveling projectile.** On the cast release, a teal beam/flash connects hero→monster briefly (~150ms) and the monster flinches. No projectile travel (option chosen over a traveling orb).
- **Hero stays in place** for Cast (no dash). Plays the real cast frames (east, 9).
- **Battle hero enlarged to 92px** to match the overworld.

## Components

### 1. Attack-style seam — `app/src/combat.ts`

```ts
export enum AttackStyle {
  Cast = "cast",
  Melee = "melee",
}

export const attackStyleFor = (line: string): AttackStyle => {
  if (line === "mage") {
    return AttackStyle.Cast;
  }
  return AttackStyle.Melee;
};
```

`HeroAnim.Attack` stays the single "attacking" state; the *style* decides how it renders and what VFX it fires.

### 2. Cast in the sprite manifest — `app/src/sprites.ts`

`ISpriteSet` gains an optional `cast`:

```ts
export interface ISpriteSet {
  idle: Record<Facing, string>;
  walk: Record<Facing, string[]>;
  cast?: string[]; // east-facing cast frames; present only where the art exists
}
```

`buildSet` builds `cast` from `/sprites/<root>/cast/<0..N>.png`. All 5 Mage forms include it; lines without cast art simply omit it (the renderer falls back to the dash).

### 3. Battle hero plays cast — `app/src/components/hero.tsx`

The battle `Hero` already knows `line` and `tier`. It derives `attackStyleFor(line)`:
- **Cast + `anim === HeroAnim.Attack` + `set.cast` exists** → play `set.cast` frames via `useSpriteFrame` (one-shot, ~`CAST_FPS`), standing still (no `.hero-attack` dash class).
- **Melee (or no cast art)** → the existing path (idle still + `.hero-attack` dash keyframe).

So the className drops `hero-attack` for the cast path and the background-image cycles the cast frames instead.

### 4. Zap VFX (replaces slash for cast) — `app/src/components/hit-effect.tsx`

Hit effects gain a kind. The director tags each effect `slash` (melee) or `zap` (cast):
- **slash** — the existing diagonal slash at the mob slot (unchanged).
- **zap** — a **teal beam** drawn from the hero's staff toward the mob slot, flashing ~150ms then gone (CSS keyframe, no travel). The mob flinches (`m-hurt`) on the same beat.

`IHitEffect` gains `kind: "slash" | "zap"` (a string enum `EffectKind`). `slotPos(slot)` still positions the impact end at the target.

### 5. Director timing — `app/src/use-scene-director.ts`

On a strike, the director branches on `attackStyleFor(line)`:
- **Cast:** `pulse(setAttacking, CAST_MS)` where `CAST_MS ≈ 600` (long enough to play the 9 cast frames); emit a `zap` effect at the target slot; flinch the mob (`m-hurt`) at the release. The hero does not dash.
- **Melee:** unchanged — `pulse(setAttacking, HERO_MS.attack=280)`, `slash` effect, dash.

The strike throttle (`STRIKE_THROTTLE_MS = 1600`) and FF2 formation are unchanged — the mage zaps one mob per beat.

### 6. Battle hero size — `app/src/styles.css`

`.hero` gains `width: 92px; height: 92px;` (matches `.ow-hero`). Already applied (the brainstorm-stage size fix).

### 7. Non-mage lines

`Melee` → the current dash + slash, untouched. When ranger/rogue art lands, add `AttackStyle.Shoot`/`Stab` + frames + a VFX kind; the seam already routes by line.

## Data flow

`state.class.line` → `attackStyleFor` (in both `hero.tsx` for rendering and `use-scene-director.ts` for VFX/timing) → Cast path (cast frames + zap) or Melee path (dash + slash). No transport/`core` change.

## Error handling / fallback

- **Cast style but no `set.cast`** (e.g. a future mage tier without cast art) → fall back to the dash path (Melee rendering) so the attack still animates.
- **No art at all** (non-mage, Novice) → emoji hero + dash + slash (current behavior), entirely unaffected.
- `prefers-reduced-motion` → cast frames hold frame 0 (handled by `useSpriteFrame`); the zap still flashes (it's brief, not a loop) but could be shortened later.

## Testing (bun test, pure helpers; visuals in browser)

- `attackStyleFor("mage")` → `Cast`; `attackStyleFor("ranger"/"novice")` → `Melee`.
- `heroSpriteSet("mage", 1)?.cast?.length === 9`; a hypothetical no-cast set → `cast` undefined.
- The director's effect-kind selection: `cast → zap`, `melee → slash` (pure helper if extracted).
- Browser verify (after #43 on main): mage in battle stands, plays cast, fires a zap; mob flinches; no dash. Non-mage still dashes.

## Files touched

`app/src/combat.ts` (AttackStyle + selector), `app/src/sprites.ts` (cast in manifest), `app/src/components/hero.tsx` (cast playback), `app/src/components/hit-effect.tsx` (zap vs slash), `app/src/use-scene-director.ts` (style-aware strike), `app/src/styles.css` (zap keyframe + hero 92px).

## Out of scope (deliberate)

Ranger/rogue/sage real attacks (await frames), dedicated hurt/celebrate frames, monster/boss art, a traveling projectile (zap chosen), and any `core`/combat-math change (XP, throttle, formation all unchanged).
