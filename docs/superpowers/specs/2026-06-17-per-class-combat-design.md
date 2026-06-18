# Per-Class Combat (Ranger / Rogue / Sage) — Design

**Status:** approved
**Date:** 2026-06-17
**Scope:** `app/` battle combat + `tools/import-art.ts`. Pure consumer-side; no `core` change.
**Builds on:** the Mage cast-combat seam (`AttackStyle`, `attackStyleFor`, `ISpriteSet.cast`, the director's style-aware strike, `EffectKind`).

## Goal

Give the other three lines their own battle attack, the way the mage casts: **ranger shoots, sage invokes, rogue stabs** — each plays its real attack animation and fires a class-flavored instant VFX, instead of the generic dash. Extend the existing `AttackStyle` seam rather than special-casing each class.

## Why

Only the mage has a real attack today; ranger/rogue/sage fall back to the melee dash with a generic slash. The seam built for the mage already routes rendering + VFX by style — extending it (one more enum value + one VFX each) is the small, consistent way to make every class feel distinct.

## Decisions (settled during brainstorming)

- **Instant/fast VFX, no traveling projectiles** (consistent with the mage's zap): ranger = a quick teal **arrow streak**, sage = an amber **glyph burst**, rogue = the existing **slash**.
- **Ranged styles stand** (Cast/Shoot/Invoke), **melee styles dash** (Stab/Melee). Rogue is melee: it dashes in *and* plays its stab frames.
- **Generalize the sprite field `cast` → `attack`** so every line uses one field; the `AttackStyle` (not the field) decides ranged-vs-melee + VFX.
- **Ranger/rogue/sage attack frames are not imported yet** — the user re-exports them (east, ~9 frames, per `art-prompts.md` §3.2). The code path ships first; frames + manifest entries wire on when they arrive (like the hero/monster imports).

## Components

### 1. Attack-style seam — `app/src/combat.ts`

```ts
export enum AttackStyle {
  Cast = "cast",
  Shoot = "shoot",
  Stab = "stab",
  Invoke = "invoke",
  Melee = "melee",
}

export const attackStyleFor = (line: string): AttackStyle => {
  if (line === "mage") {
    return AttackStyle.Cast;
  }
  if (line === "ranger") {
    return AttackStyle.Shoot;
  }
  if (line === "rogue") {
    return AttackStyle.Stab;
  }
  if (line === "sage") {
    return AttackStyle.Invoke;
  }
  return AttackStyle.Melee;
};

// Ranged styles stand and fire a projectile-like VFX; melee styles dash in.
export const isRanged = (style: AttackStyle): boolean =>
  style === AttackStyle.Cast || style === AttackStyle.Shoot || style === AttackStyle.Invoke;
```

### 2. Generalized attack frames — `app/src/sprites.ts`

Rename `ISpriteSet.cast` → **`attack`** (each line's east-facing attack frames). `buildSet`'s third param (`castFrames`) becomes `attackFrames`, building `/sprites/<root>/attack/<i>.png`. The mage's on-disk frames move from `…/<tier>/cast/` → `…/<tier>/attack/` (a `git mv`); the mage manifest entries are unchanged (`buildSet("mage/t1", 9, 9)` — the third 9 now means attack frames).

### 3. Importer — `tools/import-art.ts`

The hero importer's attack-animation glob currently matches only `*asting*` → `cast/`. Generalize it to match the ranger/rogue/sage `attack` folders too and output to `attack/`:
```ts
const attack = pickAnimDir(animNames, "ttack") ?? pickAnimDir(animNames, "asting");
// …copy → out/attack/<frameIndex>.png
```
So mage (`casting_a_spell…`) and ranger/rogue/sage (`…attack…`) all land in `attack/`.

### 4. Hero render — `app/src/components/hero.tsx`

```ts
const style = attackStyleFor(line);
const attacking = anim === HeroAnim.Attack && Boolean(set?.attack);
const ranged = isRanged(style);
// ranged attack → stand (the `cast` class drops the .hero-attack dash); melee attack → dash AND
// cycle the stab frames (transform + background-image are independent).
const frames = attacking ? (set?.attack ?? []) : battleFrames;
const animClass = attacking && ranged ? "cast" : anim;
```
`playing = attacking || moving`; `fps = attacking ? ATTACK_FPS : WALK_FPS` (ATTACK_FPS = today's CAST_FPS = 15). Melee-attacking keeps `hero-attack` (dash) **and** plays frames; ranged keeps the no-dash `hero-cast` path.

### 5. VFX — `EffectKind` + director + `hit-effect.tsx` + `styles.css`

Extend `EffectKind { Slash, Zap }` → add `Arrow`, `Glyph`. A pure selector maps style → kind:
```ts
export const effectKindFor = (style: AttackStyle): EffectKind => {
  if (style === AttackStyle.Cast) {
    return EffectKind.Zap;
  }
  if (style === AttackStyle.Shoot) {
    return EffectKind.Arrow;
  }
  if (style === AttackStyle.Invoke) {
    return EffectKind.Glyph;
  }
  return EffectKind.Slash;
};
```
The director's strike uses `isRanged(style)` for the pulse (stand `CAST_MS` vs melee `HERO_MS.attack` + dash) and `effectKindFor(style)` for the effect. `hit-effect.tsx` renders a class per kind (`hit-zap` / `hit-arrow` / `hit-glyph` / `hit-effect`). New CSS:
- `.hit-arrow` — a thin teal streak at the mob slot (a fast horizontal line, ~150ms).
- `.hit-glyph` — an amber radial rune burst at the mob slot (~300ms).
(Both positioned via the existing `slotPos`, like the zap/slash.)

### 6. Per-class color

Arrow + zap = teal; glyph = amber; slash = white. (Matches the line palettes: mage/ranger teal-ish, sage amber.)

## Data flow

`state.class.line` → `attackStyleFor` → (a) `hero.tsx` ranged/melee rendering of `set.attack`; (b) director `isRanged` timing + `effectKindFor` VFX. No transport/`core`/director-math change (throttle, formation, XP unchanged).

## Fallback

- **A line with no `attack` frames yet** (ranger/rogue/sage until imported) → `attacking` is false → the current behavior (idle/dash + slash) — no regression.
- **Melee with no frames** (Novice) → dash + slash, as today.
- `prefers-reduced-motion` → `useSpriteFrame` holds frame 0; VFX are brief flashes.

## Testing (bun test pure helpers; visuals in browser)

- `attackStyleFor`: mage→Cast, ranger→Shoot, rogue→Stab, sage→Invoke, novice→Melee.
- `isRanged`: Cast/Shoot/Invoke true; Stab/Melee false.
- `effectKindFor`: Cast→Zap, Shoot→Arrow, Invoke→Glyph, Stab/Melee→Slash.
- `heroSpriteSet("mage",1)?.attack?.length === 9` (after the cast→attack rename + git mv).
- Browser: mage still casts (regression); once ranger/rogue/sage frames import, each plays its attack (ranger/sage stand, rogue dashes) with its VFX.

## Files touched

`app/src/combat.ts` (styles + isRanged + effectKindFor), `app/src/sprites.ts` (cast→attack), `app/src/components/hero.tsx` (generalized attack playback), `app/src/use-scene-director.ts` (style-aware strike via the selectors), `app/src/components/hit-effect.tsx` (arrow/glyph), `app/src/styles.css` (`.hit-arrow`, `.hit-glyph`), `tools/import-art.ts` (attack glob → `attack/`), `app/public/sprites/mage/<tier>/cast` → `attack` (git mv).

## Out of scope (deliberate)

Traveling projectiles (instant chosen), hero hurt/celebrate frames, boss combat, secret hero lines, monster attack styles (monsters keep their own attack), and the actual ranger/rogue/sage frame import + manifest wiring (a follow-up once the user re-exports the attack animations).
