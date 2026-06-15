# Frame-Based Sprite Renderer — Design

**Status:** approved
**Date:** 2026-06-16
**Scope:** `app/` companion (Vite + React 19) + `app/extension/` (VS Code host) + asset pipeline

## Goal

Render real PixelLab sprite frames for the hero in the companion scene, replacing the
emoji + single-still placeholder. Consume the PixelLab export (8 static rotations + a
9-frame `walking_forward` animation, 56×56 RGBA) as actual animation, starting with
**Mage T1 (Backend Mage)**.

## Why now

The PixelLab export for `T1_Backend_Mage` is **frame-based** (`rotations/*.png` +
`animations/walking_forward/<dir>/frame_000..008.png`), but the current renderer draws a
single static `.sprite` div with an emoji `::after` and animates it purely with CSS
transforms (`hud`/`app/src/styles.css`). It cannot consume frames. This design adds a
small DOM frame-cycling layer so the real art shows and the walk cycle plays.

## Constraints (decided during brainstorming)

- **Hero only** this round. Monsters/boss stay emoji until their art lands — but the hook
  + manifest must generalize so they adopt it later with no rework.
- **East-facing only.** The scene is side-view (hero on the left, mobs on the right, hero
  faces east/right). The other 7 rotations and non-east walk frames are not consumed now.
- **Two real animations from the asset:** `idle` (a single still) and `walk` (9 frames).
  `attack` / `hurt` / `celebrate` keep their existing CSS keyframes layered over the
  still — no dedicated frames exist for them yet.
- **DOM + CSS**, not Canvas. We have ≤4 sprites on screen and no runtime recolor need, so
  the Pixel Agents Canvas-2D engine is overkill. We borrow only their **time-based frame
  advance** (`frameTimer += dt; frame = (frame+1) % N`) and `[state][frame]` lookup idea.

## Reference: how Pixel Agents does it (and what we take)

`github.com/pixel-agents-hq/pixel-agents` renders on a single Canvas 2D with a `dt`-based
game loop, sprites stored as pixel arrays for runtime recolor, lookup `[state][dir][frame]`,
4 directions (LEFT = horizontal flip of RIGHT), animations walk(4)/typing(2)/reading(2).

| Their mechanism | Our decision |
|---|---|
| time-based frame advance (`frameTimer += dt; frame=(frame+1)%N`) | **adopt** |
| `[state][frame]` lookup | adopt (drop direction → east only) |
| LEFT = horizontal flip of RIGHT (CSS `scaleX(-1)`) | keep in reserve, unused now |
| Canvas-2D engine + game loop | **skip** — DOM/CSS suffices |
| pixel-array + runtime recolor (`colorize.ts`) | **skip** — each form is pre-arted |

## Architecture

```
PixelLab export (raw, 8 dir)          art/pixellab/<Form>/   (gitignored, not shipped)
        │  extract east subset (manual, documented convention)
        ▼
app/public/sprites/<line>/t<tier>/     idle.png + walk-0..8.png   (shipped static assets)
        │  vite build → app/dist/sprites/...
        │  scripts/copy-webview.mjs → app/extension/webview/sprites/...
        ▼
HERO_SPRITES manifest (app/src/sprites.ts)   keyed `${line}-t${tier}` → { idle, walk[] }
        │
useSpriteFrame (app/src/use-sprite-frame.ts) time-based frame cycling (rAF)
        │
Hero component → background-image = assetUrl(currentFrame)   (assets-base.ts resolves origin)
```

## Components

### 1. Asset layout

Normalized, line/tier-keyed, east-only, consumed subset only:

```
app/public/sprites/mage/t1/
  idle.png            # = rotations/east.png
  walk-0.png … walk-8.png   # = animations/walking_forward/east/frame_000 … frame_008
```

- The raw multi-direction PixelLab export is relocated out of `public/` to
  `art/pixellab/T1_Backend_Mage/` (kept as the source archive, **gitignored** so it never
  ships nor bloats the extension copy).
- `.gitignore` gains `.DS_Store` (the export carried several); remove the stray ones.
- Convention documented so future forms drop in mechanically:
  `public/sprites/<line>/t<tier>/{idle.png, walk-N.png}` from each export's east frames.

### 2. Sprite manifest — `app/src/sprites.ts`

```ts
export interface ISpriteSet {
  idle: string;     // root-relative url, e.g. "/sprites/mage/t1/idle.png"
  walk: string[];   // ordered frame urls (9 for Mage T1)
}

// key = `${line}-t${tier}`. Missing key → undefined → caller falls back to emoji.
export const HERO_SPRITES: Partial<Record<string, ISpriteSet>> = {
  "mage-t1": {
    idle: "/sprites/mage/t1/idle.png",
    walk: [
      "/sprites/mage/t1/walk-0.png",
      // … walk-1 … walk-8
    ],
  },
};

export const heroSpriteSet = (line: string, tier: number): ISpriteSet | undefined =>
  HERO_SPRITES[`${line}-t${tier}`];
```

`Partial<Record<...>>` is the whole point: only `mage-t1` exists today; every other
`(line, tier)` returns `undefined` and the renderer keeps the current emoji placeholder.

### 3. Frame-cycling hook — `app/src/use-sprite-frame.ts`

Pure, testable index math kept separate from the rAF effect:

```ts
// elapsed since cycle start → frame index. count<=1 (idle/no-art) → always 0.
export const frameAt = (elapsedMs: number, count: number, fps: number): number => {
  if (count <= 1) {
    return 0;
  }
  return Math.floor(elapsedMs / (1000 / fps)) % count;
};

// Returns the current frame url. playing=false or single-frame → frames[0].
// Honors prefers-reduced-motion (no cycling, hold frames[0]). frames=[] → "".
export const useSpriteFrame = (
  frames: string[],
  fps: number,
  playing: boolean,
): string => { /* rAF accumulates dt; index = frameAt(...) */ };
```

### 4. State → source selection (hero)

The hook cycles frames **only for `wander`** (the walk loop). Every other anim shows the
idle still; the existing CSS keyframes on `.sprite` do the motion.

| `HeroAnim` | frames used | motion |
|---|---|---|
| `idle` / `farming` / `rest` | `[idle]` | existing CSS (`hero-sway` / `hero-bob` / dim) |
| `wander` | `walk[0..8]` loop ~10 fps | real frame cycling (new) |
| `attack` / `hurt` / `celebrate` | `[idle]` | existing CSS keyframes (transform/filter) |

Pure selector (tested):

```ts
// which frame list a given anim draws from, given a resolved set
export const heroFrames = (set: ISpriteSet, anim: HeroAnim): string[] =>
  anim === HeroAnim.Wander ? set.walk : [set.idle];
```

### 5. Hero component — `app/src/components/hero.tsx`

```tsx
const Hero = (props: IProps) => {
  const { line, tier, anim } = props;
  const set = heroSpriteSet(line, tier);
  const frames = set ? heroFrames(set, anim) : [];
  const url = useSpriteFrame(frames, 10, anim === HeroAnim.Wander);
  const style = url ? { backgroundImage: `url(${assetUrl(url)})` } : undefined;
  const artClass = url ? " has-art" : "";
  return (
    <div
      className={`sprite hero hero-${line} hero-${anim}${artClass}`}
      style={style}
      aria-label="hero"
    />
  );
};
```

- `tier` is new on `IProps`; `scene-view.tsx` currently passes only `line` and must also
  pass `state.class?.tier ?? 0`.
- `styles.css` gains `.sprite.has-art::after { content: none; }` so the emoji disappears
  only when art is present (placeholder preserved otherwise).
- `anim` typed as `HeroAnim` (string enum already in `app/src/combat.ts`), not a bare
  string — current `hero.tsx` takes `anim: string`; tighten it.

### 6. Asset base resolution — `app/src/assets-base.ts`

CSS `url()` cannot resolve the same path in both the Vite dev server (`/sprites/...` from
`public/`) and the VS Code webview (a `vscode-webview://` origin whose resource root is the
extension's `webview/` dir). The existing code already injects `scriptUri`/`styleUri` via
`asWebviewUri`; we mirror that for images with a runtime base.

```ts
// dev: window.__CQ_ASSETS__ is undefined → base "" → "/sprites/x" served from public.
// extension: host injects the asWebviewUri of webview/ → base + "/sprites/x" resolves.
declare global { interface Window { __CQ_ASSETS__?: string; } }

export const assetUrl = (path: string): string => {
  const base = (typeof window !== "undefined" && window.__CQ_ASSETS__) || "";
  return base + path;
};
```

### 7. Build / extension wiring

1. **`app/extension/scripts/copy-webview.mjs`** — additionally copy `app/dist/sprites` →
   `app/extension/webview/sprites` (today it copies only `dist/assets`). Guard on
   existence so a build with no sprites still succeeds.
2. **`app/extension/src/webview-html.ts`** — accept an `assetsBase` arg and inject
   `<script nonce="...">window.__CQ_ASSETS__=${JSON.stringify(assetsBase)};</script>`
   before the app script.
3. **`app/extension/src/extension.ts`** — compute
   `webview.asWebviewUri(vscode.Uri.joinPath(distRoot)).toString()` and pass it as
   `assetsBase` to `buildWebviewHtml`.
4. **CSP** — no change. `img-src ${cspSource}` already covers `webview/sprites`.

## Data flow

`state.json` → `useSceneDirector` → `HeroAnim` → `Hero(line, tier, anim)` →
`heroSpriteSet` (manifest) → `heroFrames` (selector) → `useSpriteFrame` (cycling) →
`assetUrl` (origin) → `background-image`. No new transport, no `core/` changes — pure
consumer-side rendering, honoring the `app/` seam (no runtime `core` import).

## Error handling / fallback

- **No art for `(line, tier)`** → `heroSpriteSet` returns `undefined` → emoji placeholder
  (unchanged behavior). Today only `mage-t1` resolves; Novice and every other form fall
  back. This is the safety net, not an edge case.
- **`prefers-reduced-motion`** → `useSpriteFrame` holds `frames[0]`, no cycling.
- **Missing file** → the manifest lists only files that exist; broken `<img>` is avoided by
  construction.

## Testing (bun test, pure-helper level)

- `frameAt()` — index from elapsed/fps, modulo wrap, `count <= 1 → 0`, fps boundary.
- `heroSpriteSet()` — `mage-t1` → defined set; unknown `(line, tier)` → `undefined`.
- `heroFrames()` — `Wander` → `set.walk`; every other `HeroAnim` → `[set.idle]`.
- `assetUrl()` — empty base → path unchanged; non-empty base → prefixed once.
- `Hero` — art present → `has-art` class + `backgroundImage` style; absent → no `has-art`,
  emoji fallback path intact.

## Out of scope (deliberate)

- Monster/boss frame rendering (no art yet; same hook adopts them later).
- The other 7 rotations / top-down walk-around (gated on the deferred scene-camera
  decision).
- Dedicated `attack` / `hurt` / `celebrate` / `idle-breathe` frames (CSS handles them; gen
  in PixelLab later if the credit cost is worth it).
- Per-tier hero art beyond T1 and other class lines (manifest scales to them as exports
  arrive; no code change needed).
