# Monsters & Scene Backgrounds — Design

**Status:** approved
**Date:** 2026-06-17
**Scope:** `app/` battle scene + `tools/import-art.ts` + `docs/reference/art-prompts.md`. Pure consumer-side; no `core/` change.
**Builds on:** the hero sprite pipeline (import → `public/` → manifest → DOM frame renderer) now proven for all 4 lines, and the existing `bg:<theme>` importer handler + `scenes/<theme>.png` layout.

## Goal

Make the battle scene render **real art** for a first vertical slice — the three shared starter themes **grassland / forest / dungeon** (T1–T3, where most play time happens):

1. **Monster sprites** — each starter theme's mob plays a real **idle loop** + an **attack pose** animation (facing the hero), replacing the emoji. Death stays a CSS fade, hurt stays a CSS flash.
2. **Scene backgrounds** — each starter theme shows a **single full-panel background image** instead of the CSS gradient sky.
3. **Prompt pack** — reorganize `art-prompts.md` §7 into a well-categorized monster + scene prompt pack matching the §4 character quality (constants + per-monster identity + idle/attack action descriptions + per-scene background prompts), with the 3 starter themes fully authored and the rest laid out as templates.

The same pattern then derives the remaining ~17 themes and the boss (both out of scope here).

## Scope decisions (settled during brainstorming)

- **Slice = 3 starter themes** (`grassland`, `forest`, `dungeon`) — both monster + BG together (one vertical slice through both pipelines). Other themes keep their current fallback.
- **Monster animation = idle-loop + attack-pose**, imported as real frames, single direction (**west** — the mob sits on the right and faces left toward the hero). **Hurt = CSS flash, death = CSS fade** (the existing `m-hurt` / `m-die` keyframes, unchanged).
- **BG = one full-scene image** per theme (sky + ground baked in), set as a back layer on `.scene`; hero/monster/mob-slots sit on top at their existing `%` positions.
- **Boss deferred** (separate `boss-encounter` system).

## Components

### 1. Importer — monster handler (`tools/import-art.ts`)

`bg:<theme>` already lands `scenes/<theme>.png` (just consumed now, no change). Add the **monster** handler (replace the `notImplemented("monster")` stub):

- CLI: `bun tools/import-art.ts <export> --as monster:<theme>`.
- From the PixelLab export, extract the **idle** and **attack** animations, **west** direction, into:
  - `app/public/sprites/monsters/<theme>/idle/<0..N>.png`
  - `app/public/sprites/monsters/<theme>/attack/<0..M>.png`
- Find the anim folders by glob (folder names are messy, same as heroes): `*dle*` → idle, `*ttack*` → attack. Pick the `west` direction subfolder if present, else the single/only direction. Strip `frame_00N` → `N` (existing helper).
- Print the imported **frame counts** (`idle: N, attack: M`) so they can be plugged into the manifest (mirrors how hero frame counts were known = 9).
- Boss stays `notImplemented` (deferred).

### 2. Monster manifest + render

**New `app/src/monsters.ts`** — mirrors `sprites.ts`, keyed by `SceneTheme`:

```ts
import { SceneTheme } from "./scene";

export interface IMonsterSet {
  idle: string[]; // west-facing idle loop
  attack: string[]; // west-facing attack pose (one-shot)
}

const buildMonsterSet = (theme: string, idleFrames: number, attackFrames: number): IMonsterSet => ({
  idle: Array.from({ length: idleFrames }, (_, i) => `/sprites/monsters/${theme}/idle/${i}.png`),
  attack: Array.from({ length: attackFrames }, (_, i) => `/sprites/monsters/${theme}/attack/${i}.png`),
});

// Only themes with real art appear; a missing theme → undefined → emoji fallback.
export const MONSTER_SPRITES: Partial<Record<SceneTheme, IMonsterSet>> = {
  [SceneTheme.Grassland]: buildMonsterSet("grassland", /*idle*/ 0, /*attack*/ 0),
  [SceneTheme.Forest]: buildMonsterSet("forest", 0, 0),
  [SceneTheme.Dungeon]: buildMonsterSet("dungeon", 0, 0),
};

export const monsterSet = (theme: SceneTheme): IMonsterSet | undefined => MONSTER_SPRITES[theme];
```
(The `0, 0` frame counts are placeholders filled from the importer's printed counts during implementation.)

**`app/src/components/monster.tsx`** — when art exists, cycle frames instead of the emoji:

```tsx
const set = monsterSet(scene.theme);
const attacking = anim === MonsterAnim.Attack && Boolean(set?.attack.length);
const frames = attacking ? (set?.attack ?? []) : (set?.idle ?? []);
const frame = useSpriteFrame(frames, MONSTER_FPS, frames.length > 0);
// has-art drops the emoji ::after; m-hurt (flash) + m-die (fade) still apply.
// m-attack lunge is SUPPRESSED when real attack frames play (the frames carry the motion).
```
- `MonsterAnim` (idle/hurt/attack/die) still comes from the director's `monsterAnim`.
- The sprite `<span>` gets `background-image: url(assetUrl(frame))` + a `has-art` class (drops `::after`).
- className keeps `m-hurt` / `m-die` (flash/fade over the sprite) but uses a **neutral attack class** (no lunge transform) when `attacking` — same trick the hero uses to drop `hero-attack` during cast. `usePreload(set)` decode-ahead (kills the first-frame flash).

### 3. Scene background render

**New `app/src/scene-bg.ts`:**
```ts
import { SceneTheme } from "./scene";

// Themes that have a real /scenes/<theme>.png. Others fall back to the .sky gradient.
export const SCENE_BGS = new Set<SceneTheme>([
  SceneTheme.Grassland,
  SceneTheme.Forest,
  SceneTheme.Dungeon,
]);

export const hasSceneBg = (theme: SceneTheme): boolean => SCENE_BGS.has(theme);
```

**`app/src/components/scene-view.tsx`** — when the active battle theme has art, render a full-cover back layer:
```tsx
{mode === SceneMode.Battle && hasSceneBg(sceneInfo.theme) && (
  <div
    className="scene-bg"
    aria-hidden="true"
    style={{ backgroundImage: `url(${assetUrl(`/scenes/${sceneInfo.theme}.png`)})` }}
  />
)}
```
**`app/src/styles.css`** — `.scene-bg` is an absolutely-positioned full-cover layer behind the hero/monster/slots (above the `.sky` gradient, which it visually replaces): `position:absolute; inset:0; background:center/cover no-repeat; image-rendering:pixelated; z-index` below the actors. No change to mob-slot `%` positions.

### 4. Prompt pack — reorganize `art-prompts.md` §7

Elevate §7 to the §4 character standard: **well-categorized, one block per monster, with action descriptions**, plus real **scene background** gen prompts.

Structure:
- **§7.A Monster constants + idle/attack action descriptions** — the shared `(not human)…` constants (have it) + the two reusable action descriptions every monster gen needs:
  - idle: `a slow idle loop, breathing/bobbing gently in place, facing left toward its opponent, keeping its form and colors unchanged`
  - attack: `a forward attack lunge then recover, lunging left toward its opponent and striking, keeping its form and colors unchanged` (faces left = toward the hero, mirrors the aim-direction lesson from §3.2).
- **§7.B Scene background prompt template** — `a side-view pixel-art battle background of <theme>, full scene, the ground/horizon line in the lower third so characters can stand on it, no characters, <palette/mood>, limited palette, clean pixel art` + per-theme fill.
- **§7.1 Starter themes (T1–T3)** — fully authored for the 3 starter monsters (Bug Slime / Error Wraith / Dungeon Brute): each as a full identity prompt (constants + identity) + its scene background prompt.
- **§7.2 / §7.3** — T4 realm + secret monsters reorganized into the same per-monster block shape (identity already exists; the idle/attack actions + scene prompts reference §7.A/§7.B). Authored fully only where art is being gen'd; the rest are templates.

## Data flow

`state` → `sceneNow` → `IScene { theme, monster }` → (a) `monster.tsx` reads `monsterSet(theme)` for frames + `MonsterAnim` from the director; (b) `scene-view.tsx` reads `hasSceneBg(theme)` for the BG image. No transport/`core` change.

## Fallback

- **No monster art for a theme** → `monsterSet` undefined → emoji `::after` (current behavior).
- **No scene art for a theme** → `hasSceneBg` false → `.sky` gradient (current behavior).
- Only the 3 starter themes change; all other themes (T4 realms, secret, guild) render exactly as today.
- `prefers-reduced-motion` → `useSpriteFrame` holds frame 0 (idle/attack freeze); the BG image is static anyway.

## Testing (bun test pure helpers; visuals in browser)

- `monsterSet(Grassland)?.idle[0] === "/sprites/monsters/grassland/idle/0.png"`; a no-art theme → `undefined`.
- `hasSceneBg(Grassland) === true`; `hasSceneBg(Guild) === false`.
- Monster frame selection: `anim===Attack` → attack frames, else idle (pure, if extracted).
- Browser verify: in a grassland/forest/dungeon battle the scene shows the background image, the mob plays its idle loop, plays the attack pose when it bites back, flashes on hurt, and **fades out on death** (no emoji).

## Files touched

`tools/import-art.ts` (monster handler), `app/src/monsters.ts` (new), `app/src/scene-bg.ts` (new), `app/src/components/monster.tsx` (frame render), `app/src/components/scene-view.tsx` (BG layer), `app/src/styles.css` (`.scene-bg` + has-art monster + suppress `m-attack` lunge for art), `docs/reference/art-prompts.md` (§7 prompt pack).

## Out of scope (deliberate)

Boss art + render, the other ~17 themes, monster hurt/die as real frames (kept CSS), multi-direction monsters, the guild/overworld background image (separate), and any `core`/combat-math change.
