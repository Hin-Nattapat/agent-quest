# Frame-Based Sprite Renderer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render the real PixelLab Mage T1 sprite in the companion scene (idle still + 9-frame walk cycle), with every other form gracefully falling back to the existing emoji placeholder.

**Architecture:** A normalized `public/sprites/<line>/t<tier>/` asset layout feeds a typed manifest (`sprites.ts`). A pure time-based frame index (`frameAt`) drives a small rAF hook (`useSpriteFrame`). `Hero` looks up its sprite set, picks frames by `HeroAnim`, and sets `background-image`; a runtime asset-base (`assets-base.ts`) makes the same URL resolve in both the Vite dev server and the VS Code webview. No `core/` changes — pure consumer-side rendering, honoring the `app/` seam.

**Tech Stack:** Bun + React 19 + Vite + TypeScript; `bun test`; esbuild for the extension host.

**Spec:** `docs/superpowers/specs/2026-06-16-frame-renderer-design.md`

**Conventions (from `app/CLAUDE.md` + root `CLAUDE.md`):** arrow-const only (no `function`); `interface I*` / `type T*`; string enums (`HeroAnim` exists in `app/src/combat.ts`); no `any` (in src or tests); braces on every `if`/`else`; no multi-line/nested ternaries; kebab-case files; one component per file; `app/` must not import runtime `core` code (type-only imports allowed). Tests are pure (`bun test`, no jsdom) — verify React rendering visually in the browser, not via unit render.

**Run tests with:** `cd app && bun test 2>&1 | grep -E "pass|fail"` (never tail the full output).

---

## File Structure

- Create `app/public/sprites/mage/t1/idle.png` + `walk-0.png`…`walk-8.png` — consumed east-facing frames (Task 1).
- Create `app/src/assets-base.ts` — origin resolution (`joinAsset` pure + `assetUrl`) (Task 2).
- Create `app/src/sprites.ts` — `ISpriteSet`, `HERO_SPRITES` manifest, `heroSpriteSet`, `heroFrames` selector (Task 3).
- Create `app/src/use-sprite-frame.ts` — `frameAt` pure + `useSpriteFrame` rAF hook (Task 4).
- Modify `app/src/components/hero.tsx` + `app/src/components/scene-view.tsx` + `app/src/styles.css` — wire art into the hero (Task 5).
- Modify `app/extension/scripts/copy-webview.mjs` — also copy `dist/sprites` (Task 6).
- Modify `app/extension/src/webview-html.ts` — inject `__CQ_ASSETS__` base (Task 7).
- Modify `app/extension/src/extension.ts` — compute + pass `assetsBase` (Task 8).
- Test files: `app/src/assets-base.test.ts`, `app/src/sprites.test.ts`, `app/src/use-sprite-frame.test.ts`, `app/extension/src/webview-html.test.ts` (extend).

---

## Task 1: Asset layout — extract east frames, archive the raw export

**Files:**
- Create: `app/public/sprites/mage/t1/idle.png`, `app/public/sprites/mage/t1/walk-0.png` … `walk-8.png`
- Move: `app/public/T1_Backend_Mage/` → `art/pixellab/T1_Backend_Mage/`
- Modify: `.gitignore`

No automated test (binary asset placement). Verification is `ls` + dimension check.

- [ ] **Step 1: Create the normalized layout and copy the east frames**

```bash
cd /Users/calypso/Project/Ottery/commit-quest
mkdir -p app/public/sprites/mage/t1
cp app/public/T1_Backend_Mage/rotations/east.png app/public/sprites/mage/t1/idle.png
for i in 0 1 2 3 4 5 6 7 8; do
  cp "app/public/T1_Backend_Mage/animations/walking_forward/east/frame_00$i.png" \
     "app/public/sprites/mage/t1/walk-$i.png"
done
```

- [ ] **Step 2: Archive the raw export out of `public/` and ignore the archive**

```bash
cd /Users/calypso/Project/Ottery/commit-quest
mkdir -p art/pixellab
mv app/public/T1_Backend_Mage art/pixellab/T1_Backend_Mage
printf 'art/\n' >> .gitignore
```

- [ ] **Step 3: Verify the consumed set exists at 56×56**

Run:
```bash
cd /Users/calypso/Project/Ottery/commit-quest
ls app/public/sprites/mage/t1
sips -g pixelWidth -g pixelHeight app/public/sprites/mage/t1/idle.png | grep pixel
ls app/public/T1_Backend_Mage 2>/dev/null || echo "raw export moved out of public OK"
```
Expected: lists `idle.png walk-0.png … walk-8.png` (10 files); `pixelWidth: 56` / `pixelHeight: 56`; "raw export moved out of public OK".

- [ ] **Step 4: Commit**

```bash
cd /Users/calypso/Project/Ottery/commit-quest
git add -A
git commit -m "feat(app): add Mage T1 east sprite frames; archive raw export"
```

---

## Task 2: Asset-base resolution — `assets-base.ts`

**Files:**
- Create: `app/src/assets-base.ts`
- Test: `app/src/assets-base.test.ts`

`joinAsset(base, path)` is the pure core (testable without a DOM). `assetUrl(path)` is the thin wrapper that reads `window.__CQ_ASSETS__` (undefined in dev → empty base).

- [ ] **Step 1: Write the failing test**

```ts
// app/src/assets-base.test.ts
import { test, expect } from "bun:test";
import { joinAsset } from "./assets-base";

test("joinAsset returns the path unchanged when base is empty (dev)", () => {
  expect(joinAsset("", "/sprites/mage/t1/idle.png")).toBe("/sprites/mage/t1/idle.png");
});

test("joinAsset prefixes a webview base exactly once", () => {
  expect(joinAsset("vscode-webview://abc", "/sprites/x.png")).toBe(
    "vscode-webview://abc/sprites/x.png",
  );
});

test("joinAsset never doubles the slash when base has a trailing slash", () => {
  expect(joinAsset("vscode-webview://abc/", "/sprites/x.png")).toBe(
    "vscode-webview://abc/sprites/x.png",
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && bun test src/assets-base.test.ts 2>&1 | grep -E "pass|fail|error"`
Expected: FAIL — cannot find module `./assets-base` / `joinAsset` is not a function.

- [ ] **Step 3: Write minimal implementation**

```ts
// app/src/assets-base.ts
declare global {
  interface Window {
    __CQ_ASSETS__?: string;
  }
}

// CSS url() cannot resolve one path in both Vite dev (/sprites from public/) and the VS Code
// webview (a vscode-webview:// origin). The host injects window.__CQ_ASSETS__ = asWebviewUri of
// the webview root; dev leaves it undefined. assetUrl prefixes paths so both resolve.
export const joinAsset = (base: string, path: string): string => {
  const trimmed = base.endsWith("/") ? base.slice(0, -1) : base;
  return trimmed + path;
};

export const assetUrl = (path: string): string => {
  const base = (typeof window !== "undefined" && window.__CQ_ASSETS__) || "";
  return joinAsset(base, path);
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && bun test src/assets-base.test.ts 2>&1 | grep -E "pass|fail"`
Expected: 3 pass, 0 fail.

- [ ] **Step 5: Commit**

```bash
cd /Users/calypso/Project/Ottery/commit-quest
git add app/src/assets-base.ts app/src/assets-base.test.ts
git commit -m "feat(app): asset-base url resolver for dev + webview origins"
```

---

## Task 3: Sprite manifest + frame selector — `sprites.ts`

**Files:**
- Create: `app/src/sprites.ts`
- Test: `app/src/sprites.test.ts`

`heroSpriteSet(line, tier)` returns the set or `undefined` (missing art → emoji fallback). `heroFrames(set, anim)` picks the walk list for `Wander`, else the single idle still.

- [ ] **Step 1: Write the failing test**

```ts
// app/src/sprites.test.ts
import { test, expect } from "bun:test";
import { HeroAnim } from "./combat";
import { heroSpriteSet, heroFrames } from "./sprites";

test("heroSpriteSet resolves the Mage T1 set with 9 walk frames", () => {
  const set = heroSpriteSet("mage", 1);
  expect(set).toBeDefined();
  expect(set?.idle).toBe("/sprites/mage/t1/idle.png");
  expect(set?.walk.length).toBe(9);
  expect(set?.walk[0]).toBe("/sprites/mage/t1/walk-0.png");
  expect(set?.walk[8]).toBe("/sprites/mage/t1/walk-8.png");
});

test("heroSpriteSet returns undefined for forms with no art yet", () => {
  expect(heroSpriteSet("mage", 2)).toBeUndefined();
  expect(heroSpriteSet("rogue", 1)).toBeUndefined();
  expect(heroSpriteSet("novice", 0)).toBeUndefined();
});

test("heroFrames cycles the walk list only while wandering", () => {
  const set = heroSpriteSet("mage", 1);
  if (!set) {
    throw new Error("expected mage-t1 set");
  }
  expect(heroFrames(set, HeroAnim.Wander)).toEqual(set.walk);
  expect(heroFrames(set, HeroAnim.Idle)).toEqual([set.idle]);
  expect(heroFrames(set, HeroAnim.Attack)).toEqual([set.idle]);
  expect(heroFrames(set, HeroAnim.Farming)).toEqual([set.idle]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && bun test src/sprites.test.ts 2>&1 | grep -E "pass|fail|error"`
Expected: FAIL — cannot find module `./sprites`.

- [ ] **Step 3: Write minimal implementation**

```ts
// app/src/sprites.ts
import { HeroAnim } from "./combat";

export interface ISpriteSet {
  idle: string;
  walk: string[];
}

// key = `${line}-t${tier}`. Partial: only forms with real art appear; a missing key returns
// undefined so the renderer keeps the emoji placeholder (today only Mage T1 exists).
export const HERO_SPRITES: Partial<Record<string, ISpriteSet>> = {
  "mage-t1": {
    idle: "/sprites/mage/t1/idle.png",
    walk: [
      "/sprites/mage/t1/walk-0.png",
      "/sprites/mage/t1/walk-1.png",
      "/sprites/mage/t1/walk-2.png",
      "/sprites/mage/t1/walk-3.png",
      "/sprites/mage/t1/walk-4.png",
      "/sprites/mage/t1/walk-5.png",
      "/sprites/mage/t1/walk-6.png",
      "/sprites/mage/t1/walk-7.png",
      "/sprites/mage/t1/walk-8.png",
    ],
  },
};

export const heroSpriteSet = (line: string, tier: number): ISpriteSet | undefined => {
  return HERO_SPRITES[`${line}-t${tier}`];
};

export const heroFrames = (set: ISpriteSet, anim: HeroAnim): string[] => {
  if (anim === HeroAnim.Wander) {
    return set.walk;
  }
  return [set.idle];
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && bun test src/sprites.test.ts 2>&1 | grep -E "pass|fail"`
Expected: 3 pass, 0 fail.

- [ ] **Step 5: Commit**

```bash
cd /Users/calypso/Project/Ottery/commit-quest
git add app/src/sprites.ts app/src/sprites.test.ts
git commit -m "feat(app): hero sprite manifest + frame selector"
```

---

## Task 4: Frame-cycling hook — `use-sprite-frame.ts`

**Files:**
- Create: `app/src/use-sprite-frame.ts`
- Test: `app/src/use-sprite-frame.test.ts`

`frameAt(elapsedMs, count, fps)` is the pure index math (tested). `useSpriteFrame` is the rAF hook (no unit test — no jsdom; verified in the browser in Task 5).

- [ ] **Step 1: Write the failing test**

```ts
// app/src/use-sprite-frame.test.ts
import { test, expect } from "bun:test";
import { frameAt } from "./use-sprite-frame";

test("frameAt holds frame 0 for a single frame or empty set", () => {
  expect(frameAt(0, 1, 10)).toBe(0);
  expect(frameAt(5000, 1, 10)).toBe(0);
  expect(frameAt(5000, 0, 10)).toBe(0);
});

test("frameAt advances one frame per 1000/fps ms", () => {
  // fps 10 → 100ms per frame
  expect(frameAt(0, 9, 10)).toBe(0);
  expect(frameAt(99, 9, 10)).toBe(0);
  expect(frameAt(100, 9, 10)).toBe(1);
  expect(frameAt(250, 9, 10)).toBe(2);
});

test("frameAt wraps with modulo over the frame count", () => {
  // 9 frames at fps 10 → loops every 900ms
  expect(frameAt(900, 9, 10)).toBe(0);
  expect(frameAt(1000, 9, 10)).toBe(1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && bun test src/use-sprite-frame.test.ts 2>&1 | grep -E "pass|fail|error"`
Expected: FAIL — cannot find module `./use-sprite-frame`.

- [ ] **Step 3: Write minimal implementation**

```ts
// app/src/use-sprite-frame.ts
import { useEffect, useRef, useState } from "react";

// Pure: elapsed ms since the cycle started → frame index. count <= 1 (idle / no art) holds 0.
export const frameAt = (elapsedMs: number, count: number, fps: number): number => {
  if (count <= 1) {
    return 0;
  }
  return Math.floor(elapsedMs / (1000 / fps)) % count;
};

const prefersReducedMotion = (): boolean => {
  if (typeof window === "undefined" || !window.matchMedia) {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
};

// Returns the current frame url. playing=false, a single frame, or reduced-motion holds frames[0].
// frames=[] returns "" so the caller can treat it as "no art".
export const useSpriteFrame = (
  frames: string[],
  fps: number,
  playing: boolean,
): string => {
  const [index, setIndex] = useState(0);
  const startRef = useRef<number | null>(null);

  const active = playing && frames.length > 1 && !prefersReducedMotion();

  useEffect(() => {
    if (!active) {
      setIndex(0);
      startRef.current = null;
      return;
    }
    let raf = 0;
    const tick = (now: number) => {
      if (startRef.current === null) {
        startRef.current = now;
      }
      setIndex(frameAt(now - startRef.current, frames.length, fps));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, frames.length, fps]);

  if (frames.length === 0) {
    return "";
  }
  return frames[Math.min(index, frames.length - 1)];
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && bun test src/use-sprite-frame.test.ts 2>&1 | grep -E "pass|fail"`
Expected: 3 pass, 0 fail.

- [ ] **Step 5: Commit**

```bash
cd /Users/calypso/Project/Ottery/commit-quest
git add app/src/use-sprite-frame.ts app/src/use-sprite-frame.test.ts
git commit -m "feat(app): time-based sprite frame-cycling hook"
```

---

## Task 5: Wire art into the hero

**Files:**
- Modify: `app/src/components/hero.tsx` (full rewrite — currently 11 lines)
- Modify: `app/src/components/scene-view.tsx:64` (pass `tier`)
- Modify: `app/src/styles.css` (drop emoji when art present)

No unit test (React rendering, no jsdom). Verify with typecheck + the browser flow.

- [ ] **Step 1: Rewrite `hero.tsx` to consume the manifest + hook**

```tsx
// app/src/components/hero.tsx
import { HeroAnim } from "../combat";
import { assetUrl } from "../assets-base";
import { heroSpriteSet, heroFrames } from "../sprites";
import { useSpriteFrame } from "../use-sprite-frame";

interface IProps {
  line: string;
  tier: number;
  anim: HeroAnim;
}

const WALK_FPS = 10;

const Hero = (props: IProps) => {
  const { line, tier, anim } = props;
  const set = heroSpriteSet(line, tier);
  const frames = set ? heroFrames(set, anim) : [];
  const frame = useSpriteFrame(frames, WALK_FPS, anim === HeroAnim.Wander);
  const style = frame ? { backgroundImage: `url(${assetUrl(frame)})` } : undefined;
  const artClass = frame ? " has-art" : "";
  return (
    <div
      className={`sprite hero hero-${line} hero-${anim}${artClass}`}
      style={style}
      aria-label="hero"
    />
  );
};

export default Hero;
```

- [ ] **Step 2: Pass `tier` from `scene-view.tsx`**

`app/src/components/scene-view.tsx` line 64 currently reads:
```tsx
        <Hero line={line} anim={scene.hero} />
```
Change it to:
```tsx
        <Hero line={line} tier={state.class?.tier ?? 0} anim={scene.hero} />
```
(`line` is already derived at line 42; `scene.hero` is a `HeroAnim` from `useSceneDirector`.)

- [ ] **Step 3: Drop the emoji placeholder when art is present**

In `app/src/styles.css`, find the `.hero::after` rule (the emoji, around line 165):
```css
.hero::after {
  content: "🧙";
}
```
Immediately after it, add:
```css
.sprite.has-art::after {
  content: none;
}
```

- [ ] **Step 4: Typecheck**

Run: `cd app && bun run typecheck 2>&1 | tail -5`
Expected: no errors (clean exit).

- [ ] **Step 5: Visual verification in the browser**

Build a Farming-state fake home, serve, and confirm the real Mage sprite renders (not the emoji).

```bash
cd /Users/calypso/Project/Ottery/commit-quest/app
FAKE="$CLAUDE_JOB_DIR/tmp/fakehome"; mkdir -p "$FAKE"
cat > "$FAKE/state.json" <<'JSON'
{ "level": 8, "xp": { "into": 10, "need": 100, "pct": 0.1 },
  "class": { "line": "mage", "tier": 1, "form": "Backend Mage", "icon": "⚔" },
  "activity": "farming", "last_event": 0, "inventory": [], "recent": [],
  "cosmetics": {} }
JSON
npm run build 2>&1 | tail -3
AGENTRPG_HOME="$FAKE" AGENTRPG_PORT=7171 npm run serve &
```
Then with Playwright: `browser_navigate http://localhost:7171`, `browser_resize 420x720`, and `browser_take_screenshot`. Expected: the purple Backend Mage sprite (not 🧙) stands in the hero slot facing right. Stop the server when done (`kill %1`).

> Note: the fake `state.last_event: 0` is epoch — to show the live walk cycle (Wander phase) you can also set `activity` transitions; the static idle still is sufficient to confirm art loads.

- [ ] **Step 6: Run the full app test suite (no regressions)**

Run: `cd app && bun test 2>&1 | grep -E "pass|fail"`
Expected: all pass (existing + the 3 new suites), 0 fail.

- [ ] **Step 7: Commit**

```bash
cd /Users/calypso/Project/Ottery/commit-quest
git add app/src/components/hero.tsx app/src/components/scene-view.tsx app/src/styles.css
git commit -m "feat(app): render PixelLab hero sprite with idle still + walk cycle"
```

---

## Task 6: Ship sprites to the extension webview — `copy-webview.mjs`

**Files:**
- Modify: `app/extension/scripts/copy-webview.mjs`

The script copies `dist/assets` → `webview/assets` and wipes `webview/` first. It must also copy `dist/sprites` → `webview/sprites` (when sprites exist) so the .vsix and F5 run carry the art.

- [ ] **Step 1: Add the sprites copy after the assets copy**

Replace the body of `app/extension/scripts/copy-webview.mjs` (lines 16–19, from `rmSync(destRoot…` to the final `console.log`) with:

```js
rmSync(destRoot, { recursive: true, force: true }); // drop stale assets so nothing lingers
mkdirSync(dest, { recursive: true });
cpSync(src, dest, { recursive: true });
console.log(`copy-webview: ${src} -> ${dest}`);

const spritesSrc = join(ext, "..", "dist", "sprites"); // app/dist/sprites
if (existsSync(spritesSrc)) {
  const spritesDest = join(destRoot, "sprites");
  cpSync(spritesSrc, spritesDest, { recursive: true });
  console.log(`copy-webview: ${spritesSrc} -> ${spritesDest}`);
}
```

- [ ] **Step 2: Build the app, then run copy-webview; verify sprites land**

Run:
```bash
cd /Users/calypso/Project/Ottery/commit-quest/app
npm run build 2>&1 | tail -2
node extension/scripts/copy-webview.mjs
ls extension/webview/sprites/mage/t1 2>&1
```
Expected: copy-webview prints both the assets and sprites copy lines; `ls` lists `idle.png walk-0.png … walk-8.png`.

- [ ] **Step 3: Commit**

```bash
cd /Users/calypso/Project/Ottery/commit-quest
git add app/extension/scripts/copy-webview.mjs
git commit -m "feat(ext): copy sprite assets into the webview bundle"
```

---

## Task 7: Inject the asset base into the webview HTML — `webview-html.ts`

**Files:**
- Modify: `app/extension/src/webview-html.ts`
- Test: `app/extension/src/webview-html.test.ts` (extend)

Add an `assetsBase` arg. Inject `<script nonce="…">window.__CQ_ASSETS__=…;</script>` before the app module script so `assetUrl` resolves sprite paths against the webview origin. A classic inline script runs before the deferred `type="module"` app script, so the global is set in time.

- [ ] **Step 1: Write the failing test (extend the existing suite)**

Append to `app/extension/src/webview-html.test.ts`:

```ts
test("buildWebviewHtml injects the asset base before the app module script", () => {
  const html = buildWebviewHtml({
    scriptUri: "vscode-webview://abc/assets/app.js",
    styleUri: "vscode-webview://abc/assets/app.css",
    cspSource: "vscode-webview://abc",
    nonce: "N0NCE",
    assetsBase: "vscode-webview://abc",
  });

  expect(html).toContain('window.__CQ_ASSETS__="vscode-webview://abc"');
  // the base must be set by a nonce'd inline script (CSP blocks un-nonced scripts)
  expect(html).toMatch(/<script nonce="N0NCE">window\.__CQ_ASSETS__=/);
  // and it must appear before the module that reads it
  const baseAt = html.indexOf("__CQ_ASSETS__");
  const appAt = html.indexOf("app.js");
  expect(baseAt).toBeLessThan(appAt);
});
```

The existing first test calls `buildWebviewHtml` without `assetsBase`; update that call to include `assetsBase: "vscode-webview://abc"` so the type checks.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app/extension && bun test src/webview-html.test.ts 2>&1 | grep -E "pass|fail|error"`
Expected: FAIL — `assetsBase` is not assignable / the new assertions fail.

- [ ] **Step 3: Implement the injection**

In `app/extension/src/webview-html.ts`, add `assetsBase` to the args interface and inject the script. The full file becomes:

```ts
export interface IBuildWebviewHtmlArgs {
  scriptUri: string;
  styleUri: string;
  cspSource: string;
  nonce: string;
  assetsBase: string;
}

export const buildWebviewHtml = (args: IBuildWebviewHtmlArgs): string => {
  const { scriptUri, styleUri, cspSource, nonce, assetsBase } = args;
  // Google Fonts: the @import pulls a stylesheet from fonts.googleapis.com and the
  // font files from fonts.gstatic.com — both must be allowlisted or the webview CSP
  // silently blocks them and the pixel/fantasy fonts fall back to system fonts.
  const csp = [
    "default-src 'none'",
    `img-src ${cspSource} data:`,
    `font-src ${cspSource} https://fonts.gstatic.com`,
    `style-src ${cspSource} https://fonts.googleapis.com`,
    `script-src 'nonce-${nonce}'`,
  ].join("; ");
  // Set the asset base before the deferred app module runs so assetUrl() resolves sprite
  // paths against the webview origin. A non-module inline script executes during parse,
  // ahead of type="module" scripts.
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="Content-Security-Policy" content="${csp};" />
    <link rel="stylesheet" href="${styleUri}" />
    <title>Commit Quest</title>
  </head>
  <body>
    <div id="root"></div>
    <script nonce="${nonce}">window.__CQ_ASSETS__=${JSON.stringify(assetsBase)};</script>
    <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
  </body>
</html>`;
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app/extension && bun test src/webview-html.test.ts 2>&1 | grep -E "pass|fail"`
Expected: 2 pass, 0 fail.

- [ ] **Step 5: Commit**

```bash
cd /Users/calypso/Project/Ottery/commit-quest
git add app/extension/src/webview-html.ts app/extension/src/webview-html.test.ts
git commit -m "feat(ext): inject __CQ_ASSETS__ base into the webview html"
```

---

## Task 8: Pass the webview asset base from the host — `extension.ts`

**Files:**
- Modify: `app/extension/src/extension.ts` (the `resolveView` body, around lines 22–38)

Compute the webview URI of the `webview/` root and pass it as `assetsBase`. `assetUrl("/sprites/x")` then becomes `<webviewUri>/sprites/x`, which `localResourceRoots: [distRoot]` already permits.

- [ ] **Step 1: Compute and pass `assetsBase`**

In `app/extension/src/extension.ts`, after the `styleUri` assignment and before `webview.html = buildWebviewHtml({`, add:

```ts
  const assetsBase = webview.asWebviewUri(distRoot).toString();
```
Then add `assetsBase` to the `buildWebviewHtml({ … })` call:
```ts
  webview.html = buildWebviewHtml({
    scriptUri,
    styleUri,
    cspSource: webview.cspSource,
    nonce: nonce(),
    assetsBase,
  });
```

- [ ] **Step 2: Build the extension host (typecheck via esbuild bundle)**

Run:
```bash
cd /Users/calypso/Project/Ottery/commit-quest/app/extension
node esbuild.mjs 2>&1 | tail -5
```
Expected: bundles `dist/extension.js` with no errors (a type/reference error in `extension.ts` would fail the build).

- [ ] **Step 3: Run the extension test suite (no regressions)**

Run: `cd app/extension && bun test 2>&1 | grep -E "pass|fail"`
Expected: all pass, 0 fail.

- [ ] **Step 4: Commit**

```bash
cd /Users/calypso/Project/Ottery/commit-quest
git add app/extension/src/extension.ts
git commit -m "feat(ext): pass webview asset base to the renderer"
```

---

## Task 9: Final integration — rebuild, repackage, full suite

**Files:** none (verification + package only)

- [ ] **Step 1: Full build + copy + repackage the extension**

Run:
```bash
cd /Users/calypso/Project/Ottery/commit-quest/app
npm run build 2>&1 | tail -2
node extension/scripts/copy-webview.mjs
cd extension && node esbuild.mjs 2>&1 | tail -2
ls webview/sprites/mage/t1
```
Expected: build succeeds, copy prints the sprites line, esbuild bundles clean, `ls` shows the 10 sprite files under `webview/sprites/mage/t1`.

- [ ] **Step 2: Run both full test suites**

Run:
```bash
cd /Users/calypso/Project/Ottery/commit-quest/app && bun test 2>&1 | grep -E "pass|fail"
cd /Users/calypso/Project/Ottery/commit-quest/app/extension && bun test 2>&1 | grep -E "pass|fail"
```
Expected: both suites all pass, 0 fail.

- [ ] **Step 3: Prettier**

Run: `cd /Users/calypso/Project/Ottery/commit-quest && bun run format 2>&1 | tail -3`
Expected: files formatted / already clean. If anything changed, `git add -A && git commit -m "style: prettier"`.

---

## Self-Review (completed)

**Spec coverage:** Asset layout §1 → Task 1. Manifest §2 → Task 3. Hook §3 → Task 4. State→source map §4 → Task 3 (`heroFrames`) + Task 5. Hero component §5 → Task 5. Asset base §6 → Task 2 + Tasks 7/8. Build/extension wiring §7 → Tasks 6/7/8. Testing §8 → Tasks 2/3/4 (pure helpers; Hero visual per the no-jsdom note). Fallback §9 → covered by `heroSpriteSet` returning `undefined` (Task 3 test) + emoji-preserving `.has-art` CSS (Task 5).

**Type consistency:** `ISpriteSet { idle, walk }`, `heroSpriteSet(line, tier)`, `heroFrames(set, anim)`, `frameAt(elapsedMs, count, fps)`, `useSpriteFrame(frames, fps, playing)`, `joinAsset(base, path)`/`assetUrl(path)`, `IBuildWebviewHtmlArgs.assetsBase` — names match across all tasks. `HeroAnim` imported from `app/src/combat.ts` (existing enum); `Hero` props tighten `anim: string` → `anim: HeroAnim` and add `tier: number`.

**Out of scope (per spec):** monsters/boss frames, the 7 unused rotations, dedicated attack/hurt/celebrate frames, per-tier/other-line art — none planned; manifest + hook generalize to them with no code change.
