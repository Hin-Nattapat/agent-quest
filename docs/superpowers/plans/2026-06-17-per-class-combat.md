# Per-Class Combat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the Mage's `AttackStyle` seam so ranger shoots, rogue stabs, and sage invokes — each plays its attack frames + an instant class VFX (arrow streak / glyph burst / slash).

**Architecture:** Generalize the sprite field `cast → attack`, add `Shoot/Stab/Invoke` to `AttackStyle`, gate the effective style on attack-art presence (no regression before frames import), and add `Arrow`/`Glyph` to the hit-effect VFX. The director picks ranged-stand vs melee-dash + the VFX by style. Pure consumer-side; no `core` change.

**Tech Stack:** Bun + React 19 + TS + CSS (`cqh` units), `bun test`; bash-free TS importer.

**Spec:** `docs/superpowers/specs/2026-06-17-per-class-combat-design.md`

**Branch:** `feat/per-class-combat` (off main; spec already committed there).

**Conventions** (`app/CLAUDE.md`): arrow-const; `interface I*`; **string enums**; no `any`; braces on every if/else; no multi-line/nested ternaries; comments explain WHY; Prettier. Tests `bun test`.

**Run:** root `bun test 2>&1 | grep -E "pass|fail"`; app typecheck `cd app && bun run typecheck 2>&1 | tail -3`.

**Sequencing:** Ships the code path; the mage's existing attack (renamed cast→attack) is the proven case. Ranger/rogue/sage attack frames are **not imported yet** — until they are, those lines have no `set.attack` so the director gates them back to Melee (dash+slash) = no regression. Importing their frames + manifest entries is a follow-up once the user re-exports (per `art-prompts.md` §3.2).

---

## File Structure

- `app/src/combat.ts` — `AttackStyle` (+Shoot/Stab/Invoke), `attackStyleFor`, `isRanged` (Task 1).
- `app/src/use-scene-director.ts` — `EffectKind` (+Arrow/Glyph), `effectKindFor`, art-gated style-aware strike (Task 2).
- `app/src/sprites.ts` + `app/src/components/hero.tsx` + mage disk — `cast → attack` rename + generalized playback (Task 3).
- `app/src/components/hit-effect.tsx` + `app/src/styles.css` — arrow/glyph VFX (Task 4).
- `tools/import-art.ts` — attack-animation glob → `attack/` (Task 5).

---

## Task 1: AttackStyle — add the three styles + `isRanged`

**Files:**
- Modify: `app/src/combat.ts`
- Test: `app/src/combat.test.ts`

- [ ] **Step 1: Add failing tests** — append to `app/src/combat.test.ts`:

```ts
import { AttackStyle, attackStyleFor, isRanged } from "./combat";

test("attackStyleFor maps every line to its style", () => {
  expect(attackStyleFor("mage")).toBe(AttackStyle.Cast);
  expect(attackStyleFor("ranger")).toBe(AttackStyle.Shoot);
  expect(attackStyleFor("rogue")).toBe(AttackStyle.Stab);
  expect(attackStyleFor("sage")).toBe(AttackStyle.Invoke);
  expect(attackStyleFor("novice")).toBe(AttackStyle.Melee);
});

test("isRanged: cast/shoot/invoke stand; stab/melee dash", () => {
  expect(isRanged(AttackStyle.Cast)).toBe(true);
  expect(isRanged(AttackStyle.Shoot)).toBe(true);
  expect(isRanged(AttackStyle.Invoke)).toBe(true);
  expect(isRanged(AttackStyle.Stab)).toBe(false);
  expect(isRanged(AttackStyle.Melee)).toBe(false);
});
```
(The existing `combat.test.ts` may already import `AttackStyle`/`attackStyleFor`; if so, just add `isRanged` to that import and the two tests — don't duplicate the import line.)

- [ ] **Step 2: Run — expect FAIL** (`isRanged`/new members missing).

Run: `cd /Users/calypso/Project/Ottery/commit-quest/app && bun test src/combat.test.ts 2>&1 | grep -E "pass|fail|error"`

- [ ] **Step 3: Edit `app/src/combat.ts`** — replace the `AttackStyle` enum + `attackStyleFor` and add `isRanged`:

```ts
export enum AttackStyle {
  Cast = "cast",
  Shoot = "shoot",
  Stab = "stab",
  Invoke = "invoke",
  Melee = "melee",
}

// Which battle attack a class plays. The director gates this on attack-art presence, so a line
// with no attack frames yet falls back to the Melee dash.
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
export const isRanged = (style: AttackStyle): boolean => {
  return (
    style === AttackStyle.Cast ||
    style === AttackStyle.Shoot ||
    style === AttackStyle.Invoke
  );
};
```

- [ ] **Step 4: Run — expect pass + full suite green.**

Run: `cd /Users/calypso/Project/Ottery/commit-quest/app && bun test src/combat.test.ts 2>&1 | grep -E "pass|fail"` and `bun run typecheck 2>&1 | tail -2`.

- [ ] **Step 5: Commit**

```bash
cd /Users/calypso/Project/Ottery/commit-quest
git add app/src/combat.ts app/src/combat.test.ts
git commit -m "feat(app): AttackStyle adds Shoot/Stab/Invoke + isRanged"
```

---

## Task 2: Director — Arrow/Glyph kinds + art-gated style-aware strike

**Files:**
- Modify: `app/src/use-scene-director.ts`
- Test: `app/src/use-scene-director.test.ts` (new)

- [ ] **Step 1: Write the failing test** — create `app/src/use-scene-director.test.ts`:

```ts
import { test, expect } from "bun:test";
import { AttackStyle } from "./combat";
import { EffectKind, effectKindFor } from "./use-scene-director";

test("effectKindFor maps style → VFX", () => {
  expect(effectKindFor(AttackStyle.Cast)).toBe(EffectKind.Zap);
  expect(effectKindFor(AttackStyle.Shoot)).toBe(EffectKind.Arrow);
  expect(effectKindFor(AttackStyle.Invoke)).toBe(EffectKind.Glyph);
  expect(effectKindFor(AttackStyle.Stab)).toBe(EffectKind.Slash);
  expect(effectKindFor(AttackStyle.Melee)).toBe(EffectKind.Slash);
});
```

- [ ] **Step 2: Run — expect FAIL** (`effectKindFor`/`Arrow`/`Glyph` missing).

Run: `cd /Users/calypso/Project/Ottery/commit-quest/app && bun test src/use-scene-director.test.ts 2>&1 | grep -E "pass|fail|error"`

- [ ] **Step 3: Edit `app/src/use-scene-director.ts`.**

(a) Extend `EffectKind`:
```ts
export enum EffectKind {
  Slash = "slash",
  Zap = "zap",
  Arrow = "arrow",
  Glyph = "glyph",
}
```
(b) Add a pure selector just below the enum:
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
(c) Import the helpers + the sprite manifest. Change the `./combat` import to include `isRanged` (and keep `AttackStyle`, `attackStyleFor`), and add a `heroSpriteSet` import:
```ts
import { /* …existing… */ AttackStyle, attackStyleFor, isRanged } from "./combat";
import { heroSpriteSet } from "./sprites";
```
(d) Gate the effective style on attack-art presence. Replace the `styleRef` assignment (currently `styleRef.current = attackStyleFor(state?.class?.line ?? "");`) with:
```ts
  const cls = state?.class;
  const heroSet = cls ? heroSpriteSet(cls.line, cls.tier, cls.branch) : undefined;
  // No attack frames yet → behave as Melee (dash + slash), so unwired lines don't regress.
  styleRef.current = heroSet?.attack
    ? attackStyleFor(cls?.line ?? "")
    : AttackStyle.Melee;
```
(`cls.line`/`cls.tier`/`cls.branch` exist on `state.class`; `heroSpriteSet(line, tier, branch)` is the existing resolver. Note `set.attack` is the renamed field from Task 3 — this task is written against it; until Task 3 lands `heroSet?.attack` is a type error, so **do Task 3's sprites rename first if running out of order**. In sequence Task 2 commits before Task 3, so temporarily reference `heroSet?.cast` here and switch to `heroSet?.attack` is NOT needed — see ordering note below.)

> **Ordering:** Task 3 renames `cast → attack`. To keep every commit compiling, **swap Tasks 2 and 3 order is not required** — instead, in this Task 2 write `heroSet?.cast` (the field as it exists now); Task 3 then renames `cast → attack` across `sprites.ts` + `hero.tsx` + **this line**. The Task 3 steps include updating this `heroSet?.cast` → `heroSet?.attack`.

So for **this** task, use:
```ts
  styleRef.current = heroSet?.cast
    ? attackStyleFor(cls?.line ?? "")
    : AttackStyle.Melee;
```

(e) Replace the strike block's cast-specific lines (currently `const cast = styleRef.current === AttackStyle.Cast; pulse(setAttacking, cast ? CAST_MS : HERO_MS.attack); addEffect(idx, cast ? EffectKind.Zap : EffectKind.Slash);`) with:
```ts
        const style = styleRef.current;
        const ranged = isRanged(style);
        pulse(setAttacking, ranged ? CAST_MS : HERO_MS.attack);
        addEffect(idx, effectKindFor(style));
```

- [ ] **Step 4: Run — expect pass + typecheck clean + full suite green.**

Run: `cd /Users/calypso/Project/Ottery/commit-quest/app && bun test src/use-scene-director.test.ts 2>&1 | grep -E "pass|fail"` and `bun run typecheck 2>&1 | tail -2` (clean — `heroSet?.cast` is the current field) and `bun test 2>&1 | grep -E "pass|fail"`.

- [ ] **Step 5: Commit**

```bash
cd /Users/calypso/Project/Ottery/commit-quest
git add app/src/use-scene-director.ts app/src/use-scene-director.test.ts
git commit -m "feat(app): director arrow/glyph kinds + art-gated style strike"
```

---

## Task 3: Generalize `cast → attack` (sprites + hero + mage disk + director ref)

**Files:**
- Modify: `app/src/sprites.ts`, `app/src/sprites.test.ts`, `app/src/components/hero.tsx`, `app/src/use-scene-director.ts`
- Move: `app/public/sprites/mage/<tier>/cast/` → `attack/` (5 tiers)

- [ ] **Step 1: Move the mage frames on disk** (git-tracked):

```bash
cd /Users/calypso/Project/Ottery/commit-quest
for t in t1 t2 t3 t4a t4b; do git mv "app/public/sprites/mage/$t/cast" "app/public/sprites/mage/$t/attack"; done
ls app/public/sprites/mage/t1/   # expect: attack/ idle/ walk/
```

- [ ] **Step 2: Update the test first** — in `app/src/sprites.test.ts`, change the mage-cast assertions from `cast` to `attack` (find the test that checks `?.cast?.length`/`cast/0.png`):

```ts
  expect(heroSpriteSet("mage", 1)?.attack?.length).toBe(9);
  expect(heroSpriteSet("mage", 1)?.attack?.[0]).toBe("/sprites/mage/t1/attack/0.png");
  expect(heroSpriteSet("mage", 4, "b")?.attack?.[8]).toBe("/sprites/mage/t4b/attack/8.png");
```
Run: `cd app && bun test src/sprites.test.ts 2>&1 | grep -E "pass|fail"` → FAIL (field still `cast`).

- [ ] **Step 3: Rename the field in `app/src/sprites.ts`.** In `ISpriteSet`:
```ts
  attack?: string[]; // east-facing attack frames (cast/shoot/stab/invoke); present where art exists
```
In `buildSet`, rename the param + path:
```ts
const buildSet = (root: string, walkFrames: number, attackFrames = 0): ISpriteSet => {
  // …idle/walk unchanged…
  const set: ISpriteSet = { idle, walk };
  if (attackFrames > 0) {
    set.attack = Array.from(
      { length: attackFrames },
      (_, i) => `/sprites/${root}/attack/${i}.png`,
    );
  }
  return set;
};
```
The `HERO_SPRITES` mage entries stay `buildSet("mage/t1", 9, 9)` (the third 9 now builds `attack/`).

- [ ] **Step 4: Run — sprites test passes.**

Run: `cd /Users/calypso/Project/Ottery/commit-quest/app && bun test src/sprites.test.ts 2>&1 | grep -E "pass|fail"`.

- [ ] **Step 5: Generalize playback in `app/src/components/hero.tsx`.** Replace the cast-specific derivation:

```tsx
import { HeroAnim, AttackStyle, attackStyleFor, isRanged } from "../combat";
// …
const WALK_FPS = 10;
const ATTACK_FPS = 15; // ~9 attack frames over the ranged pulse (CAST_MS 600ms in the director)

const Hero = (props: IProps) => {
  const { line, tier, branch, anim } = props;
  const set = heroSpriteSet(line, tier, branch);
  usePreload(set);
  const attacking = anim === HeroAnim.Attack && Boolean(set?.attack);
  const ranged = isRanged(attackStyleFor(line));
  const moving = anim === HeroAnim.Wander;
  const battleFrames = set ? directionalFrames(set, Facing.East, moving) : [];
  const frames = attacking ? (set?.attack ?? []) : battleFrames;
  const playing = attacking || moving;
  const fps = attacking ? ATTACK_FPS : WALK_FPS;
  const frame = useSpriteFrame(frames, fps, playing);
  const style = frame ? { backgroundImage: `url(${assetUrl(frame)})` } : undefined;
  const artClass = frame ? " has-art" : "";
  // Ranged attack stands (the `cast` class drops the .hero-attack dash); a melee attack keeps the
  // dash class AND cycles the stab frames (transform + background-image are independent).
  const animClass = attacking && ranged ? "cast" : anim;
  return (
    <div
      className={`sprite hero hero-${line} hero-${animClass}${artClass}`}
      style={style}
      aria-label="hero"
    />
  );
};
```

- [ ] **Step 6: Update the director ref** — in `app/src/use-scene-director.ts`, change the `heroSet?.cast` line (added in Task 2) to `heroSet?.attack`:
```ts
  styleRef.current = heroSet?.attack
    ? attackStyleFor(cls?.line ?? "")
    : AttackStyle.Melee;
```

- [ ] **Step 7: Typecheck + full suite + Prettier.**

Run: `cd /Users/calypso/Project/Ottery/commit-quest/app && bun run typecheck 2>&1 | tail -3` (clean — no `cast` references remain) and `bun test 2>&1 | grep -E "pass|fail"` (all pass). Then `cd /Users/calypso/Project/Ottery/commit-quest && npx prettier --write app/src/sprites.ts app/src/components/hero.tsx app/src/use-scene-director.ts 2>&1 | tail -1`.

- [ ] **Step 8: Commit**

```bash
cd /Users/calypso/Project/Ottery/commit-quest
git add app/public/sprites/mage app/src/sprites.ts app/src/sprites.test.ts app/src/components/hero.tsx app/src/use-scene-director.ts
git commit -m "feat(app): generalize sprite cast→attack; ranged/melee playback"
```

---

## Task 4: Arrow + Glyph VFX (render + CSS)

**Files:**
- Modify: `app/src/components/hit-effect.tsx`, `app/src/styles.css`

No unit test (rendering; browser-verified at Task 6).

- [ ] **Step 1: Render the new kinds** — replace `app/src/components/hit-effect.tsx`'s map body. Current is `const cls = e.kind === EffectKind.Zap ? "hit-zap" : "hit-effect";`. Replace with a kind→class lookup:

```tsx
import { type IHitEffect, EffectKind } from "../use-scene-director";
import { slotPos } from "../mob-slots";

interface IProps {
  effects: IHitEffect[];
}

const CLASS_FOR: Record<EffectKind, string> = {
  [EffectKind.Slash]: "hit-effect",
  [EffectKind.Zap]: "hit-zap",
  [EffectKind.Arrow]: "hit-arrow",
  [EffectKind.Glyph]: "hit-glyph",
};

const HitEffects = (props: IProps) => {
  const { effects } = props;
  return (
    <div className="hit-effects" aria-hidden="true">
      {effects.map(e => (
        <span key={e.id} className={CLASS_FOR[e.kind]} style={slotPos(e.slot)} />
      ))}
    </div>
  );
};

export default HitEffects;
```

- [ ] **Step 2: Add CSS** in `app/src/styles.css`, right after the `@keyframes zap { … }` block (search for `@keyframes zap`):

```css
/* shoot: a fast teal arrow streak landing on the mob from the hero's side (no projectile travel). */
.hit-arrow {
  position: absolute;
  width: 22cqh;
  height: 3cqh;
  transform-origin: right center;
  background: linear-gradient(90deg, transparent, #36c9a3 55%, #dffff5);
  border-radius: 2px;
  filter: drop-shadow(0 0 4px #36c9a3);
  animation: arrow 0.16s ease-out forwards;
}
@keyframes arrow {
  0% {
    opacity: 0;
    transform: translateX(-120%) scaleX(0.3);
  }
  35% {
    opacity: 1;
    transform: translateX(-100%) scaleX(1);
  }
  100% {
    opacity: 0;
    transform: translateX(-100%) scaleX(1);
  }
}
/* invoke: an amber rune burst detonating on the mob. */
.hit-glyph {
  position: absolute;
  width: 18cqh;
  height: 18cqh;
  border-radius: 50%;
  background: radial-gradient(
    circle,
    #fff4d6 0%,
    #f0c460 30%,
    #c98a36cc 52%,
    transparent 72%
  );
  filter: drop-shadow(0 0 8px #d9a441);
  animation: glyph 0.34s ease-out forwards;
}
@keyframes glyph {
  0% {
    opacity: 0;
    transform: rotate(0deg) scale(0.3);
  }
  35% {
    opacity: 1;
    transform: rotate(45deg) scale(1.05);
  }
  100% {
    opacity: 0;
    transform: rotate(90deg) scale(1.5);
  }
}
```

- [ ] **Step 3: Typecheck + suite + Prettier.**

Run: `cd /Users/calypso/Project/Ottery/commit-quest/app && bun run typecheck 2>&1 | tail -3` (clean — `CLASS_FOR` covers all `EffectKind`) and `bun test 2>&1 | grep -E "pass|fail"`. Then `cd /Users/calypso/Project/Ottery/commit-quest && npx prettier --write app/src/components/hit-effect.tsx app/src/styles.css 2>&1 | tail -1`.

- [ ] **Step 4: Commit**

```bash
cd /Users/calypso/Project/Ottery/commit-quest
git add app/src/components/hit-effect.tsx app/src/styles.css
git commit -m "feat(app): arrow + glyph hit VFX (ranger shoot / sage invoke)"
```

---

## Task 5: Importer — attack-animation glob → `attack/`

**Files:**
- Modify: `tools/import-art.ts`
- Test: `test/tools/import-art.test.ts`

- [ ] **Step 1: Add a failing test** — append to `test/tools/import-art.test.ts`:

```ts
test("pickAnimDir finds both casting (mage) and attack (others)", () => {
  expect(pickAnimDir(["casting_a_spell_swinging"], "asting")).toBe("casting_a_spell_swinging");
  expect(pickAnimDir(["a_forward_attack_loosing"], "ttack")).toBe("a_forward_attack_loosing");
});
```
Run: `cd /Users/calypso/Project/Ottery/commit-quest && bun test test/tools/import-art.test.ts 2>&1 | grep -E "pass|fail"` (passes already — locks the contract).

- [ ] **Step 2: Generalize the hero attack glob** in `tools/import-art.ts`. In `importHero`, replace the cast line (`const cast = pickAnimDir(animNames, "asting");`) and the `cast` copy block. New: match the attack animation by either substring and output to `attack/`:

```ts
  const attack = pickAnimDir(animNames, "ttack") ?? pickAnimDir(animNames, "asting");
```
And the copy block (currently writes to `cast`):
```ts
  if (attack) {
    const srcAttack = join(animDir, attack, "east");
    mkdirSync(join(out, "attack"), { recursive: true });
    for (const f of pngs(srcAttack)) {
      copyFileSync(join(srcAttack, f), join(out, "attack", `${frameIndex(f)}.png`));
    }
  } else {
    console.warn("  (no attack/casting animation found — skipping attack/)");
  }
```

- [ ] **Step 3: Verify** — `cd /Users/calypso/Project/Ottery/commit-quest && bun test test/tools/import-art.test.ts 2>&1 | grep -E "pass|fail"` (pass) and `bun build tools/import-art.ts --target=bun > /dev/null && echo OK`. Prettier: `npx prettier --write tools/import-art.ts test/tools/import-art.test.ts 2>&1 | tail -1`.

- [ ] **Step 4: Commit**

```bash
cd /Users/calypso/Project/Ottery/commit-quest
git add tools/import-art.ts test/tools/import-art.test.ts
git commit -m "feat(tools): import hero attack animation to attack/ (cast or attack folder)"
```

---

## Task 6: Mage-regression browser verify + sweep

Controller (browser). Confirms the renamed mage attack still casts (no regression) and the new VFX classes are wired. Ranger/rogue/sage frames don't exist yet, so they stay Melee (dash+slash) — verify that too.

- [ ] **Step 1: Build + serve a Mage Farming fixture** (tier 1 → grassland, mage casts):

```bash
cd /Users/calypso/Project/Ottery/commit-quest/app
pkill -f "bun server.ts" 2>/dev/null; sleep 0.3
npm run build 2>&1 | tail -1
FAKE="$CLAUDE_JOB_DIR/tmp/fakecombat"; mkdir -p "$FAKE"
NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)
cat > "$FAKE/state.json" <<JSON
{ "version":1,"updated_at":"$NOW","xp_total":300,"level":4,"xp_in_level":10,"xp_to_next":100,
  "stats":{"prompts":20,"actions":{"edit":10},"sessions":3,"by_source":{},"by_repo":{},"boss_defeated":0,"boss_fled":0},
  "class":{"line":"mage","tier":1,"form":"Backend Mage","icon":"⚔","branch":null,"affinity":{"mage":0.8,"ranger":0.1,"rogue":0.05,"sage":0.05}},
  "last_event":{"ts":"$NOW","type":"post_tool"},"inventory":[],"recent":[],"cosmetics":{} }
JSON
AGENTRPG_HOME="$FAKE" AGENTRPG_PORT=7191 nohup bun server.ts > "$CLAUDE_JOB_DIR/tmp/serve-combat.log" 2>&1 &
sleep 1.3; echo "serve $(curl -s -o /dev/null -w '%{http_code}' http://localhost:7191/) · mage attack0 $(curl -s -o /dev/null -w '%{http_code}' http://localhost:7191/sprites/mage/t1/attack/0.png)"
```
Expected: both `200` (the renamed attack frames serve).

- [ ] **Step 2: Browser-verify** (Playwright at `http://localhost:7191`, resize 920×300): over a few seconds confirm the hero `className` toggles to include `hero-cast` (never `hero-attack`) on strikes, its background cycles `…/attack/N.png`, and a `.hit-zap` appears — i.e. mage still casts + zaps. Screenshot. Kill the server + remove artifacts.

- [ ] **Step 3: Final sweep**

Run: `cd /Users/calypso/Project/Ottery/commit-quest/app && bun test 2>&1 | grep -E "pass|fail" | tail -1` (0 fail) and `cd /Users/calypso/Project/Ottery/commit-quest && bun run format 2>&1 | tail -1`. If Prettier changed tracked files, `git add -A && git commit -m "style: prettier"`.

---

## Self-Review (completed)

**Spec coverage:** §1 AttackStyle seam → Task 1. §2 cast→attack → Task 3. §3 importer → Task 5. §4 hero render → Task 3. §5 VFX (EffectKind+effectKindFor+director+hit-effect+CSS) → Tasks 2 (kinds/selector/strike) + 4 (render/CSS). §6 colors → Task 4 (arrow teal, glyph amber). Fallback (no-art → Melee) → Task 2's art-gated `styleRef` (`heroSet?.attack ? attackStyleFor : Melee`). Testing → Tasks 1/2/3/5 unit tests + Task 6 browser.

**Placeholder scan:** No TBD/TODO. The ordering note (Task 2 uses `heroSet?.cast`, Task 3 flips it to `attack`) is an explicit, intentional sequencing detail so every commit compiles — not a placeholder.

**Type consistency:** `AttackStyle` (Cast/Shoot/Stab/Invoke/Melee), `attackStyleFor`, `isRanged`, `EffectKind` (Slash/Zap/Arrow/Glyph), `effectKindFor`, `ISpriteSet.attack`, `buildSet(root, walkFrames, attackFrames)`, `heroSpriteSet(line, tier, branch)`, `ATTACK_FPS`, `CLASS_FOR`, `.hit-arrow`/`.hit-glyph` — consistent across tasks. `effectKindFor` lives in `use-scene-director.ts` (with `EffectKind`); `isRanged` in `combat.ts`; the director imports both. `set.attack` is defined in Task 3 and used in Tasks 2(flip)/3/4-via-director.

**Follow-up (out of plan):** the user re-exports ranger/rogue/sage attack animations (§3.2) → `import-art … --as hero:<line>:<tier>` re-imports them into `attack/` (Task 5's glob) → add the third arg to their `HERO_SPRITES` entries (`buildSet("ranger/t1", 9, 9)`) → they play their attack + VFX automatically.
