# Aspect-Locked Battle Stage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render the battle inside an aspect-locked "stage" (fit + bottom-centered, letterboxed by the themed sky gradient) with actors sized relative to the stage, so the scene never zooms/crops and the hero/monsters stay proportionate at any panel shape.

**Architecture:** A battle-only `.battle-frame` flex layer over `.scene` fits-and-bottom-centers a `.battle-stage` locked to the scene's 400/128 ratio; the scene image + all battle actors move inside the stage; actors are sized in container-query units (`cqh` = % of stage height). The `.sky` per-theme gradient stays full-panel behind everything as the letterbox. Overworld and overlays are untouched.

**Tech Stack:** React 19 + Vite + TS + CSS (`aspect-ratio`, container queries / `cqh` units). Pure layout — no `bun test` logic change.

**Spec:** `docs/superpowers/specs/2026-06-17-battle-stage-design.md`

**Branch:** `feat/scene-bg-grassland` (continues the scene work; spec already committed there).

**Conventions** (`app/CLAUDE.md`): one component per file; no logic in components; Prettier owns formatting. This is layout-only — no new types/enums.

**Run:** typecheck `cd app && bun run typecheck 2>&1 | tail -3`; full suite `cd app && bun test 2>&1 | grep -E "pass|fail"` (must stay green — no logic touched). Browser verify via `bun server.ts` + a grassland Farming fixture (Task 3).

**Note:** No unit tests — this is CSS/DOM layout. Correctness is verified in the browser at several panel shapes (Task 3). Keep the existing suite green.

---

## File Structure

- `app/src/components/scene-view.tsx` — wrap the battle (scene-bg + `BattleScene`) in `.battle-frame > .battle-stage` (Task 1).
- `app/src/styles.css` — `.battle-frame` + `.battle-stage` rules; convert actor sizes to `cqh` (Tasks 1, 2).
- `battle-scene.tsx` and the actor components are **unchanged** (they render the same absolutely-positioned actors; only their containing block + CSS sizes change).

---

## Task 1: The stage (structure + frame/stage CSS)

**Files:**
- Modify: `app/src/components/scene-view.tsx`
- Modify: `app/src/styles.css`

- [ ] **Step 1: Wrap the battle in a frame + stage** — in `app/src/components/scene-view.tsx`, REPLACE the two battle blocks (the `scene-bg` conditional and the `BattleScene` conditional, currently lines ~50–68):

```tsx
        {mode === SceneMode.Battle && hasSceneBg(sceneInfo.theme) && (
          <div
            className="scene-bg"
            aria-hidden="true"
            style={{
              backgroundImage: `url(${assetUrl(`/scenes/${sceneInfo.theme}.png`)})`,
            }}
          />
        )}
        {mode === SceneMode.Battle && (
          <BattleScene
            state={state}
            activity={activity}
            sceneInfo={sceneInfo}
            line={line}
            tier={tier}
            branch={branch}
          />
        )}
```

with a single battle block that nests both inside the frame + stage:

```tsx
        {mode === SceneMode.Battle && (
          <div className="battle-frame">
            <div className="battle-stage">
              {hasSceneBg(sceneInfo.theme) && (
                <div
                  className="scene-bg"
                  aria-hidden="true"
                  style={{
                    backgroundImage: `url(${assetUrl(`/scenes/${sceneInfo.theme}.png`)})`,
                  }}
                />
              )}
              <BattleScene
                state={state}
                activity={activity}
                sceneInfo={sceneInfo}
                line={line}
                tier={tier}
                branch={branch}
              />
            </div>
          </div>
        )}
```
(`.sky`, the Overworld block, and all overlays below stay exactly as they are.)

- [ ] **Step 2: Add the frame + stage CSS** — in `app/src/styles.css`, add these rules just before the existing `.scene-bg` rule (search for `.scene-bg {`):

```css
/* Battle-only layer over the panel: fits + bottom-centers the aspect-locked stage so the scene
   image never distorts. The .sky gradient behind it (full panel) shows around the stage as a
   themed letterbox. */
.battle-frame {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}
/* Locked to the scene image ratio (400x128). height:100% + max-width:100% + aspect-ratio fits the
   largest box that stays in the frame. container-type: size lets actors size in cqh (% of stage). */
.battle-stage {
  position: relative;
  height: 100%;
  aspect-ratio: 400 / 128;
  max-width: 100%;
  overflow: hidden;
  container-type: size;
}
```

- [ ] **Step 3: Re-point the `.scene-bg` comment** — `.scene-bg` no longer fills the panel; it now fills the stage exactly. Update its comment (the rule body is unchanged):

Replace:
```css
/* Full-panel scene image; paints over the .sky gradient (DOM order) and sits behind the actors.
   Anchored to the bottom so any cover-crop trims the sky, never the ground the characters stand on.
   Scenes are authored ~3:1 to match the bottom-dock panel, so the crop is minimal. */
```
with:
```css
/* Scene image; fills the aspect-locked .battle-stage exactly (matching ratio → no zoom/crop) and
   sits behind the actors. Anchored bottom so any sub-pixel rounding trims the sky, not the ground. */
```

- [ ] **Step 4: Typecheck + suite + Prettier.**

Run: `cd /Users/calypso/Project/Ottery/commit-quest/app && bun run typecheck 2>&1 | tail -3` (clean) and `bun test 2>&1 | grep -E "pass|fail"` (unchanged, all pass). Then `cd /Users/calypso/Project/Ottery/commit-quest && npx prettier --write app/src/components/scene-view.tsx app/src/styles.css 2>&1 | tail -1`.

- [ ] **Step 5: Commit**

```bash
cd /Users/calypso/Project/Ottery/commit-quest
git add app/src/components/scene-view.tsx app/src/styles.css
git commit -m "feat(app): aspect-locked battle stage (fit + bottom-center, sky letterbox)"
```

(After this task the stage fits the scene correctly, but actors are still fixed-px — Task 2 scales them.)

---

## Task 2: Scale actors to the stage (cqh)

**Files:**
- Modify: `app/src/styles.css`

Convert the battle actors from fixed px to container-query height units (`cqh` = 1% of the stage height). Reference: at the ~900-wide panel the stage is ~288px tall, so today's 92px hero ≈ 32%, 64px monster ≈ 22%. Starting values below; Task 3 tunes them.

- [ ] **Step 1: Hero** — change the `.hero` rule (keep `left`/`bottom`):

```css
.hero {
  left: 30%;
  bottom: 24%;
  width: 30cqh;
  height: 30cqh;
}
```

- [ ] **Step 2: Monster sprite** — the monster sprite sits inside `.monster-unit`; size it in `cqh` (overrides the `.sprite` 64px). Change the `.monster-unit .monster` rule:

```css
.monster-unit .monster {
  position: static;
  width: 22cqh;
  height: 22cqh;
  font-size: 34px;
}
```

- [ ] **Step 3: Monster HP bar** — scale its width with the monster (keep the thin height). Change `.monster-hp`’s `width`:

```css
.monster-hp {
  width: 16cqh;
  height: 5px;
  border: 1px solid var(--ink);
  background: #241636;
}
```

- [ ] **Step 4: Hit effects** — change `.hit-effect` and `.hit-zap` width/height:

```css
.hit-effect {
  position: absolute;
  width: 12cqh;
  height: 12cqh;
  /* …unchanged background/animation… */
```
```css
.hit-zap {
  position: absolute;
  width: 16cqh;
  height: 16cqh;
  /* …unchanged… */
```
(Only the two `width`/`height` pairs change; leave every other property in those rules as-is.)

- [ ] **Step 5: Typecheck + suite + Prettier.**

Run: `cd /Users/calypso/Project/Ottery/commit-quest/app && bun run typecheck 2>&1 | tail -3` (clean) and `bun test 2>&1 | grep -E "pass|fail"` (all pass). Then `cd /Users/calypso/Project/Ottery/commit-quest && npx prettier --write app/src/styles.css 2>&1 | tail -1`.

- [ ] **Step 6: Commit**

```bash
cd /Users/calypso/Project/Ottery/commit-quest
git add app/src/styles.css
git commit -m "feat(app): size battle actors relative to the stage (cqh units)"
```

---

## Task 3: Controller verification + tune (multiple panel shapes)

Done by the controller (browser). Verifies the stage fits and actors stay proportionate at every panel shape, and tunes the actor `cqh` values to match the approved look.

- [ ] **Step 1: Build + serve a grassland Farming fixture.**

```bash
cd /Users/calypso/Project/Ottery/commit-quest/app
pkill -f "bun server.ts" 2>/dev/null; sleep 0.3
npm run build 2>&1 | tail -1
FAKE="$CLAUDE_JOB_DIR/tmp/fakestage"; mkdir -p "$FAKE"
NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)
cat > "$FAKE/state.json" <<JSON
{ "version":1,"updated_at":"$NOW","xp_total":300,"level":4,"xp_in_level":10,"xp_to_next":100,
  "stats":{"prompts":20,"actions":{"edit":10},"sessions":3,"by_source":{},"by_repo":{},"boss_defeated":0,"boss_fled":0},
  "class":{"line":"mage","tier":1,"form":"Backend Mage","icon":"⚔","branch":null,"affinity":{"mage":0.8,"ranger":0.1,"rogue":0.05,"sage":0.05}},
  "last_event":{"ts":"$NOW","type":"post_tool"},"inventory":[],"recent":[],"cosmetics":{} }
JSON
AGENTRPG_HOME="$FAKE" AGENTRPG_PORT=7186 nohup bun server.ts > "$CLAUDE_JOB_DIR/tmp/serve-stage.log" 2>&1 &
sleep 1.3; echo "serve $(curl -s -o /dev/null -w '%{http_code}' http://localhost:7186/)"
```

- [ ] **Step 2: Screenshot at 4 panel shapes** with Playwright — `browser_resize` then `browser_take_screenshot` at each:
  - **wide-short** 920×300, **tall** 900×800, **small** 520×280, **large** 1400×900.

  In each, confirm via `browser_evaluate`: the `.battle-stage` keeps aspect ~3.125 (`rect.width/rect.height ≈ 3.125`); it's bottom-aligned; the scene image is not zoomed/cropped oddly; the hero (`.hero`) and monster (`.monster`) heights are a sensible fraction of the stage height; the area around the stage shows the `.sky` gradient (letterbox).

- [ ] **Step 3: Tune** the actor `cqh` values in `app/src/styles.css` (`.hero`, `.monster-unit .monster`, `.hit-effect`, `.hit-zap`, `.monster-hp`) until the hero/monster proportions match the approved grassland look across all four shapes. Rebuild + re-screenshot after each change. Commit any tuning:

```bash
cd /Users/calypso/Project/Ottery/commit-quest
git add app/src/styles.css
git commit -m "style(app): tune battle actor sizes on the stage"
```
(Skip the commit if no tuning was needed.)

- [ ] **Step 4: Clean up.**

```bash
pkill -f "bun server.ts" 2>/dev/null
cd /Users/calypso/Project/Ottery/commit-quest
rm -rf app/.playwright-mcp .playwright-mcp
git status --short  # clean
```

---

## Self-Review (completed)

**Spec coverage:** Stage structure §1 → Task 1 (frame/stage wrap). Stage CSS §2 → Task 1 (`.battle-frame`/`.battle-stage`, scene-bg in-stage). Actor sizing §3 → Task 2 (cqh). Letterbox = `.sky` → Task 1 (sky untouched, behind the frame). Browser verification §4 → Task 3 (4 shapes + tune). Overworld/overlays untouched → Task 1 only adds a battle-gated block; `.scene` stays `position:relative`, overlays/Overworld unchanged. Fallback (no scene art → `.sky` shows through transparent stage) → inherent (scene-bg conditional inside the stage; stage has no background).

**Placeholder scan:** No TBD/TODO. The actor `cqh` values are explicit starting numbers (30/22/16/12), tuned in Task 3 — not placeholders.

**Consistency:** Class names `.battle-frame` / `.battle-stage` used identically across Tasks 1–3. `cqh` depends on `container-type: size` (set on `.battle-stage` in Task 1) — defined before used in Task 2. `aspect-ratio: 400 / 128` matches the scene image (400×128) and the spec. scene-bg rule body unchanged (only its container + comment change).

**Risk note:** `container-type: size` on a flex item with `aspect-ratio` is supported in the modern Chromium webview + Vite dev. Task 3 Step 2's aspect assertion catches any failure to size; if `cqh` fails to resolve, the fallback is to give `.battle-stage` an explicit measured size — but this is not expected.
