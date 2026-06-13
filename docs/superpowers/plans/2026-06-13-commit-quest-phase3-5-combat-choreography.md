# Phase 3.5 — AFK Combat Choreography Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the static scene into a living AFK combat loop driven by real state-diffs (XP → hero attacks + "+N XP" + monster takes a hit → dies → respawns; failure → monster bites back, hero hurt; level-up → celebrate), built with emoji/CSS placeholders behind the sprite seam.

**Architecture:** One small idempotent reducer stat (`stats.action_fails`); pure diff/resolver helpers; a `useCombat` hook that turns diffs into transient animation states + floaters; presentational hero/monster/floating-text components styled by `styles.css`. The renderer reaches state through the existing transport; the existing `useEncounter` boss overlay is untouched.

**Tech Stack:** Bun + TypeScript (core, tests), React 19 + Vite (`app/`), CSS animation. Tests: `bun test`.

**Spec:** `docs/superpowers/specs/2026-06-13-commit-quest-phase3-5-combat-choreography-design.md`

---

## File Structure

| File | Responsibility | New/Mod |
|---|---|---|
| `core/state.ts` | `stats.action_fails?: number` | Modify |
| `core/reduce.ts` | count `action_fail` events into `stats.action_fails` | Modify |
| `app/src/game-events.ts` | `combatBeats(prev,next)` + `ICombatBeats` | Modify |
| `app/src/combat.ts` | `HeroAnim`/`MonsterAnim` enums, `MONSTER_HITS`, `hitMonster`, `heroAnim`, `monsterAnim` (pure) | Create |
| `app/src/use-combat.ts` | hook: diffs → transient anim states + floaters + cosmetic HP + respawn | Create |
| `app/src/components/floating-text.tsx` | render the floater queue | Create |
| `app/src/components/hero.tsx` | render the resolved hero anim | Modify |
| `app/src/components/monster.tsx` | render the resolved monster anim + cosmetic HP bar | Modify |
| `app/src/components/scene-view.tsx` | wire `useCombat`; pass anim states; render floaters | Modify |
| `app/src/styles.css` | keyframes: attack/hurt/celebrate/die, monster HP bar, floaters | Modify |
| `docs/reference/art-prompts.md` | §3 animation requirement list for PixelLab | Modify |

---

### Task 1: `stats.action_fails` (core)

**Files:**
- Modify: `core/state.ts`
- Modify: `core/reduce.ts`
- Test: `test/core/reduce.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `test/core/reduce.test.ts` (it already has `ev` and `cfg`):

```ts
test("reduce counts action_fail events into stats.action_fails, idempotently", () => {
  const events = [
    ev({ type: "action", action: "edit" }),
    ev({ type: "action_fail", action: "run" }),
    ev({ type: "action_fail", action: "read" }),
  ];
  const s = reduce({ events, config: cfg });
  expect(s.stats.action_fails).toBe(2);
  expect(reduce({ events, config: cfg }).stats.action_fails).toBe(2); // idempotent

  const clean = reduce({ events: [ev({ type: "action", action: "edit" })], config: cfg });
  expect(clean.stats.action_fails).toBe(0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test test/core/reduce.test.ts`
Expected: FAIL — `s.stats.action_fails` is `undefined`.

- [ ] **Step 3: Add the field to `IState`**

In `core/state.ts`, inside the `stats: { … }` block (next to `boss_fled?: number;`), add:

```ts
    action_fails?: number;
```

- [ ] **Step 4: Count it in the reducer**

In `core/reduce.ts`, near the other counters (e.g. after `let nightActions = 0;`), add:

```ts
  let actionFails = 0;
```

Inside the fold loop, find the existing `if (e.type === EventType.ActionFail) { … }` block that sets `sessionInfo[e.session_id].hasFail = true;` and add the increment right after that line, inside the same block:

```ts
    if (e.type === EventType.ActionFail) {
      sessionInfo[e.session_id].hasFail = true;
      actionFails++;
    }
```

Then in the `prelim.stats` object literal (where `boss_fled: bossFled,` is), add:

```ts
      action_fails: actionFails,
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun test test/core/reduce.test.ts`
Expected: PASS (new + all existing reduce tests).

- [ ] **Step 6: Full suite + root typecheck**

Run: `bun test 2>&1 | grep -E "pass|fail"` → `0 fail` (do NOT use `tail`).
Run: `bunx tsc --noEmit` → clean.

- [ ] **Step 7: Commit**

```bash
git add core/state.ts core/reduce.ts test/core/reduce.test.ts
git commit -m "feat(core): count action_fail events into stats.action_fails"
```

---

### Task 2: `combatBeats` (app diff)

**Files:**
- Modify: `app/src/game-events.ts`
- Test: `app/src/game-events.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `app/src/game-events.test.ts` (it imports from `./game-events` and likely builds sample states — add `combatBeats` to the import and a minimal state helper if one is not present):

```ts
import { combatBeats } from "./game-events";
import type { IState } from "../../core/state";

const st = (o: object): IState =>
  ({ xp_total: 0, level: 1, stats: {}, ...o }) as unknown as IState;

test("combatBeats reports xp gain, failure, and level-up deltas", () => {
  const prev = st({ xp_total: 100, level: 5, stats: { action_fails: 2 } });
  const next = st({ xp_total: 103, level: 6, stats: { action_fails: 3 } });
  expect(combatBeats(prev, next)).toEqual({ xp: 3, hurt: true, leveledUp: true });
});

test("combatBeats is empty with no prev and clamps negative xp", () => {
  expect(combatBeats(null, st({ xp_total: 5 }))).toEqual({
    xp: 0,
    hurt: false,
    leveledUp: false,
  });
  const beats = combatBeats(st({ xp_total: 10 }), st({ xp_total: 4 }));
  expect(beats.xp).toBe(0); // clamped
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test app/src/game-events.test.ts`
Expected: FAIL — `combatBeats is not a function`.

- [ ] **Step 3: Implement**

Append to `app/src/game-events.ts` (it already imports `IState`):

```ts
export interface ICombatBeats {
  xp: number; // xp_total gained since prev (clamped >= 0)
  hurt: boolean; // a new action_fail occurred
  leveledUp: boolean; // level increased
}

export function combatBeats(prev: IState | null, next: IState): ICombatBeats {
  if (!prev) {
    return { xp: 0, hurt: false, leveledUp: false };
  }
  const xp = Math.max(0, next.xp_total - prev.xp_total);
  const hurt = (next.stats.action_fails ?? 0) > (prev.stats.action_fails ?? 0);
  const leveledUp = next.level > prev.level;
  return { xp, hurt, leveledUp };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test app/src/game-events.test.ts` → PASS.

- [ ] **Step 5: Verify + commit**

Run: `bun test 2>&1 | grep -E "pass|fail"` → `0 fail`; `cd app && npx tsc --noEmit` → clean (then `cd ..`).

```bash
git add app/src/game-events.ts app/src/game-events.test.ts
git commit -m "feat(app): combatBeats — xp/failure/level diffs for the combat loop"
```

---

### Task 3: `combat.ts` pure logic

**Files:**
- Create: `app/src/combat.ts`
- Test: `app/src/combat.test.ts`

- [ ] **Step 1: Write the failing test**

Create `app/src/combat.test.ts`:

```ts
import { test, expect } from "bun:test";
import {
  HeroAnim,
  MonsterAnim,
  MONSTER_HITS,
  hitMonster,
  heroAnim,
  monsterAnim,
} from "./combat";
import { ActivityState } from "./activity";

test("hitMonster increments and dies + respawns at MONSTER_HITS", () => {
  let hits = 0;
  let deaths = 0;
  for (let i = 0; i < MONSTER_HITS; i++) {
    const r = hitMonster(hits);
    hits = r.hits;
    if (r.died) {
      deaths++;
    }
  }
  expect(deaths).toBe(1);
  expect(hits).toBe(0); // respawned
});

test("heroAnim resolves priority celebrate > hurt > attack > activity base", () => {
  const base = { celebrate: false, hurt: false, attack: false, activity: ActivityState.Farming };
  expect(heroAnim(base)).toBe(HeroAnim.Farming);
  expect(heroAnim({ ...base, activity: ActivityState.Rest })).toBe(HeroAnim.Rest);
  expect(heroAnim({ ...base, attack: true })).toBe(HeroAnim.Attack);
  expect(heroAnim({ ...base, attack: true, hurt: true })).toBe(HeroAnim.Hurt);
  expect(heroAnim({ ...base, attack: true, hurt: true, celebrate: true })).toBe(HeroAnim.Celebrate);
});

test("monsterAnim resolves priority die > attack > hurt > idle", () => {
  expect(monsterAnim({ dying: false, attacking: false, hurt: false })).toBe(MonsterAnim.Idle);
  expect(monsterAnim({ dying: false, attacking: false, hurt: true })).toBe(MonsterAnim.Hurt);
  expect(monsterAnim({ dying: false, attacking: true, hurt: true })).toBe(MonsterAnim.Attack);
  expect(monsterAnim({ dying: true, attacking: true, hurt: true })).toBe(MonsterAnim.Die);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test app/src/combat.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `app/src/combat.ts`**

```ts
import { ActivityState } from "./activity";

export enum HeroAnim {
  Farming = "farming",
  Idle = "idle",
  Rest = "rest",
  Attack = "attack",
  Hurt = "hurt",
  Celebrate = "celebrate",
}

export enum MonsterAnim {
  Idle = "idle",
  Hurt = "hurt",
  Attack = "attack",
  Die = "die",
}

export const MONSTER_HITS = 5; // cosmetic: hits to kill the ambient monster

export interface IHitResult {
  hits: number; // hits after this strike (reset to 0 on death = respawn)
  died: boolean;
}

export const hitMonster = (hits: number): IHitResult => {
  const next = hits + 1;
  const died = next >= MONSTER_HITS;
  return { hits: died ? 0 : next, died };
};

const HERO_BASE: Record<ActivityState, HeroAnim> = {
  [ActivityState.Farming]: HeroAnim.Farming,
  [ActivityState.Idle]: HeroAnim.Idle,
  [ActivityState.Rest]: HeroAnim.Rest,
};

export interface IHeroAnimArgs {
  celebrate: boolean;
  hurt: boolean;
  attack: boolean;
  activity: ActivityState;
}

export const heroAnim = (props: IHeroAnimArgs): HeroAnim => {
  const { celebrate, hurt, attack, activity } = props;
  if (celebrate) {
    return HeroAnim.Celebrate;
  }
  if (hurt) {
    return HeroAnim.Hurt;
  }
  if (attack) {
    return HeroAnim.Attack;
  }
  return HERO_BASE[activity];
};

export interface IMonsterAnimArgs {
  dying: boolean;
  attacking: boolean;
  hurt: boolean;
}

export const monsterAnim = (props: IMonsterAnimArgs): MonsterAnim => {
  const { dying, attacking, hurt } = props;
  if (dying) {
    return MonsterAnim.Die;
  }
  if (attacking) {
    return MonsterAnim.Attack;
  }
  if (hurt) {
    return MonsterAnim.Hurt;
  }
  return MonsterAnim.Idle;
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test app/src/combat.test.ts` → PASS.

- [ ] **Step 5: Verify + commit**

Run: `bun test 2>&1 | grep -E "pass|fail"` → `0 fail`; `cd app && npx tsc --noEmit` → clean (then `cd ..`).

```bash
git add app/src/combat.ts app/src/combat.test.ts
git commit -m "feat(app): combat pure logic — hit model + hero/monster anim resolvers"
```

---

### Task 4: `useCombat` hook

**Files:**
- Create: `app/src/use-combat.ts`

The hook turns state-diffs into transient animation booleans (auto-cleared by timers), the cosmetic hit count, and a floater queue. Timers are tracked in a ref and cleared only on unmount, so rapid state pushes never leave a one-shot stuck on.

- [ ] **Step 1: Create `app/src/use-combat.ts`**

```ts
import { useEffect, useRef, useState } from "react";
import type { IState } from "../../core/state";
import { ActivityState } from "./activity";
import { combatBeats } from "./game-events";
import {
  HeroAnim,
  MonsterAnim,
  MONSTER_HITS,
  hitMonster,
  heroAnim,
  monsterAnim,
} from "./combat";

export interface IFloater {
  id: number;
  kind: "xp" | "hurt";
  text: string;
}

export interface ICombatView {
  hero: HeroAnim;
  monster: MonsterAnim;
  hpFraction: number;
  floaters: IFloater[];
}

const HERO_MS = { attack: 400, hurt: 500, celebrate: 1200 };
const MON_MS = { hurt: 300, attack: 500, die: 600 };
const FLOATER_MS = 900;

export function useCombat(state: IState | null, activity: ActivityState): ICombatView {
  const prevRef = useRef<IState | null>(null);
  const hitsRef = useRef(0);
  const floaterId = useRef(0);
  const timers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  const [hits, setHits] = useState(0);
  const [attacking, setAttacking] = useState(false);
  const [heroHurt, setHeroHurt] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const [monHurt, setMonHurt] = useState(false);
  const [monAttack, setMonAttack] = useState(false);
  const [dying, setDying] = useState(false);
  const [floaters, setFloaters] = useState<IFloater[]>([]);

  // Clear outstanding timers only on unmount (not on each state push).
  useEffect(() => {
    const set = timers.current;
    return () => {
      for (const t of set) {
        clearTimeout(t);
      }
    };
  }, []);

  useEffect(() => {
    if (!state) {
      return;
    }
    const beats = combatBeats(prevRef.current, state);
    prevRef.current = state;

    const later = (fn: () => void, ms: number) => {
      const t = setTimeout(() => {
        timers.current.delete(t);
        fn();
      }, ms);
      timers.current.add(t);
    };
    const pulse = (set: (v: boolean) => void, ms: number) => {
      set(true);
      later(() => set(false), ms);
    };
    const addFloater = (kind: "xp" | "hurt", text: string) => {
      const id = floaterId.current;
      floaterId.current += 1;
      setFloaters(f => [...f, { id, kind, text }]);
      later(() => setFloaters(f => f.filter(x => x.id !== id)), FLOATER_MS);
    };

    if (beats.xp > 0) {
      pulse(setAttacking, HERO_MS.attack);
      addFloater("xp", `+${beats.xp} XP`);
      const res = hitMonster(hitsRef.current);
      hitsRef.current = res.hits;
      setHits(res.hits);
      if (res.died) {
        pulse(setDying, MON_MS.die);
      } else {
        pulse(setMonHurt, MON_MS.hurt);
      }
    }
    if (beats.hurt) {
      pulse(setHeroHurt, HERO_MS.hurt);
      pulse(setMonAttack, MON_MS.attack);
      addFloater("hurt", "");
    }
    if (beats.leveledUp) {
      pulse(setCelebrating, HERO_MS.celebrate);
    }
  }, [state]);

  const hero = heroAnim({ celebrate: celebrating, hurt: heroHurt, attack: attacking, activity });
  const monster = monsterAnim({ dying, attacking: monAttack, hurt: monHurt });
  const hpFraction = (MONSTER_HITS - hits) / MONSTER_HITS;

  return { hero, monster, hpFraction, floaters };
}
```

- [ ] **Step 2: Typecheck**

Run: `cd app && npx tsc --noEmit` → clean (then `cd ..`). (Unused until Task 7; this confirms types/imports.)

- [ ] **Step 3: Commit**

```bash
git add app/src/use-combat.ts
git commit -m "feat(app): useCombat hook — diffs to transient anim states + floaters + cosmetic HP"
```

---

### Task 5: Floating text component

**Files:**
- Create: `app/src/components/floating-text.tsx`

- [ ] **Step 1: Create `app/src/components/floating-text.tsx`**

```tsx
import type { IFloater } from "../use-combat";

interface IProps {
  floaters: IFloater[];
}

const FloatingText = (props: IProps) => {
  const { floaters } = props;
  return (
    <div className="floaters" aria-hidden="true">
      {floaters.map(f => (
        <span key={f.id} className={`floater floater-${f.kind}`}>
          {f.text}
        </span>
      ))}
    </div>
  );
};

export default FloatingText;
```

- [ ] **Step 2: Typecheck**

Run: `cd app && npx tsc --noEmit` → clean (then `cd ..`).

- [ ] **Step 3: Commit**

```bash
git add app/src/components/floating-text.tsx
git commit -m "feat(app): floating-text component for combat floaters"
```

---

### Task 6: Hero + monster accept anim states

**Files:**
- Modify: `app/src/components/hero.tsx`
- Modify: `app/src/components/monster.tsx`

- [ ] **Step 1: Replace `app/src/components/hero.tsx`**

```tsx
interface IProps {
  line: string;
  anim: string;
}

const Hero = (props: IProps) => {
  const { line, anim } = props;
  return <div className={`sprite hero hero-${line} hero-${anim}`} aria-label="hero" />;
};

export default Hero;
```

- [ ] **Step 2: Replace `app/src/components/monster.tsx`**

```tsx
import type { IScene } from "../scene";

interface IProps {
  scene: IScene;
  anim: string;
  hp: number; // 0..1 cosmetic
}

const Monster = (props: IProps) => {
  const { scene, anim, hp } = props;
  return (
    <div className="monster-unit">
      <span className="monster-name">{scene.monster}</span>
      <div className="monster-hp">
        <i style={{ width: `${Math.max(0, Math.min(1, hp)) * 100}%` }} />
      </div>
      <span
        className={`sprite monster monster-${scene.theme} m-${anim}`}
        aria-label={scene.monster}
      />
    </div>
  );
};

export default Monster;
```

- [ ] **Step 3: Typecheck**

Run: `cd app && npx tsc --noEmit`
Expected: this will ERROR in `scene-view.tsx` (Hero/Monster props changed) — that is fixed in Task 7. Confirm the only errors are about `Hero`/`Monster` props in `scene-view.tsx`; the components themselves compile (then `cd ..`).

- [ ] **Step 4: Commit**

```bash
git add app/src/components/hero.tsx app/src/components/monster.tsx
git commit -m "feat(app): hero/monster render resolved anim state + cosmetic HP bar"
```

---

### Task 7: Wire `useCombat` into the scene

**Files:**
- Modify: `app/src/components/scene-view.tsx`

- [ ] **Step 1: Replace `app/src/components/scene-view.tsx`**

```tsx
import type { IState } from "../../../core/state";
import { sceneFor } from "../scene";
import { ActivityState } from "../activity";
import { useEncounter } from "../use-encounter";
import { useCombat } from "../use-combat";
import Hero from "./hero";
import Monster from "./monster";
import BossEncounter from "./boss-encounter";
import PortraitFrame from "./portrait-frame";
import AreaTag from "./area-tag";
import ActivityBar from "./activity-bar";
import FloatingText from "./floating-text";
import Sidebar from "./sidebar";

interface IProps {
  state: IState;
  activity: ActivityState;
}

const SceneView = (props: IProps) => {
  const { state, activity } = props;
  const encounter = useEncounter(state);
  const combat = useCombat(state, activity);
  const scene = sceneFor(state.class?.tier ?? 0);
  const line = state.class?.line ?? "novice";

  return (
    <div className="companion">
      <div className={`scene scene-${scene.theme}`}>
        <div className="sky" aria-hidden="true" />
        {activity !== ActivityState.Rest && (
          <Monster scene={scene} anim={combat.monster} hp={combat.hpFraction} />
        )}
        <Hero line={line} anim={combat.hero} />
        <FloatingText floaters={combat.floaters} />
        {encounter && <BossEncounter encounter={encounter} />}
        <PortraitFrame state={state} />
        <AreaTag label={scene.label} />
        <ActivityBar activity={activity} />
      </div>
      <Sidebar state={state} />
    </div>
  );
};

export default SceneView;
```

- [ ] **Step 2: Typecheck + build**

Run: `cd app && npx tsc --noEmit && npm run build` → clean; bundle builds (then `cd ..`).

- [ ] **Step 3: Full suite**

Run: `bun test 2>&1 | grep -E "pass|fail"` → `0 fail` (NOT `tail`).

- [ ] **Step 4: Commit**

```bash
git add app/src/components/scene-view.tsx
git commit -m "feat(app): wire useCombat into the scene (hero/monster anim + floaters)"
```

---

### Task 8: Combat animation styles

**Files:**
- Modify: `app/src/styles.css`

Add the combat keyframes, monster HP bar, and floaters. Append this block to the end of `app/src/styles.css` **before** the existing `@media (prefers-reduced-motion: reduce)` block, then extend that media block.

- [ ] **Step 1: Insert the combat styles**

Add (just before the `@media (prefers-reduced-motion: reduce)` block):

```css
/* ── combat choreography (emoji/CSS placeholders; swap for sprite-sheets later) ── */
.hero-attack {
  animation: hero-attack 0.4s ease-out;
}
.hero-hurt {
  animation: hero-hurt 0.5s steps(2) 2;
  filter: hue-rotate(-30deg) brightness(1.2);
}
.hero-celebrate {
  animation: hero-celebrate 1.2s ease-out;
}
@keyframes hero-attack {
  0% {
    transform: translateX(0);
  }
  35% {
    transform: translateX(14px) scale(1.05);
  }
  100% {
    transform: translateX(0);
  }
}
@keyframes hero-hurt {
  0%,
  100% {
    transform: translateX(0);
  }
  50% {
    transform: translateX(-6px);
  }
}
@keyframes hero-celebrate {
  0%,
  100% {
    transform: translateY(0);
  }
  30% {
    transform: translateY(-16px);
  }
  60% {
    transform: translateY(-4px);
  }
}

.monster-hp {
  width: 46px;
  height: 5px;
  border: 1px solid var(--ink);
  background: #241636;
}
.monster-hp > i {
  display: block;
  height: 100%;
  background: linear-gradient(180deg, #d4886a, #9c4a3a);
  transition: width 200ms ease;
}
.m-hurt {
  animation: m-hurt 0.3s steps(2) 1;
}
.m-attack {
  animation: m-attack 0.5s ease-out;
}
.m-die {
  animation: m-die 0.6s ease-in forwards;
}
@keyframes m-hurt {
  0%,
  100% {
    filter: none;
    transform: translateX(0);
  }
  50% {
    filter: brightness(2);
    transform: translateX(5px);
  }
}
@keyframes m-attack {
  0%,
  100% {
    transform: translateX(0);
  }
  40% {
    transform: translateX(-16px) scale(1.05);
  }
}
@keyframes m-die {
  0% {
    transform: translateY(0) rotate(0);
    opacity: 1;
  }
  100% {
    transform: translateY(10px) rotate(20deg);
    opacity: 0;
  }
}

.floaters {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}
.floater {
  position: absolute;
  font-family: "Pixelify Sans", monospace;
  font-weight: 700;
  font-size: 16px;
  text-shadow: 2px 2px 0 #000;
  animation: floater-rise 0.9s ease-out forwards;
}
.floater-xp {
  right: 26%;
  bottom: 42%;
  color: var(--gold-soft);
}
.floater-hurt {
  left: 30%;
  bottom: 40%;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #cc4a3a99;
}
@keyframes floater-rise {
  0% {
    transform: translateY(6px);
    opacity: 0;
  }
  20% {
    opacity: 1;
  }
  100% {
    transform: translateY(-26px);
    opacity: 0;
  }
}
```

- [ ] **Step 2: Extend the reduced-motion block**

In the existing `@media (prefers-reduced-motion: reduce)` block, add these selectors to the `animation: none;` rule list:

```css
  .hero-attack,
  .hero-hurt,
  .hero-celebrate,
  .m-hurt,
  .m-attack,
  .m-die,
  .floater {
    animation: none;
  }
```

(Place this as an additional rule inside the same media query.)

- [ ] **Step 3: Build + format**

Run: `cd app && npm run build` → succeeds (then `cd ..`).
Run: `bun run format`.

- [ ] **Step 4: Commit**

```bash
git add app/src/styles.css
git commit -m "style(app): combat animations — attack/hurt/celebrate/die, monster HP, floaters"
```

---

### Task 9: PixelLab animation list + full verification

**Files:**
- Modify: `docs/reference/art-prompts.md`

- [ ] **Step 1: Record the animation requirement list**

In `docs/reference/art-prompts.md` §3 (the "Animation states ที่ต้องมี" table), append the combat set so PixelLab gen covers it:

```markdown

### 3.x Combat animations (Phase 3.5 — required for the AFK combat loop)

| Character | Animation | Type | Frames | Used when |
|---|---|---|---|---|
| Hero | idle | loop | 2–4 | default / farming between beats |
| Hero | attack (cast) | one-shot | 4–6 | each real XP gain |
| Hero | hurt | one-shot | 2–3 | on a real failure (action_fail) |
| Hero | celebrate | one-shot | 6–8 | level-up |
| Hero | walk | loop | 4–6 | deferred: monster-approach / world-transition |
| Monster | idle / float | loop | 2–4 | default |
| Monster | hurt | one-shot | 2–3 | hit by an XP beat |
| Monster | attack | one-shot | 4 | bites back on a failure |
| Monster | die | one-shot | 4–6 | cosmetic HP empty |
| Monster | spawn / approach | one-shot | 4 | deferred |

Until real sheets land, these are CSS/emoji placeholders; swap by editing `styles.css`
(`.hero-*` / `.m-*` keyframes and the `.sprite` `background-image`).
```

- [ ] **Step 2: Full verification (all packages)**

Run:
```bash
bun test 2>&1 | grep -E "pass|fail"      # 0 fail (NOT tail)
bunx tsc --noEmit                         # root
cd app && npx tsc --noEmit && cd ..       # app
cd app/extension && npm run typecheck && cd ../..  # extension
bun run format && bun run format:check    # clean
cd app && npm run build && cd ..          # bundle builds
```
Expected: all green/clean.

- [ ] **Step 3: Refresh state so the panel has data, then manual smoke**

Run: `bun tools/rpg.ts status` (regenerates `state.json` with `stats.action_fails`).
Then in `app/extension`, run ▶️ (or `fn+F5`) → "Commit Quest: Open Companion". While a Claude Code session runs (XP rising), the hero should attack and "+N XP" should float as the monster's HP drains → it dies → a new one spawns; a failed tool call should flash the hero hurt; a level-up should make the hero jump.

- [ ] **Step 4: Commit**

```bash
git add docs/reference/art-prompts.md
git commit -m "docs(art): combat animation requirement list for PixelLab (Phase 3.5)"
```

---

## Self-Review

**1. Spec coverage**
- `stats.action_fails` core stat → Task 1. ✓
- `combatBeats` diff (xp/hurt/level) → Task 2. ✓
- Hit model + anim resolvers (`MONSTER_HITS`/`hitMonster`/`heroAnim`/`monsterAnim`) → Task 3. ✓
- `useCombat` hook (transient anim, floaters, cosmetic HP, respawn, unmount-only timer cleanup) → Task 4. ✓
- Floating text → Task 5; hero/monster anim + HP bar → Task 6; scene wiring → Task 7. ✓
- Combat CSS + reduced-motion → Task 8. ✓
- PixelLab animation list → Task 9. ✓
- All triggers real (xp/fail/level/activity), monster HP cosmetic, "+N XP" honest, no fake damage number → Tasks 2–8. ✓
- Non-goals (walk/transition/real sprites) untouched; boss `useEncounter` unchanged. ✓

**2. Placeholder scan:** no TBD/TODO; every code step has full code; commands have expected output. ✓

**3. Type consistency:** `ICombatBeats`/`combatBeats` (Task 2) consumed by `useCombat` (Task 4); `HeroAnim`/`MonsterAnim`/`MONSTER_HITS`/`hitMonster`/`heroAnim`/`monsterAnim`/`IHeroAnimArgs`/`IMonsterAnimArgs` (Task 3) consumed by Task 4; `IFloater`/`ICombatView`/`useCombat` (Task 4) consumed by Tasks 5+7; Hero `anim` + Monster `anim`/`hp` props (Task 6) supplied by Task 7; `stats.action_fails` (Task 1) read by `combatBeats` (Task 2). Names/signatures match across tasks. ✓
