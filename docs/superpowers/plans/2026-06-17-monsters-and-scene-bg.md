# Monsters & Scene Backgrounds Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the battle-scene art pipeline + render code + prompt pack so monsters play real idle/attack sprites and scenes show a full-panel background image — wired on for grassland/forest/dungeon once their art is generated.

**Architecture:** Mirrors the hero pipeline (import → `app/public/` → manifest → DOM frame renderer). A new importer `monster` handler, two small manifests (`monsters.ts`, `scene-bg.ts`), frame-cycling in `monster.tsx`, a back-layer `.scene-bg` in `scene-view.tsx`, and a reorganized `art-prompts.md` §7. **Manifests ship empty** (graceful fallback to today's emoji/gradient — zero visual change); the 3 starter themes are wired in a trivial follow-up once the user generates art from the new prompts.

**Tech Stack:** Bun + React 19 + Vite + TS; `bun test`; bash-free TS importer run via `bun tools/import-art.ts`.

**Spec:** `docs/superpowers/specs/2026-06-17-monsters-and-scene-bg-design.md`

**Branch:** `feat/monsters-scene-bg` (off main; spec already committed there).

**Conventions** (`app/CLAUDE.md` + root `CLAUDE.md`): arrow-const only; `interface I*` / `type T*`; **string enums**; no `any`; braces on every if/else; no multi-line/nested ternaries; one component per file `export default`; body order props→hooks→state→derived→effect→handlers→guards→JSX; type-only `IState` import; comments explain WHY; kebab-case; Prettier owns formatting.

**Run tests:** root `bun test 2>&1 | grep -E "pass|fail"` (covers `test/` + `app/src/*.test.ts`). App typecheck: `cd app && bun run typecheck 2>&1 | tail -3`.

**Sequencing note:** Monster/scene ART does not exist yet — the user generates it from the §7 prompts (Task 6) after this lands, then a follow-up imports it and adds the manifest entries (one line each). So tasks here are verified by unit tests (pure helpers) + a controller browser-check using a throwaway placeholder image that is NOT committed.

---

## File Structure

- `tools/import-art.ts` — add `importMonster` + register (Task 1).
- `app/src/monsters.ts` — NEW: `IMonsterSet`, `buildMonsterSet`, `MONSTER_SPRITES` (empty), `monsterSet`, `monsterFrames` (Task 2).
- `app/src/scene-bg.ts` — NEW: `SCENE_BGS` (empty), `hasSceneBg` (Task 3).
- `app/src/components/monster.tsx` — frame-cycle render (Task 4).
- `app/src/components/scene-view.tsx` + `app/src/styles.css` — `.scene-bg` back layer (Task 5).
- `docs/reference/art-prompts.md` — §7 monster + scene prompt pack (Task 6).

---

## Task 1: Importer — monster handler

**Files:**
- Modify: `tools/import-art.ts`
- Test: `test/tools/import-art.test.ts`

- [ ] **Step 1: Add failing tests** — append to `test/tools/import-art.test.ts`:

```ts
test("parseTarget reads monster name", () => {
  expect(parseTarget("monster:grassland")).toEqual({
    type: AssetType.Monster,
    name: "grassland",
  });
});

test("pickAnimDir finds monster idle/attack folders", () => {
  const names = ["idle_breathing_loop", "attack_lunge_forward"];
  expect(pickAnimDir(names, "dle")).toBe("idle_breathing_loop");
  expect(pickAnimDir(names, "ttack")).toBe("attack_lunge_forward");
});
```

- [ ] **Step 2: Run — expect the new tests PASS already** (`parseTarget`/`pickAnimDir` are generic) — this just locks the monster contract.

Run: `cd /Users/calypso/Project/Ottery/commit-quest && bun test test/tools/import-art.test.ts 2>&1 | grep -E "pass|fail"`
Expected: all pass.

- [ ] **Step 3: Implement `importMonster` in `tools/import-art.ts`.** Add this helper + function just above the `notImplemented` definition (after `importItem`):

```ts
// Monster anims may be single-direction (frames directly in the anim folder) or multi-direction
// (frames under west/south/…). The battle mob faces the hero on the left, so prefer the west view.
const animFrameDir = (animPath: string): string => {
  const west = join(animPath, "west");
  if (existsSync(west)) {
    return west;
  }
  return animPath;
};

// PixelLab creature export -> sprites/monsters/<theme>/{idle/N, attack/N} (west = faces the hero).
const importMonster = (rawDir: string, target: ITarget): void => {
  const theme = target.name ?? "";
  const out = join(PUBLIC, "sprites", "monsters", theme);
  const animDir = join(rawDir, "animations");
  if (!existsSync(animDir)) {
    throw new Error(`monster export missing animations/ in ${rawDir}`);
  }
  const animNames = readdirSync(animDir);
  const idle = pickAnimDir(animNames, "dle");
  const attack = pickAnimDir(animNames, "ttack");
  if (!idle) {
    throw new Error(`monster export has no idle animation in ${animDir}`);
  }

  rmSync(out, { recursive: true, force: true });
  const copyAnim = (animName: string, sub: string): number => {
    const src = animFrameDir(join(animDir, animName));
    mkdirSync(join(out, sub), { recursive: true });
    const files = pngs(src);
    for (const f of files) {
      copyFileSync(join(src, f), join(out, sub, `${frameIndex(f)}.png`));
    }
    return files.length;
  };

  const idleN = copyAnim(idle, "idle");
  let attackN = 0;
  if (attack) {
    attackN = copyAnim(attack, "attack");
  } else {
    console.warn("  (no attack animation found — skipping attack/)");
  }
  console.log(`monster ${theme} -> ${out}  (idle: ${idleN}, attack: ${attackN})`);
};
```

Then register it (replace the monster stub line):
```ts
  [AssetType.Monster]: importMonster,
```

- [ ] **Step 4: Run the importer test + typecheck the tool.**

Run: `cd /Users/calypso/Project/Ottery/commit-quest && bun test test/tools/import-art.test.ts 2>&1 | grep -E "pass|fail"` (pass) and `bun build tools/import-art.ts --target=bun > /dev/null && echo OK` (compiles).

- [ ] **Step 5: Commit**

```bash
cd /Users/calypso/Project/Ottery/commit-quest
git add tools/import-art.ts test/tools/import-art.test.ts
git commit -m "feat(tools): import-art monster handler (idle + attack, west)"
```

---

## Task 2: Monster manifest (`monsters.ts`)

**Files:**
- Create: `app/src/monsters.ts`
- Test: `app/src/monsters.test.ts`

- [ ] **Step 1: Write the failing test** — create `app/src/monsters.test.ts`:

```ts
import { test, expect } from "bun:test";
import { SceneTheme } from "./scene";
import { MonsterAnim } from "./combat";
import { buildMonsterSet, monsterSet, monsterFrames } from "./monsters";

test("buildMonsterSet lays out idle + attack frame paths", () => {
  const set = buildMonsterSet("grassland", 3, 2);
  expect(set.idle).toEqual([
    "/sprites/monsters/grassland/idle/0.png",
    "/sprites/monsters/grassland/idle/1.png",
    "/sprites/monsters/grassland/idle/2.png",
  ]);
  expect(set.attack).toEqual([
    "/sprites/monsters/grassland/attack/0.png",
    "/sprites/monsters/grassland/attack/1.png",
  ]);
});

test("monsterFrames picks attack on attack anim, else idle", () => {
  const set = buildMonsterSet("forest", 2, 2);
  expect(monsterFrames(set, MonsterAnim.Attack)).toBe(set.attack);
  expect(monsterFrames(set, MonsterAnim.Idle)).toBe(set.idle);
  expect(monsterFrames(set, MonsterAnim.Hurt)).toBe(set.idle);
  expect(monsterFrames(undefined, MonsterAnim.Idle)).toEqual([]);
});

test("monsterSet returns undefined for an unwired theme", () => {
  expect(monsterSet(SceneTheme.Guild)).toBeUndefined();
});
```

- [ ] **Step 2: Run — expect FAIL** (`./monsters` missing).

Run: `cd /Users/calypso/Project/Ottery/commit-quest/app && bun test src/monsters.test.ts 2>&1 | grep -E "pass|fail|error"`

- [ ] **Step 3: Create `app/src/monsters.ts`:**

```ts
import { SceneTheme } from "./scene";
import { MonsterAnim } from "./combat";

export interface IMonsterSet {
  idle: string[]; // west-facing idle loop
  attack: string[]; // west-facing attack pose (one-shot per attack beat)
}

export const buildMonsterSet = (
  theme: string,
  idleFrames: number,
  attackFrames: number,
): IMonsterSet => ({
  idle: Array.from(
    { length: idleFrames },
    (_, i) => `/sprites/monsters/${theme}/idle/${i}.png`,
  ),
  attack: Array.from(
    { length: attackFrames },
    (_, i) => `/sprites/monsters/${theme}/attack/${i}.png`,
  ),
});

// Empty until art lands. After importing a theme's art (the importer prints idle/attack frame
// counts), add e.g. `[SceneTheme.Grassland]: buildMonsterSet("grassland", 4, 3),`. A missing theme
// returns undefined → the renderer keeps the emoji placeholder.
export const MONSTER_SPRITES: Partial<Record<SceneTheme, IMonsterSet>> = {};

export const monsterSet = (theme: SceneTheme): IMonsterSet | undefined =>
  MONSTER_SPRITES[theme];

// Attack frames on the attack beat (if any), otherwise the idle loop. Hurt/die keep the idle frames
// while their CSS keyframes (flash / fade) play over the top.
export const monsterFrames = (
  set: IMonsterSet | undefined,
  anim: MonsterAnim,
): string[] => {
  if (!set) {
    return [];
  }
  if (anim === MonsterAnim.Attack && set.attack.length > 0) {
    return set.attack;
  }
  return set.idle;
};
```

- [ ] **Step 4: Run — expect pass.**

Run: `cd /Users/calypso/Project/Ottery/commit-quest/app && bun test src/monsters.test.ts 2>&1 | grep -E "pass|fail"` and `bun run typecheck 2>&1 | tail -2`.

- [ ] **Step 5: Commit**

```bash
cd /Users/calypso/Project/Ottery/commit-quest
git add app/src/monsters.ts app/src/monsters.test.ts
git commit -m "feat(app): monster sprite manifest (idle + attack, empty until art lands)"
```

---

## Task 3: Scene-bg manifest (`scene-bg.ts`)

**Files:**
- Create: `app/src/scene-bg.ts`
- Test: `app/src/scene-bg.test.ts`

- [ ] **Step 1: Write the failing test** — create `app/src/scene-bg.test.ts`:

```ts
import { test, expect } from "bun:test";
import { SceneTheme } from "./scene";
import { hasSceneBg } from "./scene-bg";

test("hasSceneBg is false until a theme's art is wired in", () => {
  expect(hasSceneBg(SceneTheme.Guild)).toBe(false);
  expect(hasSceneBg(SceneTheme.Grassland)).toBe(false);
});
```

- [ ] **Step 2: Run — expect FAIL** (`./scene-bg` missing).

Run: `cd /Users/calypso/Project/Ottery/commit-quest/app && bun test src/scene-bg.test.ts 2>&1 | grep -E "pass|fail|error"`

- [ ] **Step 3: Create `app/src/scene-bg.ts`:**

```ts
import { SceneTheme } from "./scene";

// Themes with a real /scenes/<theme>.png background. Empty until art lands; add a theme here after
// importing its scene image. A theme not in the set falls back to the .sky CSS gradient.
export const SCENE_BGS = new Set<SceneTheme>();

export const hasSceneBg = (theme: SceneTheme): boolean => SCENE_BGS.has(theme);
```

- [ ] **Step 4: Run — expect pass + typecheck clean.**

Run: `cd /Users/calypso/Project/Ottery/commit-quest/app && bun test src/scene-bg.test.ts 2>&1 | grep -E "pass|fail"` and `bun run typecheck 2>&1 | tail -2`.

- [ ] **Step 5: Commit**

```bash
cd /Users/calypso/Project/Ottery/commit-quest
git add app/src/scene-bg.ts app/src/scene-bg.test.ts
git commit -m "feat(app): scene-bg manifest (empty until art lands)"
```

---

## Task 4: Monster renders real frames

**Files:**
- Modify: `app/src/components/monster.tsx`

No unit test (rendering; logic lives in the tested `monsterFrames`). Verified in the browser at Task 7.

- [ ] **Step 1: Replace `app/src/components/monster.tsx`:**

```tsx
import { useEffect } from "react";
import type { IScene } from "../scene";
import { MonsterAnim } from "../combat";
import { slotPos } from "../mob-slots";
import { monsterSet, monsterFrames } from "../monsters";
import { useSpriteFrame } from "../use-sprite-frame";
import { assetUrl } from "../assets-base";

interface IProps {
  scene: IScene;
  anim: MonsterAnim;
  hp: number; // 0..1 cosmetic
  slot: number; // pack index → horizontal position
}

const MONSTER_FPS = 6;

const Monster = (props: IProps) => {
  const { scene, anim, hp, slot } = props;
  const set = monsterSet(scene.theme);
  const attacking = anim === MonsterAnim.Attack && Boolean(set?.attack.length);
  const frames = monsterFrames(set, anim);
  const frame = useSpriteFrame(frames, MONSTER_FPS, frames.length > 1);

  // Decode idle+attack frames once so the first swap doesn't flash (usePreload is hero-set shaped).
  useEffect(() => {
    if (!set) {
      return;
    }
    for (const url of [...set.idle, ...set.attack]) {
      const img = new Image();
      img.src = assetUrl(url);
    }
  }, [set]);

  const bg = frame ? { backgroundImage: `url(${assetUrl(frame)})` } : undefined;
  const artClass = frame ? " has-art" : "";
  // Keep m-hurt (flash) / m-die (fade) over the sprite; drop the m-attack lunge when real attack
  // frames carry the motion themselves.
  const animClass = attacking ? "" : ` m-${anim}`;
  const hpPct = Math.max(0, Math.min(1, hp)) * 100;
  return (
    <div className="monster-unit mob-spawn" style={slotPos(slot)}>
      <div className="monster-hp">
        <i style={{ width: `${hpPct}%` }} />
      </div>
      <span
        className={`sprite monster monster-${scene.theme}${animClass}${artClass}`}
        style={bg}
        aria-label={scene.monster}
      />
    </div>
  );
};

export default Monster;
```

- [ ] **Step 2: Typecheck + full suite.**

Run: `cd /Users/calypso/Project/Ottery/commit-quest/app && bun run typecheck 2>&1 | tail -3` (clean — `battle-scene.tsx` passes `m.anim` which is already `MonsterAnim`) and `bun test 2>&1 | grep -E "pass|fail"` (all pass). Prettier: `cd /Users/calypso/Project/Ottery/commit-quest && npx prettier --write app/src/components/monster.tsx 2>&1 | tail -1`.

- [ ] **Step 3: Commit**

```bash
cd /Users/calypso/Project/Ottery/commit-quest
git add app/src/components/monster.tsx
git commit -m "feat(app): monster plays idle/attack sprite frames (emoji fallback kept)"
```

---

## Task 5: Scene background layer

**Files:**
- Modify: `app/src/components/scene-view.tsx`, `app/src/styles.css`

- [ ] **Step 1: Add the BG layer in `app/src/components/scene-view.tsx`.**

Add two imports (after the existing imports, line ~18):
```ts
import { hasSceneBg } from "../scene-bg";
import { assetUrl } from "../assets-base";
```

Insert the layer right after the `<div className="sky" aria-hidden="true" />` line:
```tsx
        <div className="sky" aria-hidden="true" />
        {mode === SceneMode.Battle && hasSceneBg(sceneInfo.theme) && (
          <div
            className="scene-bg"
            aria-hidden="true"
            style={{
              backgroundImage: `url(${assetUrl(`/scenes/${sceneInfo.theme}.png`)})`,
            }}
          />
        )}
```

- [ ] **Step 2: Add `.scene-bg` to `app/src/styles.css`** — right after the `.sky { … }` rule (it ends around line 100, before `.scene-grassland .sky`):

```css
/* Full-panel scene image; paints over the .sky gradient (DOM order) and sits behind the actors. */
.scene-bg {
  position: absolute;
  inset: 0;
  background: center / cover no-repeat;
  image-rendering: pixelated;
}
```

- [ ] **Step 3: Typecheck + full suite + Prettier.**

Run: `cd /Users/calypso/Project/Ottery/commit-quest/app && bun run typecheck 2>&1 | tail -3` (clean) and `bun test 2>&1 | grep -E "pass|fail"` (pass). Then `cd /Users/calypso/Project/Ottery/commit-quest && npx prettier --write app/src/components/scene-view.tsx app/src/styles.css 2>&1 | tail -1`.

- [ ] **Step 4: Commit**

```bash
cd /Users/calypso/Project/Ottery/commit-quest
git add app/src/components/scene-view.tsx app/src/styles.css
git commit -m "feat(app): render full-panel scene background when art exists"
```

---

## Task 6: Prompt pack — reorganize `art-prompts.md` §7

**Files:**
- Modify: `docs/reference/art-prompts.md`

Doc only. Elevate §7 to the §4 character standard: shared constants + idle/attack action descriptions, a scene-background prompt template, and the 3 starter themes fully authored as per-monster blocks.

- [ ] **Step 1: Replace the `### 7.1 ฉากพื้น T1–T3 …` subsection** (the table + the three-line code block) with the structured pack below. Keep §7 intro, §7.2, §7.3, §7.4 as-is, and add a one-line pointer at the top of §7.2/§7.3 that their monsters reuse the §7.A actions + §7.B scene template.

New content (insert as §7.A, §7.B, then the rewritten §7.1):

````markdown
### 7.A Monster constants + idle/attack action descriptions

ตั้งค่าฟอร์มเหมือน §1 (**Low Top-Down · Black outline · Highly detailed**) · **ขนาด 56×56** (เท่าฮีโร่ · importer copy-only ไม่ normalize) · gen ตัวหัน **ซ้าย (west)** = หันเข้าหาฮีโร่ · ทำ 2 animation: **idle + attack**

**constants** (ครึ่งหน้าของทุก prompt มอน):
`(not human), full body head-to-toe, centered, slightly stylized, clean 1px black outline` · negative: `blurry, 3d, realistic, text, watermark, human`

**Action Description (ใช้ซ้ำทุกตัว — keep-first-frame ✓):**
- idle: `a slow idle loop, breathing and bobbing gently in place, facing left, keeping its form and colors unchanged`
- attack: `a forward attack, lunging left toward the opponent and striking then recovering, the body fully facing left the whole time, keeping its form and colors unchanged`

(ตาย = เฟดหาย, โดน = แฟลช → ทำฝั่งเกม (CSS) ไม่ต้อง gen)

### 7.B Scene background — prompt template

ฉากรบ = **รูปเดียวเต็ม panel** (ฟ้า+พื้นในรูป) · อัตราส่วน **กว้างกว่าสูง (~5:3)** · **เส้นพื้น/ขอบฟ้าอยู่โซนล่าง (lower third)** ให้ตัวละครยืนได้ · **ไม่มีตัวละคร/มอนในรูป**

template:
```
a side-view pixel-art battle background of <SCENE>, full scene, the ground/horizon line in the lower third so characters can stand on it, no characters, no creatures, <palette + mood>, limited palette, clean pixel art, slightly stylized
```

### 7.1 ฉากพื้น T1–T3 (ใช้ร่วมทุกสาย) — มอน + ฉาก

**T1 · ทุ่งหญ้าหน้าเมือง — Bug Slime**
- monster: `a small round slime creature, translucent sickly-green jelly speckled with tiny glitch pixels, two big round cartoon eyes, tiny and slightly menacing` + (constants §7.A)
- scene: `a side-view pixel-art battle background of a grassy meadow outside a town, bright green field, clear blue sky, distant town walls, the ground line in the lower third, no characters, cheerful, limited palette, clean pixel art`

**T2 · ป่ากระซิบ / ถ้ำ — Error Wraith**
- monster: `a floating ghostly wraith, tattered cloak woven from fragmented red error-glyphs, hollow glowing red eyes, wispy crimson smoke trail, eerie` + (constants §7.A)
- scene: `a side-view pixel-art battle background of a dark whispering forest, deep green foliage, drifting fog, dim light filtering through the canopy, the ground line in the lower third, no characters, eerie, limited palette, clean pixel art`

**T3 · ดันเจียนลึก — Dungeon Brute**
- monster: `a hulking armored troll brute, cracked iron-grey stone skin, heavy spiked club, glowing orange eyes, imposing` + (constants §7.A)
- scene: `a side-view pixel-art battle background of a deep stone dungeon, grey brick walls, flickering wall torches, heavy shadows, the ground line in the lower third, no characters, oppressive, limited palette, clean pixel art`

> idle/attack ของทั้ง 3 ตัว = ใช้ Action Description กลางใน §7.A · import: `bun tools/import-art.ts <export> --as monster:grassland` (grassland/forest/dungeon) + `--as bg:grassland` สำหรับรูปฉาก
````

- [ ] **Step 2: Add the §7.2 / §7.3 pointer.** At the very start of `### 7.2 …` and `### 7.3 …`, add one line: `> idle/attack action + ขนาด 56×56 = §7.A · scene background prompt = §7.B (เติมต่อ <SCENE> ตามแดน)`.

- [ ] **Step 3: Prettier-check the doc.**

Run: `cd /Users/calypso/Project/Ottery/commit-quest && npx prettier --check docs/reference/art-prompts.md 2>&1 | tail -1` (write if it complains).

- [ ] **Step 4: Commit**

```bash
cd /Users/calypso/Project/Ottery/commit-quest
git add docs/reference/art-prompts.md
git commit -m "docs: monster + scene prompt pack (§7.A actions, §7.B scene, starters)"
```

---

## Task 7: Controller verification + final sweep

Done by the controller (browser), not a subagent. Proves the render wiring without committing placeholder art.

- [ ] **Step 1: Drop throwaway placeholder art** for one theme (reuse an existing hero sprite so a real PNG loads):

```bash
cd /Users/calypso/Project/Ottery/commit-quest/app/public/sprites
mkdir -p monsters/grassland/idle monsters/grassland/attack ../../public/scenes 2>/dev/null
cp mage/t1/idle/west.png monsters/grassland/idle/0.png
cp mage/t1/idle/west.png monsters/grassland/attack/0.png
cp mage/t1/idle/south.png ../scenes/grassland.png
```

- [ ] **Step 2: Temporarily wire grassland** — in `app/src/monsters.ts` set `MONSTER_SPRITES = { [SceneTheme.Grassland]: buildMonsterSet("grassland", 1, 1) }` and in `app/src/scene-bg.ts` `new Set<SceneTheme>([SceneTheme.Grassland])`. (These edits are reverted in Step 5.)

- [ ] **Step 3: Build + serve a grassland (Farming) fixture** and browser-verify:

```bash
cd /Users/calypso/Project/Ottery/commit-quest/app
pkill -f "bun server.ts" 2>/dev/null; sleep 0.3
npm run build 2>&1 | tail -1
FAKE="$CLAUDE_JOB_DIR/tmp/fakemon"; mkdir -p "$FAKE"
NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)
cat > "$FAKE/state.json" <<JSON
{ "version":1,"updated_at":"$NOW","xp_total":300,"level":4,"xp_in_level":10,"xp_to_next":100,
  "stats":{"prompts":20,"actions":{"edit":10},"sessions":3,"by_source":{},"by_repo":{},"boss_defeated":0,"boss_fled":0},
  "class":{"line":"mage","tier":1,"form":"Backend Mage","icon":"⚔","branch":null,"affinity":{"mage":0.8,"ranger":0.1,"rogue":0.05,"sage":0.05}},
  "last_event":{"ts":"$NOW","type":"post_tool"},"inventory":[],"recent":[],"cosmetics":{} }
JSON
AGENTRPG_HOME="$FAKE" AGENTRPG_PORT=7182 nohup bun server.ts > "$CLAUDE_JOB_DIR/tmp/serve-mon.log" 2>&1 &
sleep 1.3; echo "serve $(curl -s -o /dev/null -w '%{http_code}' http://localhost:7182/)"
```
With Playwright at `http://localhost:7182`: confirm `.scene-bg` exists with `background-image` → `/scenes/grassland.png`, and a `.monster.has-art` exists with `background-image` → `/sprites/monsters/grassland/idle/0.png` (the emoji `::after` gone). Screenshot, then kill the server.

- [ ] **Step 4: Kill server + delete placeholder art**

```bash
pkill -f "bun server.ts" 2>/dev/null
cd /Users/calypso/Project/Ottery/commit-quest
rm -rf app/public/sprites/monsters app/public/scenes/grassland.png app/.playwright-mcp .playwright-mcp *.png
```

- [ ] **Step 5: Revert the temp wiring** — restore `MONSTER_SPRITES = {}` (Task 2) and `SCENE_BGS = new Set<SceneTheme>()` (Task 3) with `git checkout -- app/src/monsters.ts app/src/scene-bg.ts`. Confirm `git status` shows no `monsters`/`scenes` art and the manifests are back to empty.

- [ ] **Step 6: Final sweep**

Run: `cd /Users/calypso/Project/Ottery/commit-quest/app && bun test 2>&1 | grep -E "pass|fail" | tail -1` (0 fail) and `cd /Users/calypso/Project/Ottery/commit-quest && bun run format 2>&1 | tail -1`. If Prettier changed tracked files, `git add -A && git commit -m "style: prettier"`.

---

## Self-Review (completed)

**Spec coverage:** Importer monster handler §1 → Task 1. Monster manifest+render §2/§3-render → Tasks 2, 4. Scene-bg §3 → Tasks 3, 5. Prompt pack §4 → Task 6. Fallback (empty manifests → emoji/gradient) → Tasks 2/3 ship empty; Task 4 `frame` guard + Task 5 `hasSceneBg` guard. Testing §"Testing" → Tasks 1-3 unit tests + Task 7 browser. Boss/other themes/hurt-die-CSS/multi-dir → out of scope, untouched.

**Placeholder scan:** No TBD/TODO. The empty `MONSTER_SPRITES = {}` / `SCENE_BGS = new Set()` are intentional (documented "until art lands"), not gaps. The `buildMonsterSet("grassland", 1, 1)` in Task 7 is throwaway verification, reverted in Step 5.

**Type consistency:** `IMonsterSet { idle, attack }`, `buildMonsterSet(theme, idleFrames, attackFrames)`, `monsterSet(theme)`, `monsterFrames(set, anim)`, `MONSTER_SPRITES`, `SCENE_BGS`, `hasSceneBg(theme)`, `MonsterAnim` (from `combat.ts`), `MONSTER_FPS`, `.scene-bg`, `.monster … has-art` — names consistent across tasks. `monster.tsx` prop `anim: MonsterAnim` matches `ISceneView.mobs[].anim` (already `MonsterAnim`) passed by `battle-scene.tsx`. Importer `--as monster:<theme>` matches the `parseTarget` name-shape (already supported).

**Sequencing:** Manifests ship empty → no broken images, zero visual change. Render code proven via Task 7 placeholder. Real art + 3 manifest entries land in a follow-up after the user generates from §7.
