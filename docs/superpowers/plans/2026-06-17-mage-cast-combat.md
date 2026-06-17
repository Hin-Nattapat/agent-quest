# Mage Cast Combat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The mage battle attack becomes a stand-and-cast — the hero plays its cast frames in place and fires an instant teal zap at the target — while non-mage lines keep the dash, via a per-class `AttackStyle` seam.

**Architecture:** A pure `attackStyleFor(line)` selector (mage→Cast, else→Melee) read by both the battle `Hero` (renders cast frames vs dash) and `useSceneDirector` (cast duration + zap-vs-slash effect). Cast frames are added to the sprite manifest; hit effects gain a `kind`. Pure consumer-side; no `core/` change.

**Tech Stack:** Bun + React 19 + Vite + TS; `bun test` (pure helpers; visuals verified in the browser).

**Spec:** `docs/superpowers/specs/2026-06-17-mage-cast-combat-design.md`

**Branch:** `feat/mage-cast-combat` (off main; main already has #43's 5 Mage forms + `public/sprites/mage/<tier>/cast/<0..8>.png`). The `.hero` 92px size fix is already in the working tree (uncommitted) — Task 6 commits it.

**Conventions (app/CLAUDE.md):** arrow-const only; `interface I*`; **string enums**; no `any`; braces on every if/else; no multi-line/nested ternaries (simple one-liners OK); kebab-case; comments explain WHY; `app/` no runtime `core` import. Tests `bun test` (app suite; no jsdom — components browser-verified).

**Run app tests:** `cd app && bun test 2>&1 | grep -E "pass|fail"`. Typecheck: `cd app && bun run typecheck 2>&1 | tail -3`.

---

## File Structure

- `app/src/combat.ts` — add `AttackStyle` enum + `attackStyleFor` (Task 1).
- `app/src/sprites.ts` — `ISpriteSet.cast?` + `buildSet` cast frames (Task 2).
- `app/src/use-scene-director.ts` — `EffectKind`, `IHitEffect.kind`, `addEffect(slot, kind)`, style-aware strike (Tasks 3, 5).
- `app/src/components/hit-effect.tsx` — render zap vs slash (Task 3).
- `app/src/components/hero.tsx` — cast-frame playback (Task 4).
- `app/src/styles.css` — `.hit-zap` keyframe (Task 3), `.hero` 92px (Task 6).

---

## Task 1: AttackStyle seam

**Files:**
- Modify: `app/src/combat.ts`
- Test: `app/src/combat.test.ts`

- [ ] **Step 1: Write the failing test** — append to `app/src/combat.test.ts`:

```ts
import { AttackStyle, attackStyleFor } from "./combat";

test("attackStyleFor: mage casts, everyone else melees", () => {
  expect(attackStyleFor("mage")).toBe(AttackStyle.Cast);
  expect(attackStyleFor("ranger")).toBe(AttackStyle.Melee);
  expect(attackStyleFor("novice")).toBe(AttackStyle.Melee);
  expect(attackStyleFor("")).toBe(AttackStyle.Melee);
});
```

- [ ] **Step 2: Run — expect FAIL** (`AttackStyle` not exported)

Run: `cd app && bun test src/combat.test.ts 2>&1 | grep -E "pass|fail|error"`

- [ ] **Step 3: Add to `app/src/combat.ts`** (after the `MonsterAnim` enum):

```ts
export enum AttackStyle {
  Cast = "cast",
  Melee = "melee",
}

// Which battle attack a class plays. Mage stands and casts; others keep the dash-jab until their
// own attack art lands (add a style + frames then).
export const attackStyleFor = (line: string): AttackStyle => {
  if (line === "mage") {
    return AttackStyle.Cast;
  }
  return AttackStyle.Melee;
};
```

- [ ] **Step 4: Run — expect pass**

Run: `cd app && bun test src/combat.test.ts 2>&1 | grep -E "pass|fail"`

- [ ] **Step 5: Commit**

```bash
cd /Users/calypso/Project/Ottery/commit-quest
git add app/src/combat.ts app/src/combat.test.ts
git commit -m "feat(app): AttackStyle seam (mage=cast, else=melee)"
```

---

## Task 2: Cast frames in the manifest

**Files:**
- Modify: `app/src/sprites.ts`, `app/src/sprites.test.ts`

- [ ] **Step 1: Add a failing test** — append to `app/src/sprites.test.ts`:

```ts
test("Mage forms carry 9 east cast frames", () => {
  expect(heroSpriteSet("mage", 1)?.cast?.length).toBe(9);
  expect(heroSpriteSet("mage", 1)?.cast?.[0]).toBe("/sprites/mage/t1/cast/0.png");
  expect(heroSpriteSet("mage", 4, "b")?.cast?.[8]).toBe("/sprites/mage/t4b/cast/8.png");
});
```

- [ ] **Step 2: Run — expect FAIL** (`cast` undefined)

Run: `cd app && bun test src/sprites.test.ts 2>&1 | grep -E "pass|fail|error"`

- [ ] **Step 3: Modify `app/src/sprites.ts`** — add `cast?` to the interface, build it, and pass the frame count for the Mage forms.

Interface:
```ts
export interface ISpriteSet {
  idle: Record<Facing, string>;
  walk: Record<Facing, string[]>;
  cast?: string[]; // east-facing cast frames; present only where the art exists
}
```

`buildSet` gains an optional cast-frame count:
```ts
const buildSet = (root: string, walkFrames: number, castFrames = 0): ISpriteSet => {
  const idle = {} as Record<Facing, string>;
  const walk = {} as Record<Facing, string[]>;
  for (const dir of DIRS) {
    idle[dir] = `/sprites/${root}/idle/${dir}.png`;
    walk[dir] = Array.from(
      { length: walkFrames },
      (_, i) => `/sprites/${root}/walk/${dir}/${i}.png`,
    );
  }
  const set: ISpriteSet = { idle, walk };
  if (castFrames > 0) {
    set.cast = Array.from(
      { length: castFrames },
      (_, i) => `/sprites/${root}/cast/${i}.png`,
    );
  }
  return set;
};
```

Update each Mage entry to pass `9` cast frames:
```ts
export const HERO_SPRITES: Partial<Record<string, ISpriteSet>> = {
  "mage-t1": buildSet("mage/t1", 9, 9),
  "mage-t2": buildSet("mage/t2", 9, 9),
  "mage-t3": buildSet("mage/t3", 9, 9),
  "mage-t4a": buildSet("mage/t4a", 9, 9),
  "mage-t4b": buildSet("mage/t4b", 9, 9),
};
```

- [ ] **Step 4: Run — expect pass + the existing sprites tests still pass**

Run: `cd app && bun test src/sprites.test.ts 2>&1 | grep -E "pass|fail"`

- [ ] **Step 5: Commit**

```bash
cd /Users/calypso/Project/Ottery/commit-quest
git add app/src/sprites.ts app/src/sprites.test.ts
git commit -m "feat(app): add cast frames to the Mage sprite manifest"
```

---

## Task 3: Zap effect kind (slash unchanged)

**Files:**
- Modify: `app/src/use-scene-director.ts` (`EffectKind`, `IHitEffect.kind`, `addEffect`)
- Modify: `app/src/components/hit-effect.tsx`
- Modify: `app/src/styles.css`

No unit test (rendering; browser-verified). Keep the existing slash behavior identical for now.

- [ ] **Step 1: In `app/src/use-scene-director.ts`, add `EffectKind`, extend `IHitEffect`, and `addEffect`.**

Add the enum near the top (after `FloaterKind`):
```ts
export enum EffectKind {
  Slash = "slash",
  Zap = "zap",
}
```

Change `IHitEffect`:
```ts
export interface IHitEffect {
  id: number;
  slot: number; // pack index the effect lands on
  kind: EffectKind;
}
```

Change `addEffect` to take a kind:
```ts
  const addEffect = (slot: number, kind: EffectKind) => {
    const id = nextId();
    setEffects(e => [...e, { id, slot, kind }]);
    later(() => setEffects(e => e.filter(x => x.id !== id)), EFFECT_MS);
  };
```

Update the one current call site inside `advance` (it stays slash for this task):
```ts
        addEffect(idx, EffectKind.Slash);
```

- [ ] **Step 2: In `app/src/components/hit-effect.tsx`, render zap vs slash:**

```tsx
import { type IHitEffect, EffectKind } from "../use-scene-director";
import { slotPos } from "../mob-slots";

interface IProps {
  effects: IHitEffect[];
}

const HitEffects = (props: IProps) => {
  const { effects } = props;
  return (
    <div className="hit-effects" aria-hidden="true">
      {effects.map(e => {
        const cls = e.kind === EffectKind.Zap ? "hit-zap" : "hit-effect";
        return <span key={e.id} className={cls} style={slotPos(e.slot)} />;
      })}
    </div>
  );
};

export default HitEffects;
```

- [ ] **Step 3: Add the zap keyframe to `app/src/styles.css`** — right after the `@keyframes slash { … }` block (around line 850), add:

```css
/* cast zap: a teal beam streaking into the mob from the hero's side, instant flash (no travel). */
.hit-zap {
  position: absolute;
  width: 150px;
  height: 6px;
  transform-origin: right center;
  background: linear-gradient(90deg, transparent, #36c9a3cc 45%, #dffff5);
  border-radius: 4px;
  filter: drop-shadow(0 0 6px #36c9a3);
  animation: zap 0.16s ease-out forwards;
}
@keyframes zap {
  0% {
    opacity: 0;
    transform: translateX(-100%) scaleX(0.2);
  }
  30% {
    opacity: 1;
    transform: translateX(-100%) scaleX(1);
  }
  100% {
    opacity: 0;
    transform: translateX(-100%) scaleX(1);
  }
}
```
(`translateX(-100%)` makes the 150px streak extend left toward the hero from the mob slot; `slotPos` sets `right`/`bottom`.)

- [ ] **Step 4: Typecheck + full suite + Prettier**

Run: `cd app && bun run typecheck 2>&1 | tail -3` (clean — `addEffect`'s new required arg is satisfied at its one call site) and `bun test 2>&1 | grep -E "pass|fail"` (all pass). Then `cd /Users/calypso/Project/Ottery/commit-quest && npx prettier --write app/src/components/hit-effect.tsx app/src/use-scene-director.ts app/src/styles.css 2>&1 | tail -1`.

- [ ] **Step 5: Commit**

```bash
cd /Users/calypso/Project/Ottery/commit-quest
git add app/src/use-scene-director.ts app/src/components/hit-effect.tsx app/src/styles.css
git commit -m "feat(app): hit-effect kind (zap vs slash) + zap VFX"
```

---

## Task 4: Hero plays the cast animation

**Files:**
- Modify: `app/src/components/hero.tsx`

No unit test (browser-verified). When the mage attacks, play `set.cast` in place and drop the dash class.

- [ ] **Step 1: Rewrite `app/src/components/hero.tsx`:**

```tsx
import { HeroAnim, AttackStyle, attackStyleFor } from "../combat";
import { Facing } from "../facing";
import { assetUrl } from "../assets-base";
import { heroSpriteSet, directionalFrames } from "../sprites";
import { useSpriteFrame } from "../use-sprite-frame";
import { usePreload } from "../use-preload";

interface IProps {
  line: string;
  tier: number;
  branch: string | null;
  anim: HeroAnim;
}

const WALK_FPS = 10;
const CAST_FPS = 15; // 9 cast frames ≈ one cycle over CAST_MS (600ms) in the director

const Hero = (props: IProps) => {
  const { line, tier, branch, anim } = props;
  const set = heroSpriteSet(line, tier, branch);
  usePreload(set);
  const casting =
    anim === HeroAnim.Attack && attackStyleFor(line) === AttackStyle.Cast && Boolean(set?.cast);
  const moving = anim === HeroAnim.Wander;
  const battleFrames = set ? directionalFrames(set, Facing.East, moving) : [];
  const frames = casting ? (set?.cast ?? []) : battleFrames;
  const playing = casting || moving;
  const fps = casting ? CAST_FPS : WALK_FPS;
  const frame = useSpriteFrame(frames, fps, playing);
  const style = frame ? { backgroundImage: `url(${assetUrl(frame)})` } : undefined;
  const artClass = frame ? " has-art" : "";
  // While casting, use a `cast` anim class so the .hero-attack dash keyframe never fires.
  const animClass = casting ? "cast" : anim;
  return (
    <div
      className={`sprite hero hero-${line} hero-${animClass}${artClass}`}
      style={style}
      aria-label="hero"
    />
  );
};

export default Hero;
```

- [ ] **Step 2: Typecheck + full suite**

Run: `cd app && bun run typecheck 2>&1 | tail -3` (clean) and `bun test 2>&1 | grep -E "pass|fail"` (all pass).

- [ ] **Step 3: Commit**

```bash
cd /Users/calypso/Project/Ottery/commit-quest
git add app/src/components/hero.tsx
git commit -m "feat(app): mage plays cast frames in place on attack"
```

---

## Task 5: Director — style-aware strike (cast timing + zap)

**Files:**
- Modify: `app/src/use-scene-director.ts`

- [ ] **Step 1: Import the style helpers + add `CAST_MS`.**

Extend the `./combat` import to include `AttackStyle` and `attackStyleFor`:
```ts
import {
  HeroAnim,
  MonsterAnim,
  PACK_HITS,
  AttackStyle,
  attackStyleFor,
  firstAlive,
  heroAnim,
  monsterAnim,
} from "./combat";
```

Add `CAST_MS` next to `HERO_MS`:
```ts
const CAST_MS = 600; // mage cast pulse — long enough to play the 9 cast frames at CAST_FPS
```

- [ ] **Step 2: Track the current attack style in a ref** (so the tick interval's `advance` reads it fresh). Right after the existing `const [effects, setEffects] = useState<IHitEffect[]>([]);` block of refs/state, add:

```ts
  const styleRef = useRef<AttackStyle>(AttackStyle.Melee);
  styleRef.current = attackStyleFor(state?.class?.line ?? "");
```

- [ ] **Step 3: Branch the strike on style** — in `advance`, replace the current strike block:

```ts
      if (idx >= 0 && next.pack[idx] !== before.pack[idx]) {
        pulse(setAttacking, HERO_MS.attack);
        addEffect(idx, EffectKind.Slash);
        if (next.pack[idx] <= 0) {
          setDyingSlot(idx);
          later(() => setDyingSlot(null), MON_MS.die);
        } else {
          pulse(setMonHurt, MON_MS.hurt);
        }
      }
```
with:
```ts
      if (idx >= 0 && next.pack[idx] !== before.pack[idx]) {
        const cast = styleRef.current === AttackStyle.Cast;
        pulse(setAttacking, cast ? CAST_MS : HERO_MS.attack);
        addEffect(idx, cast ? EffectKind.Zap : EffectKind.Slash);
        if (next.pack[idx] <= 0) {
          setDyingSlot(idx);
          later(() => setDyingSlot(null), MON_MS.die);
        } else {
          pulse(setMonHurt, MON_MS.hurt);
        }
      }
```

- [ ] **Step 3b: Confirm `EffectKind` is imported where used.** It's defined in this same file (Task 3), so no import needed.

- [ ] **Step 4: Typecheck + full suite**

Run: `cd app && bun run typecheck 2>&1 | tail -3` (clean) and `bun test 2>&1 | grep -E "pass|fail"` (all pass).

- [ ] **Step 5: Commit**

```bash
cd /Users/calypso/Project/Ottery/commit-quest
git add app/src/use-scene-director.ts
git commit -m "feat(app): cast-style strike — longer pulse + zap effect"
```

---

## Task 6: Battle hero size + browser verification

**Files:**
- Modify: `app/src/styles.css` (the `.hero` 92px size fix is already in the working tree, uncommitted)

- [ ] **Step 1: Confirm the size fix is present** (added during brainstorming):

Run: `cd /Users/calypso/Project/Ottery/commit-quest && grep -A4 '^\.hero {' app/src/styles.css | head -6`
Expected: `.hero` block contains `width: 92px;` and `height: 92px;`. If missing, add them to the `.hero` rule:
```css
.hero {
  left: 30%;
  bottom: 24%;
  width: 92px;
  height: 92px;
}
```

- [ ] **Step 2: Browser-verify the mage cast** — build + serve a fresh Farming (battle) Mage fixture:

```bash
cd /Users/calypso/Project/Ottery/commit-quest/app
pkill -f "bun server.ts" 2>/dev/null; sleep 0.3
npm run build 2>&1 | tail -1
FAKE="$CLAUDE_JOB_DIR/tmp/fakecast"; mkdir -p "$FAKE"
NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)
cat > "$FAKE/state.json" <<JSON
{ "version":1,"updated_at":"$NOW","xp_total":1200,"level":16,"xp_in_level":10,"xp_to_next":100,
  "stats":{"prompts":40,"actions":{"edit":20},"sessions":5,"by_source":{},"by_repo":{},"boss_defeated":0,"boss_fled":0},
  "class":{"line":"mage","tier":2,"form":"Server Sorcerer","icon":"⚔","branch":null,"affinity":{"mage":0.8,"ranger":0.1,"rogue":0.05,"sage":0.05}},
  "last_event":{"ts":"$NOW","type":"post_tool"},"inventory":[],"recent":[],"cosmetics":{} }
JSON
AGENTRPG_HOME="$FAKE" AGENTRPG_PORT=7177 nohup bun server.ts > "$CLAUDE_JOB_DIR/tmp/serve-cast.log" 2>&1 &
sleep 1.3; echo "serve: $(curl -s -o /dev/null -w '%{http_code}' http://localhost:7177/)"
echo "t2 cast reachable: $(curl -s -o /dev/null -w '%{http_code}' http://localhost:7177/sprites/mage/t2/cast/0.png)"
```
Then with Playwright: navigate `http://localhost:7177`, resize 420×720, and over ~3s watch `.hero` — its `className` should toggle to include `hero-cast` (never `hero-attack`) on strikes, its `backgroundImage` should cycle `…/cast/N.png`, a `.hit-zap` element should appear at a mob slot, and the hero should NOT translateX-dash. Take a screenshot. Confirm the hero is visibly larger (92px). Kill the server + remove screenshot artifacts when done.

- [ ] **Step 3: Commit the size fix**

```bash
cd /Users/calypso/Project/Ottery/commit-quest
git add app/src/styles.css
git commit -m "feat(app): enlarge battle hero to 92px (match overworld)"
```

- [ ] **Step 4: Final sweep + Prettier**

Run:
```bash
cd /Users/calypso/Project/Ottery/commit-quest/app && bun test 2>&1 | grep -E "pass|fail" | tail -2
cd /Users/calypso/Project/Ottery/commit-quest && bun run format 2>&1 | tail -2
```
If Prettier changed tracked files, `git add -A && git commit -m "style: prettier"`.

---

## Self-Review (completed)

**Spec coverage:** AttackStyle seam §1 → Task 1. Cast in manifest §2 → Task 2. Hero cast playback §3 → Task 4. Zap VFX §4 → Task 3. Director timing §5 → Task 5. Battle hero size §6 → Task 6. Non-mage melee §7 → preserved by `attackStyleFor` default + the `cast` ternary falling back to dash (Tasks 1/4/5). Fallback (cast style, no `set.cast`) → Task 4's `Boolean(set?.cast)` gate drops to the dash path. Testing §"Testing" → Tasks 1/2 pure tests; visuals Task 6.

**Type consistency:** `AttackStyle` (Cast/Melee), `attackStyleFor(line)`, `ISpriteSet.cast?`, `buildSet(root, walkFrames, castFrames?)`, `EffectKind` (Slash/Zap), `IHitEffect { id, slot, kind }`, `addEffect(slot, kind)`, `CAST_MS=600`/`CAST_FPS=15`, `hero-cast` class — names consistent across tasks. `EffectKind` defined in `use-scene-director.ts` (Task 3) and used there (Task 5) + imported by `hit-effect.tsx` (Task 3). The one `addEffect` call site is updated in Task 3 (Slash) then re-pointed in Task 5 (style-based), so each task compiles.

**Out of scope (per spec):** ranger/rogue/sage attacks, hurt/celebrate frames, monster/boss art, projectile travel, core/combat-math — none planned.
