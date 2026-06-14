# Phase 3.8a — Living Scene Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pace the AFK scene into a "living" loop — the hero wanders when the agent is quiet and fights waves of 1–3 monsters FF-style (lunge + hit effects) when active, with rest gaps so it never grinds non-stop.

**Architecture:** App-only, cosmetic. A **pure `stepDirector` reducer** (`scene-phase.ts`) owns the Wander⇄Engage phase machine, the 1–3 pack, the wave index, the rest gap, and the throttled strike — fully unit-tested. A thin `use-scene-director` hook drives it with `Date.now()` + a low-frequency tick + real state-diffs (`combatBeats`), and derives CSS pulses (hero attack, mob hurt/die, floaters, slash effects) from the director-state diff. Everything renders as emoji + CSS keyframes behind the sprite seam.

**Tech Stack:** Bun + TypeScript, `bun test`, React 19 (Vite), plain CSS.

**Spec:** `docs/superpowers/specs/2026-06-14-commit-quest-phase3-8a-living-scene-design.md`

---

## Context for the implementer

- **`app/src/` is FE-style:** `export function`/arrow `const`, string enums (PascalCase members, string values), `use-*` hooks own logic, components are presentational. `core` is imported **type-only**. Do NOT import `core` runtime logic. Don't reformat unrelated code.
- Run app tests with `cd app && bun test` (its own workspace). **Read results with `bun test 2>&1 | grep -E "pass|fail"` — never `tail`** (tail hides the fail line).
- Today the scene shows ONE ambient monster: `scene-view.tsx` renders `<Monster>` when `activity !== Rest && !encounter`, fed by `useCombat`. This plan replaces `useCombat` with `useSceneDirector` and renders a **pack** (0–3 mobs).
- The combat is **cosmetic** — no loot, no core change. XP/level still come from real events (unchanged); the director only paces the *presentation*.
- Existing CSS already has: `.hero-attack` (a 14px lunge keyframe — reuse it), `.hero-hurt`, `.hero-celebrate`, `.m-hurt`, `.m-attack`, `.m-die`, `.monster-hp`, `.floaters`/`.floater-*`, and a `@media (prefers-reduced-motion: reduce)` block at the end (extend it). Hero sits `.hero { left:30%; bottom:24% }`; the old `.monster-unit { right:18% }` is single — packs will be positioned per-slot in `scene-view`.
- `combat.ts` currently exports `HeroAnim`, `MonsterAnim`, `MONSTER_HITS`, `hitMonster`, `heroAnim`, `monsterAnim`, `IHeroAnimArgs`, `IMonsterAnimArgs`, `IHitResult`. `combat.test.ts` tests `hitMonster`, `heroAnim`, `monsterAnim` — **keep those passing**.

---

## Task 1: Pack primitives + Wander anim in `combat.ts`

**Files:**
- Modify: `app/src/combat.ts`
- Test: `app/src/combat.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `app/src/combat.test.ts` (keep the existing tests). Also add `packSize, makePack, firstAlive, strike, packCleared, PACK_HITS` to the existing `import { ... } from "./combat";` block, and add `Wander` usage:

```ts
import {
  PACK_HITS,
  packSize,
  makePack,
  firstAlive,
  strike,
  packCleared,
} from "./combat";

test("packSize is 1..3, deterministic, and varies across waves", () => {
  const sizes = Array.from({ length: 30 }, (_, i) => packSize(i));
  for (const s of sizes) {
    expect(s).toBeGreaterThanOrEqual(1);
    expect(s).toBeLessThanOrEqual(3);
  }
  expect(packSize(7)).toBe(packSize(7)); // deterministic
  expect(new Set(sizes).size).toBeGreaterThan(1); // not constant
});

test("pack: make / firstAlive / strike / packCleared", () => {
  const pack = makePack(3);
  expect(pack).toEqual([PACK_HITS, PACK_HITS, PACK_HITS]);
  expect(firstAlive(pack)).toBe(0);

  let p = pack;
  for (let i = 0; i < PACK_HITS; i++) {
    p = strike(p, 0);
  }
  expect(p[0]).toBe(0);
  expect(p[1]).toBe(PACK_HITS); // only the target took damage
  expect(firstAlive(p)).toBe(1); // leftmost alive moved on
  expect(packCleared(p)).toBe(false);

  const cleared = makePack(1).map(() => 0);
  expect(firstAlive(cleared)).toBe(-1);
  expect(packCleared(cleared)).toBe(true);
});

test("strike floors at 0 and never goes negative", () => {
  expect(strike([0], 0)).toEqual([0]);
});

test("heroAnim returns Wander only when no pulse is active", () => {
  const base = { celebrate: false, hurt: false, attack: false, activity: ActivityState.Idle };
  expect(heroAnim({ ...base, wander: true })).toBe(HeroAnim.Wander);
  expect(heroAnim({ ...base, wander: true, attack: true })).toBe(HeroAnim.Attack);
  expect(heroAnim({ ...base })).toBe(HeroAnim.Idle); // wander omitted → activity base
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd app && bun test src/combat.test.ts 2>&1 | grep -E "pass|fail"`
Expected: FAIL — `packSize`/`PACK_HITS`/`HeroAnim.Wander` etc. not exported.

- [ ] **Step 3: Implement in `app/src/combat.ts`**

Add `Wander = "wander"` to the `HeroAnim` enum (after `Celebrate`):

```ts
export enum HeroAnim {
  Farming = "farming",
  Idle = "idle",
  Rest = "rest",
  Attack = "attack",
  Hurt = "hurt",
  Celebrate = "celebrate",
  Wander = "wander",
}
```

Make `wander` an optional field on `IHeroAnimArgs` and honour it in `heroAnim` (pulses keep priority; `wander` only overrides the activity base):

```ts
export interface IHeroAnimArgs {
  celebrate: boolean;
  hurt: boolean;
  attack: boolean;
  activity: ActivityState;
  wander?: boolean;
}

export const heroAnim = (props: IHeroAnimArgs): HeroAnim => {
  const { celebrate, hurt, attack, activity, wander } = props;
  if (celebrate) {
    return HeroAnim.Celebrate;
  }
  if (hurt) {
    return HeroAnim.Hurt;
  }
  if (attack) {
    return HeroAnim.Attack;
  }
  if (wander) {
    return HeroAnim.Wander;
  }
  return HERO_BASE[activity];
};
```

Append the pack model at the end of the file:

```ts
export const PACK_HITS = 3; // cosmetic hits to fell one pack mob (a solo monster is MONSTER_HITS=5)

// Small pure 32-bit integer hash → varied-but-deterministic wave sizes (no Math.random in logic).
const hashInt = (n: number): number => {
  let x = (n ^ 0x9e3779b9) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b) >>> 0;
  return (x ^ (x >>> 16)) >>> 0;
};

export const packSize = (waveIndex: number): number => 1 + (hashInt(waveIndex) % 3);
export const makePack = (size: number): number[] => Array(size).fill(PACK_HITS);
export const firstAlive = (pack: number[]): number => pack.findIndex(h => h > 0);
export const strike = (pack: number[], idx: number): number[] =>
  pack.map((h, i) => (i === idx ? Math.max(0, h - 1) : h));
export const packCleared = (pack: number[]): boolean => pack.every(h => h <= 0);
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd app && bun test src/combat.test.ts 2>&1 | grep -E "pass|fail"`
Expected: PASS, 0 fail (old `hitMonster`/`heroAnim`/`monsterAnim` tests still green).

- [ ] **Step 5: Commit**

```bash
git add app/src/combat.ts app/src/combat.test.ts
git commit -m "feat(app): pack primitives + Wander hero anim"
```

---

## Task 2: Pure phase machine `scene-phase.ts`

**Files:**
- Create: `app/src/scene-phase.ts`
- Test: `app/src/scene-phase.test.ts`

The whole pacing brain lives here as one pure function so it is fully testable.

- [ ] **Step 1: Write the failing test** — create `app/src/scene-phase.test.ts`:

```ts
import { test, expect } from "bun:test";
import { ActivityState } from "./activity";
import { PACK_HITS } from "./combat";
import {
  ScenePhase,
  REST_GAP_MS,
  STRIKE_THROTTLE_MS,
  initDirector,
  stepDirector,
} from "./scene-phase";

const farming = (over: object = {}) => ({
  now: 0,
  activity: ActivityState.Farming,
  wantStrike: false,
  ...over,
});

test("Wander → Engage spawns a pack when farming", () => {
  const s = stepDirector(initDirector, farming({ now: 1000 }));
  expect(s.phase).toBe(ScenePhase.Engage);
  expect(s.pack.length).toBeGreaterThanOrEqual(1);
  expect(s.pack.length).toBeLessThanOrEqual(3);
  expect(s.pack.every(h => h === PACK_HITS)).toBe(true);
  expect(s.waveIndex).toBe(1);
});

test("stays in Wander when idle", () => {
  const s = stepDirector(initDirector, { now: 5000, activity: ActivityState.Idle, wantStrike: false });
  expect(s.phase).toBe(ScenePhase.Wander);
  expect(s.pack).toEqual([]);
});

test("a throttled strike damages the leftmost mob; too-soon strikes are ignored", () => {
  let s = stepDirector(initDirector, farming({ now: 0 }));
  const size = s.pack.length;
  s = stepDirector(s, farming({ now: 1000, wantStrike: true }));
  expect(s.pack[0]).toBe(PACK_HITS - 1);
  // within throttle window → ignored
  const before = s.pack[0];
  s = stepDirector(s, farming({ now: 1000 + STRIKE_THROTTLE_MS - 1, wantStrike: true }));
  expect(s.pack[0]).toBe(before);
  expect(s.pack.length).toBe(size);
});

test("clearing the pack enters a rest gap, then re-engages once it elapses", () => {
  let s = { ...initDirector, phase: ScenePhase.Engage, pack: [1], waveIndex: 1 };
  s = stepDirector(s, farming({ now: 10_000, wantStrike: true }));
  expect(s.phase).toBe(ScenePhase.Wander);
  expect(s.pack).toEqual([]);
  expect(s.restUntil).toBe(10_000 + REST_GAP_MS);

  // still resting → no new wave
  const resting = stepDirector(s, farming({ now: 10_000 + REST_GAP_MS - 1 }));
  expect(resting.phase).toBe(ScenePhase.Wander);
  // rest elapsed + farming → new wave
  const next = stepDirector(s, farming({ now: 10_000 + REST_GAP_MS }));
  expect(next.phase).toBe(ScenePhase.Engage);
  expect(next.waveIndex).toBe(2);
});

test("going non-farming mid-wave abandons the pack", () => {
  const engaged = { ...initDirector, phase: ScenePhase.Engage, pack: [PACK_HITS, PACK_HITS], waveIndex: 1 };
  const s = stepDirector(engaged, { now: 3000, activity: ActivityState.Idle, wantStrike: false });
  expect(s.phase).toBe(ScenePhase.Wander);
  expect(s.pack).toEqual([]);
  expect(s.restUntil).toBeNull();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd app && bun test src/scene-phase.test.ts 2>&1 | grep -E "pass|fail"`
Expected: FAIL — `scene-phase` module does not exist.

- [ ] **Step 3: Implement `app/src/scene-phase.ts`**

```ts
import { ActivityState } from "./activity";
import { packSize, makePack, firstAlive, strike, packCleared } from "./combat";

export enum ScenePhase {
  Wander = "wander",
  Engage = "engage",
}

export const REST_GAP_MS = 4000; // calm wander between waves
export const STRIKE_THROTTLE_MS = 700; // min gap between hero strikes (paces the fight)
export const SPAWN_STAGGER_MS = 120; // pop-in stagger across a pack (used by the view)

export interface IDirectorState {
  phase: ScenePhase;
  pack: number[]; // remaining hits per mob; [] in Wander
  waveIndex: number;
  restUntil: number | null; // wall-clock ms the rest gap ends (null = not resting)
  lastStrikeAt: number;
}

export interface IDirectorInput {
  now: number;
  activity: ActivityState;
  wantStrike: boolean;
}

export const initDirector: IDirectorState = {
  phase: ScenePhase.Wander,
  pack: [],
  waveIndex: 0,
  restUntil: null,
  lastStrikeAt: 0,
};

export const shouldEngage = (
  activity: ActivityState,
  now: number,
  restUntil: number | null,
): boolean => {
  return activity === ActivityState.Farming && (restUntil === null || now >= restUntil);
};

export const stepDirector = (state: IDirectorState, input: IDirectorInput): IDirectorState => {
  const { now, activity, wantStrike } = input;

  if (state.phase === ScenePhase.Wander) {
    if (shouldEngage(activity, now, state.restUntil)) {
      return {
        phase: ScenePhase.Engage,
        pack: makePack(packSize(state.waveIndex)),
        waveIndex: state.waveIndex + 1,
        restUntil: null,
        lastStrikeAt: now,
      };
    }
    return state;
  }

  // Engage
  if (activity !== ActivityState.Farming) {
    return { ...state, phase: ScenePhase.Wander, pack: [], restUntil: null };
  }

  let pack = state.pack;
  let lastStrikeAt = state.lastStrikeAt;
  if (wantStrike && now - lastStrikeAt >= STRIKE_THROTTLE_MS) {
    const idx = firstAlive(pack);
    if (idx >= 0) {
      pack = strike(pack, idx);
      lastStrikeAt = now;
    }
  }

  if (packCleared(pack)) {
    return {
      ...state,
      phase: ScenePhase.Wander,
      pack: [],
      restUntil: now + REST_GAP_MS,
      lastStrikeAt,
    };
  }
  return { ...state, pack, lastStrikeAt };
};
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd app && bun test src/scene-phase.test.ts 2>&1 | grep -E "pass|fail"`
Expected: PASS, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add app/src/scene-phase.ts app/src/scene-phase.test.ts
git commit -m "feat(app): pure scene-director phase machine (Wander/Engage/rest)"
```

---

## Task 3: `use-scene-director` hook (replaces `use-combat`)

**Files:**
- Create: `app/src/use-scene-director.ts`
- Delete: `app/src/use-combat.ts`
- Modify: `app/src/components/floating-text.tsx:1` (re-point the `IFloater` import)
- (No new unit test — this is timer/effect glue, verified by the full suite staying green + the panel. The logic it depends on is already tested in Tasks 1–2.)

This is an **integration task** (judgment): wire the pure `stepDirector` to React with `Date.now()`, a low-frequency tick (for time-driven Wander→Engage and rest-gap expiry), real state-diff beats, and derive CSS pulses from the director-state diff. Mirror the existing `useCombat` timer discipline (StrictMode-safe: clear timers only on unmount).

- [ ] **Step 1: Create `app/src/use-scene-director.ts`**

```ts
import { useEffect, useRef, useState } from "react";
import type { IState } from "../../core/state";
import { ActivityState } from "./activity";
import { combatBeats } from "./game-events";
import {
  HeroAnim,
  MonsterAnim,
  PACK_HITS,
  firstAlive,
  heroAnim,
  monsterAnim,
} from "./combat";
import {
  ScenePhase,
  initDirector,
  stepDirector,
  type IDirectorState,
} from "./scene-phase";

export enum FloaterKind {
  Xp = "xp",
  Hurt = "hurt",
}

export interface IFloater {
  id: number;
  kind: FloaterKind;
  text: string;
}

export interface IHitEffect {
  id: number;
  slot: number; // pack index the slash lands on
}

export interface IMobView {
  anim: MonsterAnim;
  hpFraction: number;
}

export interface ISceneView {
  phase: ScenePhase;
  hero: HeroAnim;
  mobs: IMobView[]; // [] in Wander
  floaters: IFloater[];
  effects: IHitEffect[];
}

const HERO_MS = { attack: 400, hurt: 500, celebrate: 1200 };
const MON_MS = { hurt: 300, attack: 500, die: 600 };
const FLOATER_MS = 900;
const EFFECT_MS = 320;
const TICK_MS = 250; // advances time-driven transitions (engage start, rest-gap expiry)

export function useSceneDirector(state: IState | null, activity: ActivityState): ISceneView {
  const prevRef = useRef<IState | null>(null);
  const dirRef = useRef<IDirectorState>(initDirector);
  const seqRef = useRef(0);
  const timers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  const [dir, setDir] = useState<IDirectorState>(initDirector);
  const [attacking, setAttacking] = useState(false);
  const [heroHurt, setHeroHurt] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const [monHurt, setMonHurt] = useState(false);
  const [monAttack, setMonAttack] = useState(false);
  const [dyingSlot, setDyingSlot] = useState<number | null>(null);
  const [floaters, setFloaters] = useState<IFloater[]>([]);
  const [effects, setEffects] = useState<IHitEffect[]>([]);

  useEffect(() => {
    const set = timers.current;
    return () => {
      for (const t of set) {
        clearTimeout(t);
      }
    };
  }, []);

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
  const nextId = () => {
    const id = seqRef.current;
    seqRef.current += 1;
    return id;
  };
  const addFloater = (kind: FloaterKind, text: string) => {
    const id = nextId();
    setFloaters(f => [...f, { id, kind, text }]);
    later(() => setFloaters(f => f.filter(x => x.id !== id)), FLOATER_MS);
  };
  const addEffect = (slot: number) => {
    const id = nextId();
    setEffects(e => [...e, { id, slot }]);
    later(() => setEffects(e => e.filter(x => x.id !== id)), EFFECT_MS);
  };

  // Apply one director step and fan out the CSS pulses implied by the state diff.
  const advance = (wantStrike: boolean) => {
    const before = dirRef.current;
    const next = stepDirector(before, { now: Date.now(), activity, wantStrike });
    dirRef.current = next;
    setDir(next);

    if (wantStrike && next.phase === ScenePhase.Engage) {
      const idx = firstAlive(before.pack);
      if (idx >= 0 && next.pack[idx] !== before.pack[idx]) {
        pulse(setAttacking, HERO_MS.attack);
        addEffect(idx);
        if (next.pack[idx] <= 0) {
          setDyingSlot(idx);
          later(() => setDyingSlot(null), MON_MS.die);
        } else {
          pulse(setMonHurt, MON_MS.hurt);
        }
      }
    }
  };

  // Real state-diff beats.
  useEffect(() => {
    if (!state) {
      return;
    }
    const beats = combatBeats(prevRef.current, state);
    prevRef.current = state;

    if (beats.xp > 0) {
      addFloater(FloaterKind.Xp, `+${beats.xp} XP`);
      advance(true);
    }
    if (beats.hurt) {
      pulse(setHeroHurt, HERO_MS.hurt);
      pulse(setMonAttack, MON_MS.attack);
      addFloater(FloaterKind.Hurt, "");
    }
    if (beats.leveledUp) {
      pulse(setCelebrating, HERO_MS.celebrate);
    }
  }, [state]);

  // Low-frequency tick drives time-based transitions even without new state pushes.
  useEffect(() => {
    const id = setInterval(() => advance(false), TICK_MS);
    return () => clearInterval(id);
    // advance closes over `activity`; re-arm when it changes so transitions read fresh activity.
  }, [activity]);

  const wander = dir.phase === ScenePhase.Wander;
  const hero = heroAnim({
    celebrate: celebrating,
    hurt: heroHurt,
    attack: attacking,
    activity,
    wander,
  });
  const targetIdx = firstAlive(dir.pack);
  const mobs: IMobView[] = dir.pack.map((hits, i) => {
    const dying = dyingSlot === i;
    const isTarget = i === targetIdx;
    return {
      anim: monsterAnim({
        dying,
        attacking: isTarget && monAttack,
        hurt: isTarget && monHurt,
      }),
      hpFraction: hits / PACK_HITS,
    };
  });

  return { phase: dir.phase, hero, mobs, floaters, effects };
}
```

- [ ] **Step 2: Re-point the `IFloater` import in `app/src/components/floating-text.tsx`**

Change line 1 from:

```ts
import type { IFloater } from "../use-combat";
```

to:

```ts
import type { IFloater } from "../use-scene-director";
```

- [ ] **Step 3: Delete the old hook**

```bash
git rm app/src/use-combat.ts
```

- [ ] **Step 4: Type-check (scene-view still references the old hook — expected to fail until Task 4)**

Run: `cd app && bunx tsc --noEmit 2>&1 | grep -E "use-combat|error TS" | head`
Expected: errors ONLY in `components/scene-view.tsx` (still importing `useCombat`). That is fixed in Task 4. No other file should reference `use-combat`.

Confirm nothing else dangles:

Run: `grep -rn "use-combat\|useCombat" app/src`
Expected: matches only in `components/scene-view.tsx`.

- [ ] **Step 5: Commit**

```bash
git add app/src/use-scene-director.ts app/src/components/floating-text.tsx
git rm app/src/use-combat.ts
git commit -m "feat(app): scene-director hook (paced waves), retire use-combat"
```

---

## Task 4: Render the pack — `monster.tsx`, `hit-effect.tsx`, `scene-view.tsx`

**Files:**
- Modify: `app/src/components/monster.tsx`
- Create: `app/src/components/hit-effect.tsx`
- Modify: `app/src/components/scene-view.tsx`
- (Presentational — verified by the panel + the full suite compiling/green.)

- [ ] **Step 1: Rewrite `app/src/components/monster.tsx` to render ONE mob (no nameplate)**

```tsx
import type { IScene } from "../scene";

interface IProps {
  scene: IScene;
  anim: string;
  hp: number; // 0..1 cosmetic
  slot: number; // pack index → horizontal position
}

const SLOT_RIGHT = ["14%", "23%", "32%"]; // up to 3 mobs spread across the right

const Monster = (props: IProps) => {
  const { scene, anim, hp, slot } = props;
  const right = SLOT_RIGHT[slot] ?? SLOT_RIGHT[SLOT_RIGHT.length - 1];
  return (
    <div className="monster-unit" style={{ right }}>
      <div className="monster-hp">
        <i style={{ width: `${Math.max(0, Math.min(1, hp)) * 100}%` }} />
      </div>
      <span
        className={`sprite monster monster-${scene.theme} m-${anim} mob-spawn`}
        aria-label={scene.monster}
      />
    </div>
  );
};

export default Monster;
```

- [ ] **Step 2: Create `app/src/components/hit-effect.tsx`**

```tsx
import type { IHitEffect } from "../use-scene-director";

interface IProps {
  effects: IHitEffect[];
}

const SLOT_RIGHT = ["14%", "23%", "32%"];

const HitEffects = (props: IProps) => {
  const { effects } = props;
  return (
    <div className="hit-effects" aria-hidden="true">
      {effects.map(e => (
        <span
          key={e.id}
          className="hit-effect"
          style={{ right: SLOT_RIGHT[e.slot] ?? SLOT_RIGHT[SLOT_RIGHT.length - 1] }}
        />
      ))}
    </div>
  );
};

export default HitEffects;
```

- [ ] **Step 3: Update `app/src/components/scene-view.tsx`**

Replace the `useCombat` import + usage with `useSceneDirector`, map the pack into `<Monster>`s, and add the `<HitEffects>` layer. The new file:

```tsx
import { useState } from "react";
import type { IState } from "../../../core/state";
import { sceneFor } from "../scene";
import { ActivityState } from "../activity";
import { PanelId } from "../panels";
import { useEncounter } from "../use-encounter";
import { useSceneDirector } from "../use-scene-director";
import Hero from "./hero";
import Monster from "./monster";
import HitEffects from "./hit-effect";
import BossEncounter from "./boss-encounter";
import PortraitFrame from "./portrait-frame";
import AreaTag from "./area-tag";
import ActivityBar from "./activity-bar";
import FloatingText from "./floating-text";
import PanelOverlay from "./panel-overlay";
import Sidebar from "./sidebar";

interface IProps {
  state: IState;
  activity: ActivityState;
}

const SceneView = (props: IProps) => {
  const { state, activity } = props;
  const [panel, setPanel] = useState<PanelId | null>(null);
  const encounter = useEncounter(state);
  const scene = useSceneDirector(state, activity);
  const sceneInfo = sceneFor(state.class?.tier ?? 0, state.class?.line, state.class?.branch);
  const line = state.class?.line ?? "novice";

  return (
    <div className="companion">
      <div className={`scene scene-${sceneInfo.theme}`}>
        <div className="sky" aria-hidden="true" />
        {!encounter &&
          scene.mobs.map((m, i) => (
            <Monster key={i} scene={sceneInfo} anim={m.anim} hp={m.hpFraction} slot={i} />
          ))}
        {!encounter && <HitEffects effects={scene.effects} />}
        <Hero line={line} anim={scene.hero} />
        <FloatingText floaters={scene.floaters} />
        {encounter && <BossEncounter encounter={encounter} />}
        <PortraitFrame state={state} />
        <AreaTag label={sceneInfo.label} />
        <ActivityBar activity={activity} />
        <PanelOverlay activePanel={panel} state={state} onClose={() => setPanel(null)} />
      </div>
      <Sidebar state={state} onOpen={setPanel} />
    </div>
  );
};

export default SceneView;
```

(The old `activity !== Rest` guard is gone: the director already returns `mobs: []` when not engaged, so Rest/Idle naturally shows no pack. `key={i}` is fine — slots are positional and a remount on wave change is desirable for the spawn anim.)

- [ ] **Step 4: Type-check + full suite**

Run: `cd app && bunx tsc --noEmit 2>&1 | grep -E "error TS" | head`
Expected: no output (clean).

Run: `cd app && bun test 2>&1 | grep -E "pass|fail"`
Expected: all pass, 0 fail.

Run: `grep -rn "use-combat\|useCombat" app/src`
Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add app/src/components/monster.tsx app/src/components/hit-effect.tsx app/src/components/scene-view.tsx
git commit -m "feat(app): render monster pack + hit-effect layer; wire scene-director"
```

---

## Task 5: CSS — wander stroll, slash, flash, spawn-pop, reduced motion

**Files:**
- Modify: `app/src/styles.css`
- (Presentational — verified in the VS Code panel.)

- [ ] **Step 1: Add the new keyframes + classes**

Append near the combat-choreography block (after the `@keyframes m-die {...}` rule, before `.floaters`):

```css
/* ── living-scene: wander + pack entrance + slash effect (3.8a) ── */
.hero-wander {
  animation: hero-wander 6s ease-in-out infinite;
}
@keyframes hero-wander {
  0%,
  100% {
    transform: translateX(0);
  }
  25% {
    transform: translateX(-14px);
  }
  50% {
    transform: translateX(10px);
  }
  75% {
    transform: translateX(-6px);
  }
}
.mob-spawn {
  animation: mob-spawn 0.32s ease-out;
}
@keyframes mob-spawn {
  0% {
    transform: scale(0.2) translateY(-8px);
    opacity: 0;
  }
  70% {
    transform: scale(1.12);
    opacity: 1;
  }
  100% {
    transform: scale(1);
  }
}
.hit-effects {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}
.hit-effect {
  position: absolute;
  bottom: 30%;
  width: 34px;
  height: 34px;
  background:
    linear-gradient(135deg, transparent 44%, #fff 47%, #ffe9a8 50%, #fff 53%, transparent 56%);
  filter: drop-shadow(0 0 4px #ffe9a8);
  animation: slash 0.32s ease-out forwards;
}
@keyframes slash {
  0% {
    transform: rotate(-12deg) scale(0.4);
    opacity: 0;
  }
  35% {
    transform: rotate(-12deg) scale(1.1);
    opacity: 1;
  }
  100% {
    transform: rotate(-12deg) scale(1.3);
    opacity: 0;
  }
}
```

- [ ] **Step 2: Extend the reduced-motion block**

In the existing `@media (prefers-reduced-motion: reduce) {` block (near the end of the file), add `.hero-wander`, `.mob-spawn`, and `.hit-effect` to the `animation: none` group:

```css
  .hero-attack,
  .hero-hurt,
  .hero-celebrate,
  .m-hurt,
  .m-attack,
  .m-die,
  .hero-wander,
  .mob-spawn,
  .hit-effect,
  .floater {
    animation: none;
  }
```

- [ ] **Step 3: Build + suite sanity**

Run: `cd app && bun test 2>&1 | grep -E "pass|fail"`
Expected: all pass, 0 fail (CSS isn't tested; this confirms nothing else broke).

Optional visual check (if a dev server / panel is available): farming shows 1–3 mobs popping in and taking throttled hits with a slash flash; idle shows the hero strolling with no mobs; a cleared wave pauses (~4s) then a new wave appears.

- [ ] **Step 4: Commit**

```bash
git add app/src/styles.css
git commit -m "feat(app): wander stroll + pack spawn-pop + slash effect CSS"
```

---

## Self-Review

**Spec coverage:**
- Wander⇄Engage phase machine, rest gap, throttled strike, pack 1–3 → Task 2 (`stepDirector`, tested). ✅
- Pack primitives + `HeroAnim.Wander` → Task 1 (tested). ✅
- Director hook, `IFloater`/`FloaterKind` move, delete `use-combat`, floating-text re-import → Task 3. ✅
- FF strike presentation (hero lunge reuse `.hero-attack`, slash `<HitEffect>`, mob hurt/die, flash) → Tasks 3+4+5. ✅
- Pack render (one `<Monster>` per mob, no nameplate, small HP bar, spread slots) + boss guard → Task 4. ✅
- Wander stroll, spawn-pop, slash, reduced-motion → Task 5. ✅
- Cosmetic / no core change; numbers stay real (XP via `combatBeats`, unchanged) → all tasks app-only. ✅
- Testing: pure units (pack, packSize, phase machine, heroAnim wander) → Tasks 1–2; visual → Tasks 4–5. ✅

**Placeholder scan:** none — every step has full code.

**Type consistency:** `stepDirector(state: IDirectorState, input: IDirectorInput)`, `IDirectorState { phase, pack, waveIndex, restUntil, lastStrikeAt }`, `initDirector`, `shouldEngage(activity, now, restUntil)`, `packSize/makePack/firstAlive/strike/packCleared`, `PACK_HITS`, `HeroAnim.Wander`, `heroAnim({...,wander?})` are defined in Tasks 1–2 and consumed identically in Task 3. `ISceneView { phase, hero, mobs: IMobView[], floaters, effects }` and `IHitEffect { id, slot }` are defined in Task 3 and consumed in Task 4 (`scene.mobs`, `scene.effects`, `<Monster slot>`, `<HitEffects effects>`). `IFloater` moves to `use-scene-director` and `floating-text.tsx` re-imports it. The `SLOT_RIGHT` positions are duplicated in `monster.tsx` and `hit-effect.tsx` intentionally (kept local to each presentational component; 3 values, not worth a shared module).

**Note on Task 3:** it is the integration task — dispatch with a capable model. The code given is a complete reference; the implementer should keep it StrictMode-safe (timers cleared on unmount, interval re-armed on `activity` change) and confirm the full suite stays green.
