# Aspect-Locked Battle Stage — Design

**Status:** approved
**Date:** 2026-06-17
**Scope:** `app/` battle scene layout (`scene-view.tsx` + `styles.css`). Pure presentational; no `core`/combat/director change.
**Builds on:** the scene-background work (`.scene-bg`, `SCENE_BGS`) and the existing per-theme `.sky` gradients.

## Goal

Make the battle scene + its actors stay correctly proportioned at **any panel size/shape**. Today the scene image is `cover`-scaled to fill the whole `.scene` panel: on a wide-short panel it crops the sky; on a tall panel it over-zooms and crops the sides. Characters use fixed pixel sizes, so they don't scale with the panel either. The fix: render the battle inside an **aspect-locked "stage"** that always matches the scene image's ratio, fit-and-centered in the panel, with the surrounding area filled by the existing themed sky gradient, and size the actors relative to the stage.

## Why

`cover` on a fixed-aspect image can never satisfy an arbitrary-aspect panel — one axis always over-fills. Locking the battle to the image's aspect ratio means the image always fits exactly (no zoom, no crop), and the panel's extra space becomes a themed letterbox. Sizing actors as a percentage of the stage (not fixed px) keeps the hero and monsters proportionate to the scene at every panel size.

## Decisions (settled during brainstorming)

- **Stage locked to the scene ratio (400×128 ≈ 25:8 / ~3.125:1)**, `max-width/max-height: 100%`, **anchored bottom-center** in the panel.
- **Letterbox = the existing per-theme `.sky` gradient** — no new color. The stage (with the real scene image) sits on top of `.sky`; the area around/above the stage shows `.sky`, which is already themed (grassland = blue, forest/dungeon = dark), so it blends automatically.
- **Actors sized as a % of the stage height** (not fixed px): hero ~30%, monster ~21%, hit effects ~12–15%. Positions stay percentage-based (now relative to the stage).
- **Overworld untouched** (it already measures + scales itself).

## Components

### 1. The stage — `app/src/components/scene-view.tsx`

In **battle mode**, wrap the scene background + the battle graph in a `.battle-stage`, itself inside a `.battle-frame` flex layer that fits-and-centers the stage. The flex wrapper is dedicated to battle so it never disturbs the overworld (which is a separate child of `.scene`):

```tsx
<div className={sceneClass}>
  <div className="sky" aria-hidden="true" />            {/* letterbox fill (per-theme gradient) */}
  {mode === SceneMode.Battle && (
    <div className="battle-frame">                       {/* absolute, flex: bottom-center */}
      <div className="battle-stage">                     {/* aspect-locked 400/128 */}
        {hasSceneBg(sceneInfo.theme) && (
          <div className="scene-bg" aria-hidden="true"
               style={{ backgroundImage: `url(${assetUrl(`/scenes/${sceneInfo.theme}.png`)})` }} />
        )}
        <BattleScene … />
      </div>
    </div>
  )}
  {mode === SceneMode.Overworld && <OverworldRoom … />}
  <PortraitFrame … /> … {/* overlays stay on the full panel, outside the frame */}
</div>
```

- `.scene-bg` moves **inside** the stage (it currently lives directly under `.scene`); it covers the stage exactly (matching aspect → no crop/zoom).
- `BattleScene` is unchanged — its actors (`Monster`, `HitEffects`, `Hero`, `FloatingText`, `BossEncounter`) are absolutely positioned, so the new `.battle-stage` (position: relative) becomes their containing block automatically.
- UI overlays (`PortraitFrame`, `AreaTag`, `MetaMenu`, `ActivityBar`, `PanelOverlay`, `WorldTransition`) remain direct children of `.scene` (full panel), outside `.battle-frame` — they are not clipped to the stage.

### 2. Stage CSS — `app/src/styles.css`

```css
/* Battle-only flex layer over the panel; fits + bottom-centers the aspect-locked stage. A flex
   item with aspect-ratio + max-w/h fits correctly (the browser picks the constraining axis). */
.battle-frame {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}
.battle-stage {
  position: relative;
  aspect-ratio: 400 / 128;
  max-width: 100%;
  max-height: 100%;
  overflow: hidden; /* clip the scene image; actors are inside and clip with it */
}
```
`.scene-bg` keeps `position:absolute; inset:0; background: center bottom / cover` — but now `inset:0` is the **stage**, and since the stage matches the image ratio, `cover` is an exact fit. `.sky` stays absolute `inset:0` on `.scene`, **behind** `.battle-frame` (DOM order), as the letterbox. `.scene` itself is unchanged (still `position:relative`), so the overworld and the absolute overlays are unaffected.

### 3. Actor sizing — `app/src/styles.css`

Convert fixed pixel sizes to **% of stage height** so they scale with the stage:
- `.hero` → `height: 30%` (was 92px) + `aspect-ratio: 1` (width follows); keep `left`/`bottom` %.
- `.monster-unit .monster` (and `.sprite` inside the stage) → `height: 21%` + `aspect-ratio: 1` (was 64px).
- `.hit-effect` → ~`12%`; `.hit-zap` → ~`15%` (were 34px / 46px).
- Mob slots (`mob-slots.ts`) stay percentage-based — already relative to the (now stage) container.
- Floating text stays px (text legibility); revisit only if it looks off.

Starting percentages are tuned in the browser (Component 4). The hero:monster ratio (~30:21) preserves today's 92:64.

### 4. Browser verification (no unit tests — pure layout)

Serve a grassland Farming fixture and screenshot at several panel shapes:
- **wide-short** (~920×285): stage fills width, small sky band on top, actors proportionate.
- **tall** (~900×800): stage pinned to bottom full-width, sky gradient fills the large area above (reads as sky), no over-zoom.
- **small** (~500×260) and **narrow**: stage scales down, actors scale with it.
In each: the scene image is never zoomed/cropped oddly, the hero and slime sit on the ground at consistent relative positions, the letterbox is the themed sky. Tune the actor % until the proportions match the approved look (~hero 30% / monster 21%).

## Data flow

`mode === Battle` → render `.battle-stage`; `hasSceneBg(theme)` → scene image inside it; `.sky` per-theme gradient = letterbox. No transport/`core`/director change. The director still drives actor anim/positions exactly as before (now within the stage).

## Error handling / fallback

- **No scene art for a theme** (forest/dungeon today) → no `.scene-bg`, the stage is transparent → the `.sky` gradient shows through the stage area too. Actors still get the aspect-locked, scaled coordinate space, so they stay proportionate even on gradient-only themes (an improvement over today).
- **Extreme panel shapes** → letterbox grows (more sky), but the stage never distorts.
- `prefers-reduced-motion` unaffected (layout only).

## Out of scope (deliberate)

Overworld layout, the boss encounter's internal art, any `core`/combat/throttle/formation change, new scene/monster art, and per-theme letterbox art (the gradient suffices).
