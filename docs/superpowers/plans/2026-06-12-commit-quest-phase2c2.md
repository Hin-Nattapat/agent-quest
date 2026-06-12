# Commit Quest Phase 2c.2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add five secret classes unlocked by mid/late-game hidden achievements (or a `/rpg xyzzy` easter egg), equippable via respec, reusing the class schema + base-passive ladder.

**Architecture:** A `SecretLine` enum + `SECRET_TREE` mirror `ClassLine`/`CLASS_TREE` (4 forms, no branch). The reducer's sequential fold gains three monotonic signals (`night_actions`, `failures_recovered`, latched `ascetic_seal`); hidden achievements gate on them with level floors and carry `reward.unlocks_class`. `reduce` collects unlocked secrets (earned achievements ∪ `profile.xyzzy`→Trickster). No adapter/hook changes.

**Tech Stack:** Bun + TypeScript, `bun test`, Prettier. No runtime npm deps.

**Reference:** Spec `docs/superpowers/specs/2026-06-12-commit-quest-phase2c2-design.md`; conventions `CLAUDE.md` (string enums, `I*`/`T*` prefixes, no `any`, braces on every if/else, clarity over cleverness). End each commit body with `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. Run `bun run format` before committing. Branch: already on `feat/phase2c2-secret-classes`; spec committed.

---

## File Structure

| File | Change |
|---|---|
| `core/classes.ts` | `SecretLine` enum, secret `ClassForm` members, `SECRET_TREE`, `TLine`, `isSecret`; secret-aware `formFor`/`iconFor`/`advancementPending`; widen `IClassState.line` to `TLine \| null` |
| `core/streak.ts` | `eventLocalHour(ts)`, `isNight(ts)` |
| `core/affinity.ts` | `isPassiveSignal(line, event)` |
| `core/state.ts` | optional `stats.night_actions`/`failures_recovered`/`ascetic_seal`; `unlocked_secret_classes?` |
| `core/achievements.ts` | facts for the three signals; hidden unlock achievements; `reward.unlocks_class: SecretLine` |
| `core/profile.ts` | widen `line` to `TLine`; add `xyzzy?` |
| `core/reduce.ts` | compute the three signals; `isPassiveSignal` multiplier; assemble `unlocked_secret_classes` |
| `tools/rpg.ts` | secret-aware `class`, `secrets`, `xyzzy` |

---

## Task 1: `core/classes.ts` — secret class tree

**Files:** Modify `core/classes.ts`; Test `test/core/classes.test.ts` (append)

- [ ] **Step 1: Write the failing test**

Append to `test/core/classes.test.ts`:
```ts
import { SecretLine, isSecret, SECRET_TREE } from "../../core/classes";

test("secret lines resolve four branchless forms; Novice at tier 0", () => {
  expect(isSecret(SecretLine.Maestro)).toBe(true);
  expect(isSecret(ClassLine.Mage)).toBe(false);
  expect(formFor(SecretLine.Maestro, 0, null)).toBe(ClassForm.Novice);
  expect(formFor(SecretLine.Maestro, 1, null)).toBe(ClassForm.Conductor);
  expect(formFor(SecretLine.Maestro, 4, null)).toBe(ClassForm.GrandSymphony);
  expect(formFor(SecretLine.NightOwl, 4, "a")).toBe(ClassForm.Eclipse); // branch ignored
  expect(iconFor(SecretLine.Gremlin)).toBe(SECRET_TREE[SecretLine.Gremlin].icon);
});

test("a secret line never pends a branch, even at level 50", () => {
  expect(advancementPending(SecretLine.Maestro, 50, null)).toBe(null);
  expect(advancementPending(ClassLine.Mage, 50, null)).toBe("branch"); // main unchanged
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test test/core/classes.test.ts`
Expected: FAIL — `SecretLine`/`isSecret`/`SECRET_TREE`/secret forms undefined.

- [ ] **Step 3: Add the secret enums + tree to `core/classes.ts`**

Add the secret form members to the `ClassForm` enum (after `OrchestrationMaster`, before the closing `}`):
```ts
  Conductor = "Conductor",
  Maestro = "Maestro",
  Virtuoso = "Virtuoso",
  GrandSymphony = "Grand Symphony",

  NightOwl = "Night Owl",
  Moonlighter = "Moonlighter",
  Nocturne = "Nocturne",
  Eclipse = "Eclipse",

  Initiate = "Initiate",
  Ascetic = "Ascetic",
  Hermit = "Hermit",
  Enlightened = "Enlightened",

  Imp = "Imp",
  Gremlin = "Gremlin",
  Poltergeist = "Poltergeist",
  ChaosDaemon = "Chaos Daemon",

  Prankster = "Prankster",
  Trickster = "Trickster",
  Illusionist = "Illusionist",
  Archfool = "Archfool",
```

Add after the `ClassLine` enum:
```ts
// Secret lines: unlocked via hidden achievements / an easter egg, never in the pick menu.
export enum SecretLine {
  Maestro = "maestro",
  NightOwl = "night_owl",
  Ascetic = "ascetic",
  Gremlin = "gremlin",
  Trickster = "trickster",
}

export type TLine = ClassLine | SecretLine;

const SECRET_VALUES: Set<string> = new Set(Object.values(SecretLine));

export function isSecret(line: TLine): line is SecretLine {
  return SECRET_VALUES.has(line);
}
```

Add after `CLASS_TREE`:
```ts
export interface ISecretDef {
  icon: string;
  forms: [ClassForm, ClassForm, ClassForm, ClassForm]; // T1..T4, no branch
}

export const SECRET_TREE: Record<SecretLine, ISecretDef> = {
  [SecretLine.Maestro]: {
    icon: "🎼",
    forms: [ClassForm.Conductor, ClassForm.Maestro, ClassForm.Virtuoso, ClassForm.GrandSymphony],
  },
  [SecretLine.NightOwl]: {
    icon: "🦉",
    forms: [ClassForm.NightOwl, ClassForm.Moonlighter, ClassForm.Nocturne, ClassForm.Eclipse],
  },
  [SecretLine.Ascetic]: {
    icon: "🧘",
    forms: [ClassForm.Initiate, ClassForm.Ascetic, ClassForm.Hermit, ClassForm.Enlightened],
  },
  [SecretLine.Gremlin]: {
    icon: "👺",
    forms: [ClassForm.Imp, ClassForm.Gremlin, ClassForm.Poltergeist, ClassForm.ChaosDaemon],
  },
  [SecretLine.Trickster]: {
    icon: "✦",
    forms: [ClassForm.Prankster, ClassForm.Trickster, ClassForm.Illusionist, ClassForm.Archfool],
  },
};
```

- [ ] **Step 4: Widen `IClassState.line` and the three helpers to `TLine`**

Change `IClassState`:
```ts
export interface IClassState {
  line: TLine | null;
  tier: number;
  form: ClassForm;
  icon: string;
  branch: "a" | "b" | null;
  affinity: Record<string, number>;
  advancement_pending: "class" | "branch" | null;
  base_passive_pct: number;
}
```

Replace `iconFor`:
```ts
export function iconFor(line: TLine | null): string {
  if (!line) {
    return "";
  }
  if (isSecret(line)) {
    return SECRET_TREE[line].icon;
  }
  return CLASS_TREE[line].icon;
}
```

Replace `formFor`:
```ts
export function formFor(
  line: TLine | null,
  tier: number,
  branch: "a" | "b" | null,
): ClassForm {
  if (!line || tier === 0) {
    return ClassForm.Novice;
  }
  if (isSecret(line)) {
    const idx = Math.min(Math.max(tier - 1, 0), 3);
    return SECRET_TREE[line].forms[idx];
  }
  if (tier >= 4) {
    if (branch) {
      return CLASS_TREE[line].branches[branch];
    }
    return CLASS_TREE[line].forms[2];
  }
  return CLASS_TREE[line].forms[tier - 1];
}
```

Replace `advancementPending`:
```ts
export function advancementPending(
  line: TLine | null,
  level: number,
  branch: "a" | "b" | null,
): "class" | "branch" | null {
  if (level >= 5 && line == null) {
    return "class";
  }
  if (line != null && isSecret(line)) {
    return null; // secret lines have no T4 branch and aren't offered at Lv.5
  }
  if (level >= 50 && line != null && branch == null) {
    return "branch";
  }
  return null;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun test test/core/classes.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
bun run format
git add core/classes.ts test/core/classes.test.ts
git commit -m "feat(core): secret class tree (SecretLine + SECRET_TREE, branchless)"
```

---

## Task 2: `core/streak.ts` — local hour / night

**Files:** Modify `core/streak.ts`; Test `test/core/streak.test.ts` (append)

- [ ] **Step 1: Write the failing test**

Append to `test/core/streak.test.ts`:
```ts
import { eventLocalHour, isNight } from "../../core/streak";

test("isNight covers local 00:00–03:59 only", () => {
  const at = (h: number) => `2026-06-11T${String(h).padStart(2, "0")}:30:00`;
  expect(isNight(at(0))).toBe(true);
  expect(isNight(at(3))).toBe(true);
  expect(isNight(at(4))).toBe(false);
  expect(isNight(at(13))).toBe(false);
  expect(eventLocalHour(at(2))).toBe(2);
});
```
(The timestamps are local — no `Z` — so the test is timezone-stable.)

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test test/core/streak.test.ts`
Expected: FAIL — `eventLocalHour`/`isNight` undefined.

- [ ] **Step 3: Add to `core/streak.ts`** (after `localTodayKey`)
```ts
const NIGHT_END_HOUR = 4; // local 00:00–03:59 is "night"

export function eventLocalHour(ts: string): number {
  return new Date(ts).getHours();
}

export function isNight(ts: string): boolean {
  const hour = eventLocalHour(ts);
  return hour >= 0 && hour < NIGHT_END_HOUR;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test test/core/streak.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
bun run format
git add core/streak.ts test/core/streak.test.ts
git commit -m "feat(core): eventLocalHour + isNight (local 00–04)"
```

---

## Task 3: `core/affinity.ts` — passive signal dispatch

**Files:** Modify `core/affinity.ts`; Test `test/core/affinity.test.ts` (append)

- [ ] **Step 1: Write the failing test**

Append to `test/core/affinity.test.ts`:
```ts
import { isPassiveSignal } from "../../core/affinity";
import { SecretLine } from "../../core/classes";

test("isPassiveSignal: main lines delegate to lineForEvent, secrets use their predicate", () => {
  // main: unchanged behavior
  expect(isPassiveSignal(ClassLine.Mage, ev({ type: "action", action: "run" }))).toBe(true);
  // Maestro -> delegate
  expect(isPassiveSignal(SecretLine.Maestro, ev({ type: "action", action: "delegate" }))).toBe(true);
  expect(isPassiveSignal(SecretLine.Maestro, ev({ type: "action", action: "read" }))).toBe(false);
  // Night Owl -> an action at night
  expect(isPassiveSignal(SecretLine.NightOwl, ev({ type: "action", action: "read", ts: "2026-06-11T02:00:00" }))).toBe(true);
  expect(isPassiveSignal(SecretLine.NightOwl, ev({ type: "action", action: "read", ts: "2026-06-11T13:00:00" }))).toBe(false);
  // Ascetic -> read/edit
  expect(isPassiveSignal(SecretLine.Ascetic, ev({ type: "action", action: "edit" }))).toBe(true);
  // Gremlin -> action_fail
  expect(isPassiveSignal(SecretLine.Gremlin, ev({ type: "action_fail", action: "run" }))).toBe(true);
  // Trickster -> never
  expect(isPassiveSignal(SecretLine.Trickster, ev({ type: "action", action: "delegate" }))).toBe(false);
});
```
(`ev` is the existing helper in this test file; it lets you set `type`/`action`/`ts`.)

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test test/core/affinity.test.ts`
Expected: FAIL — `isPassiveSignal` undefined.

- [ ] **Step 3: Add to `core/affinity.ts`**

Extend the imports at the top:
```ts
import { EventType, AgentAction, type INormalizedEvent } from "./events";
import { ClassLine, SecretLine, isSecret, type TLine } from "./classes";
import { isNight } from "./streak";
```
Add at the end of the file:
```ts
// Which events feed a line's base passive. Main lines reuse affinity's signal; secret lines
// each have a narrow thematic predicate (so a secret is never strictly stronger than a main line).
export function isPassiveSignal(line: TLine, e: INormalizedEvent): boolean {
  if (!isSecret(line)) {
    return lineForEvent(e) === line;
  }
  switch (line) {
    case SecretLine.Maestro:
      return e.action === AgentAction.Delegate;
    case SecretLine.NightOwl:
      return e.type === EventType.Action && isNight(e.ts);
    case SecretLine.Ascetic:
      return e.action === AgentAction.Read || e.action === AgentAction.Edit;
    case SecretLine.Gremlin:
      return e.type === EventType.ActionFail;
    case SecretLine.Trickster:
      return false;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test test/core/affinity.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
bun run format
git add core/affinity.ts test/core/affinity.test.ts
git commit -m "feat(core): isPassiveSignal dispatches main vs secret signals"
```

---

## Task 4: `core/state.ts` + `core/achievements.ts` — signals & unlock achievements

**Files:** Modify `core/state.ts`, `core/achievements.ts`; Test `test/core/achievements.test.ts` (append)

- [ ] **Step 1: Add the state fields**

In `core/state.ts`, import `SecretLine`:
```ts
import type { IClassState, SecretLine } from "./classes";
```
Add the three optional signal fields to `stats` and `unlocked_secret_classes` to `IState`:
```ts
  stats: {
    prompts: number;
    actions: Record<string, number>;
    sessions: number;
    by_source: Record<string, IGroupStat>;
    by_repo: Record<string, IGroupStat>;
    night_actions?: number;
    failures_recovered?: number;
    ascetic_seal?: number;
  };
  streak?: IStreak;
  achievements?: IAchievementsState;
  name?: string;
  class?: IClassState;
  inventory?: IInventoryItem[];
  cosmetics?: ICosmetics;
  unlocked_secret_classes?: SecretLine[];
```

- [ ] **Step 2: Write the failing test**

Append to `test/core/achievements.test.ts`:
```ts
import { SecretLine } from "../../core/classes";

function baseState(over: Partial<any> = {}): any {
  return {
    version: 1,
    xp_total: 0,
    level: 0,
    xp_in_level: 0,
    xp_to_next: 0,
    stats: { prompts: 0, actions: {}, sessions: 0, by_source: {}, by_repo: {} },
    ...over,
  };
}

test("maestro needs both 3 sources AND level >= 25; one alone is not enough", () => {
  const reg = DEFAULT_ACHIEVEMENTS;
  const sources = { by_source: { a: { xp: 1, sessions: 1 }, b: { xp: 1, sessions: 1 }, c: { xp: 1, sessions: 1 } } };
  const low = baseState({ level: 10, stats: { prompts: 0, actions: {}, sessions: 0, by_repo: {}, ...sources } });
  const high = baseState({ level: 25, stats: { prompts: 0, actions: {}, sessions: 0, by_repo: {}, ...sources } });
  expect(evaluateAchievements(low, reg).earned).not.toContain("maestro");
  expect(evaluateAchievements(high, reg).earned).toContain("maestro");
  expect(reg.maestro.reward?.unlocks_class).toBe(SecretLine.Maestro);
});

test("night_owl / the_gremlin / the_ascetic read the new signals", () => {
  const reg = DEFAULT_ACHIEVEMENTS;
  const owl = baseState({ level: 20, stats: { prompts: 0, actions: {}, sessions: 0, by_source: {}, by_repo: {}, night_actions: 60 } });
  expect(evaluateAchievements(owl, reg).earned).toContain("night_owl");
  const grem = baseState({ level: 20, stats: { prompts: 0, actions: {}, sessions: 0, by_source: {}, by_repo: {}, failures_recovered: 40 } });
  expect(evaluateAchievements(grem, reg).earned).toContain("the_gremlin");
  const asc = baseState({ level: 25, stats: { prompts: 0, actions: {}, sessions: 0, by_source: {}, by_repo: {}, ascetic_seal: 1 } });
  expect(evaluateAchievements(asc, reg).earned).toContain("the_ascetic");
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `bun test test/core/achievements.test.ts`
Expected: FAIL — the four achievements / facts don't exist.

- [ ] **Step 4: Add facts + the unlock achievements in `core/achievements.ts`**

Import `SecretLine` at the top:
```ts
import { SecretLine } from "./classes";
```
Type `reward.unlocks_class` as `SecretLine` in `IAchievementDef`:
```ts
  reward?: { title?: string; loot_roll?: string; unlocks_class?: SecretLine };
```
In `facts()`, add the three signals to the returned object (after `distinct_repo`):
```ts
    night_actions: state.stats.night_actions ?? 0,
    failures_recovered: state.stats.failures_recovered ?? 0,
    ascetic_seal: state.stats.ascetic_seal ?? 0,
```
Add `reward: { unlocks_class: SecretLine.Maestro }` is **not** put on the existing `polyglot`; instead add four new entries to `DEFAULT_ACHIEVEMENTS` (before the closing `}`):
```ts
  maestro: {
    name: "Maestro",
    desc: "Conduct 3+ agent sources at high level",
    cond: { all: [{ distinct: "source", gte: 3 }, { stat: "level", gte: 25 }] },
    points: 30,
    hidden: true,
    reward: { unlocks_class: SecretLine.Maestro },
  },
  night_owl: {
    name: "Night Owl",
    desc: "60 actions in the dead of night (local 00–04)",
    cond: { all: [{ stat: "night_actions", gte: 60 }, { stat: "level", gte: 20 }] },
    points: 25,
    hidden: true,
    reward: { unlocks_class: SecretLine.NightOwl },
  },
  the_ascetic: {
    name: "The Ascetic",
    desc: "Reach Lv.25 as a minimalist — under 20% shell runs",
    cond: { stat: "ascetic_seal", gte: 1 },
    points: 30,
    hidden: true,
    reward: { unlocks_class: SecretLine.Ascetic },
  },
  the_gremlin: {
    name: "The Gremlin",
    desc: "Recover from 40 failed actions",
    cond: { all: [{ stat: "failures_recovered", gte: 40 }, { stat: "level", gte: 20 }] },
    points: 25,
    hidden: true,
    reward: { unlocks_class: SecretLine.Gremlin },
  },
```

- [ ] **Step 5: Update any DEFAULT_ACHIEVEMENTS count assertion**

Run: `bun test test/core/achievements.test.ts test/core/config.test.ts`
If a test asserts the number of achievements (e.g. `Object.keys(DEFAULT_ACHIEVEMENTS).length`), bump the expected count by 4. If none, continue.
Expected: PASS.

- [ ] **Step 6: Commit**
```bash
bun run format
git add core/state.ts core/achievements.ts test/core/achievements.test.ts
git commit -m "feat(core): unlock achievements + signal facts for secret classes"
```

---

## Task 5: `core/reduce.ts` + `core/profile.ts` — compute signals & unlocks

**Files:** Modify `core/reduce.ts`, `core/profile.ts`; Test `test/core/reduce.test.ts` (append)

- [ ] **Step 1: Widen the profile**

In `core/profile.ts`, import `TLine` and use it:
```ts
import type { TLine } from "./classes";

export interface IProfile {
  name?: string;
  line?: TLine;
  branch?: "a" | "b";
  title?: string;
  theme?: string;
  xyzzy?: boolean;
}
```

- [ ] **Step 2: Write the failing test**

Append to `test/core/reduce.test.ts`:
```ts
import { SecretLine } from "../../core/classes";
import { loadConfig } from "../../core/config";
import { makeHome } from "../helpers";

const easy = (home: string) => ({
  ...loadConfig(home),
  difficulty: { curve_k: 1, curve_exp: 1, level_cap: 50 },
});
const act = (i: number, o: object) =>
  ({ ts: `2026-06-11T12:00:00Z`, source: "s", session_id: "sess", type: "action", ...o }) as any;

test("secret base passive multiplies its thematic signal (Maestro/delegate micro-case)", () => {
  const s = reduce(microEvents, microCfg, "2026-06-11", { line: ClassLine.Mage });
  expect(s.xp_total).toBe(10); // sanity: 2b.2 main-line case still holds
  const maestroEvents = [
    at("01", { type: "prompt", repo: "cq" }),
    at("02", { type: "prompt", repo: "cq" }),
    at("03", { type: "prompt", repo: "cq" }),
    at("04", { type: "prompt", repo: "cq" }),
    at("05", { type: "action", action: "delegate", repo: "cq" }),
    at("06", { type: "action", action: "delegate", repo: "cq" }),
    at("07", { type: "action", action: "delegate", repo: "cq" }),
  ];
  const maestro = reduce(maestroEvents, microCfg, "2026-06-11", { line: SecretLine.Maestro });
  expect(maestro.xp_total).toBe(10); // 4 + 2 + 2 + 2 (delegates x2 past Lv.5)
});

test("earning an unlock achievement fills unlocked_secret_classes; balance gates on level", () => {
  const home = makeHome();
  const cfg = easy(home);
  // 30 reads from 3 sources -> level 31 (easy curve), distinct_source 3, ratio 0 -> maestro + ascetic
  const many = Array.from({ length: 30 }, (_, i) => act(i, { source: `s${i % 3}`, action: "read" }));
  const hi = reduce(many, cfg, "2026-06-11");
  expect(hi.unlocked_secret_classes).toContain(SecretLine.Maestro);
  // few events -> low level -> nothing unlocked despite 3 sources
  const few = Array.from({ length: 3 }, (_, i) => act(i, { source: `s${i}`, action: "read" }));
  expect(reduce(few, cfg, "2026-06-11").unlocked_secret_classes ?? []).not.toContain(SecretLine.Maestro);
});

test("xyzzy unlocks the Trickster; unlocks are stable on recompute", () => {
  const home = makeHome();
  const cfg = loadConfig(home);
  const a = reduce(microEvents, cfg, "2026-06-11", { xyzzy: true });
  const b = reduce(microEvents, cfg, "2026-06-11", { xyzzy: true });
  expect(a.unlocked_secret_classes).toContain(SecretLine.Trickster);
  expect(b.unlocked_secret_classes).toEqual(a.unlocked_secret_classes);
});

test("failures_recovered counts a fail then a same-kind success in one session", () => {
  const evs = [
    act(0, { type: "action_fail", action: "run", session_id: "x" }),
    act(1, { type: "action", action: "run", session_id: "x" }),
    act(2, { type: "action_fail", action: "edit", session_id: "x" }), // no recovery (no later edit)
  ];
  const s = reduce(evs, microCfg, "2026-06-11");
  expect(s.stats.failures_recovered).toBe(1);
});
```
(`microEvents`/`microCfg`/`at` already exist in this file from Phase 2b.2.)

- [ ] **Step 3: Run test to verify it fails**

Run: `bun test test/core/reduce.test.ts`
Expected: FAIL — no secret passive, no `unlocked_secret_classes`, no `failures_recovered`.

- [ ] **Step 4: Update `core/reduce.ts`**

Replace the `./affinity` and `./streak` and `./classes` imports and add constants. Change the affinity import to use `isPassiveSignal`:
```ts
import { computeAffinity, isPassiveSignal } from "./affinity";
import { eventLocalDate, computeStreak, localTodayKey, isNight } from "./streak";
```
Add `SecretLine`, `isSecret`, `type TLine` to the `./classes` import (keep the existing names):
```ts
import {
  tierForLevel,
  formFor,
  iconFor,
  advancementPending,
  SecretLine,
  type IClassState,
} from "./classes";
```
Add `type IAchievementDef` to the achievements import:
```ts
import { evaluateAchievements, type IAchievementDef } from "./achievements";
```
Add these module constants near the top (after the imports):
```ts
const ASCETIC_LEVEL = 25;
const ASCETIC_MAX_RUN_RATIO = 0.2;
```
Add a helper above `reduce` (after `tsOrder`):
```ts
function collectUnlocks(
  earned: string[],
  registry: Record<string, IAchievementDef>,
  profile?: IProfile,
): SecretLine[] {
  const set = new Set<SecretLine>();
  for (const id of earned) {
    const unlock = registry[id]?.reward?.unlocks_class;
    if (unlock) {
      set.add(unlock);
    }
  }
  if (profile?.xyzzy) {
    set.add(SecretLine.Trickster);
  }
  return [...set].sort();
}
```
Inside `reduce`, add accumulators next to the existing ones (after `const sessionInfo = ...`):
```ts
  let nightActions = 0;
  let failuresRecovered = 0;
  let asceticSeal = 0;
  let runningRuns = 0;
  let runningActions = 0;
  const pendingFail = new Set<string>();
```
In the fold loop, change the `isSignal` line to use `isPassiveSignal`:
```ts
    const isSignal = line != null && isPassiveSignal(line, e);
```
Then, still inside the loop, after the existing `if (e.type === EventType.Action && e.action) { actions[...]... }` block, add the signal bookkeeping:
```ts
    if (e.type === EventType.Action || e.type === EventType.ActionFail) {
      if (isNight(e.ts)) {
        nightActions++;
      }
    }
    if (e.type === EventType.Action && e.action) {
      runningActions++;
      if (e.action === AgentAction.Run) {
        runningRuns++;
      }
      const key = `${e.session_id}:${e.action}`;
      if (pendingFail.has(key)) {
        failuresRecovered++;
        pendingFail.delete(key);
      }
    }
    if (e.type === EventType.ActionFail && e.action) {
      pendingFail.add(`${e.session_id}:${e.action}`);
    }
    if (asceticSeal === 0 && runningActions > 0) {
      const lvlNow = levelFor(running, config.difficulty);
      if (lvlNow >= ASCETIC_LEVEL && runningRuns / runningActions < ASCETIC_MAX_RUN_RATIO) {
        asceticSeal = 1;
      }
    }
```
Add `AgentAction` to the `./events` import:
```ts
import { EventType, AgentAction, type INormalizedEvent } from "./events";
```
Add the three signals to `prelim.stats`:
```ts
    stats: {
      prompts,
      actions,
      sessions: sessions.size,
      by_source: toGroupStats(bySource),
      by_repo: toGroupStats(byRepo),
      night_actions: nightActions,
      failures_recovered: failuresRecovered,
      ascetic_seal: asceticSeal,
    },
```
Finally, replace the `return` line with one that attaches the unlocks:
```ts
  const achievements = evaluateAchievements(prelim, config.achievements);
  const unlocked = collectUnlocks(achievements.earned, config.achievements ?? {}, profile);
  return { ...prelim, achievements, unlocked_secret_classes: unlocked };
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun test test/core/reduce.test.ts`
Expected: PASS (including the pre-existing Novice/2b.2 cases — `isPassiveSignal` for a main line equals the old `lineForEvent` test).

- [ ] **Step 6: Commit**
```bash
bun run format
git add core/reduce.ts core/profile.ts test/core/reduce.test.ts
git commit -m "feat(core): fold computes night/recovery/ascetic signals + secret unlocks"
```

---

## Task 6: `tools/rpg.ts` — equip secrets, list, xyzzy

**Files:** Modify `tools/rpg.ts`; Test `test/tools/rpg.test.ts` (append)

- [ ] **Step 1: Write the failing test**

Append to `test/tools/rpg.test.ts`:
```ts
test("a locked secret class is rejected; xyzzy unlocks the Trickster and lets you equip it", async () => {
  const home = makeHome();
  seedLevel(home, 60); // Lv.5+
  const locked = await rpg(home, "class", "maestro");
  expect(locked.code).toBe(1); // not unlocked

  const egg = await rpg(home, "xyzzy");
  expect(egg.code).toBe(0);
  expect(profile(home).xyzzy).toBe(true);

  const sec = await rpg(home, "secrets");
  expect(sec.stdout).toContain("trickster");

  const equip = await rpg(home, "class", "trickster");
  expect(equip.code).toBe(0);
  expect(profile(home).line).toBe("trickster");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test test/tools/rpg.test.ts`
Expected: FAIL — `xyzzy`/`secrets` unknown; `class trickster` rejected as unknown.

- [ ] **Step 3: Update `tools/rpg.ts`**

Extend the imports:
```ts
import { defaultHome, loadConfig } from "../core/config";
import {
  ClassLine,
  SecretLine,
  CLASS_TREE,
  SECRET_TREE,
} from "../core/classes";
```
Add a secret-line list next to `LINES`:
```ts
const SECRETS = Object.values(SecretLine) as string[];
```
Replace `setClass` so it handles both main and secret lines:
```ts
function setClass(profile: IProfile, line: string): string {
  if (LINES.includes(line)) {
    if (currentLevel() < 5) {
      fail("Reach level 5 before choosing a class.");
    }
    profile.line = line as ClassLine;
    profile.branch = undefined;
    persist(profile);
    return `Class set to ${line}.`;
  }
  if (SECRETS.includes(line)) {
    const unlocked = reduceToFile(HOME).unlocked_secret_classes ?? [];
    if (!unlocked.includes(line as SecretLine)) {
      fail(`Secret class "${line}" is locked.`);
    }
    profile.line = line as SecretLine;
    profile.branch = undefined;
    persist(profile);
    return `Class set to ${line}.`;
  }
  fail(`Unknown class "${line}". Choose: ${LINES.join(", ")}.`);
}
```
Add the `secrets` and `xyzzy` commands (after `status`):
```ts
function secrets(): string {
  const unlocked = new Set((reduceToFile(HOME).unlocked_secret_classes ?? []) as string[]);
  const registry = loadConfig(HOME).achievements ?? {};
  const hint: Record<string, string> = { [SecretLine.Trickster]: "whispered, not earned" };
  for (const def of Object.values(registry)) {
    if (def.reward?.unlocks_class) {
      hint[def.reward.unlocks_class] = def.desc;
    }
  }
  return SECRETS.map(s => {
    if (unlocked.has(s)) {
      return `${SECRET_TREE[s as SecretLine].icon} ${s} — UNLOCKED`;
    }
    return `??? — ${hint[s] ?? "hidden"}`;
  }).join("\n");
}

function xyzzy(profile: IProfile): string {
  profile.xyzzy = true;
  persist(profile);
  return "A hollow voice says 'Fool.'  ✦ The Trickster is yours — `rpg class trickster`.";
}
```
Add the cases to the `switch` (after `status`):
```ts
    case "secrets":
      out = secrets();
      break;
    case "xyzzy":
      out = xyzzy(profile);
      break;
```
Update the default usage string:
```ts
      fail("Usage: rpg <name|class|branch|respec|status|inventory|title|theme|secrets|xyzzy> …");
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test test/tools/rpg.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
bun run format
git add tools/rpg.ts test/tools/rpg.test.ts
git commit -m "feat(tools): rpg secrets + xyzzy easter egg; equip unlocked secrets"
```

---

## Task 7: integration + full suite + tsc + format

**Files:** Test `test/integration/secret-classes.test.ts`

- [ ] **Step 1: Write an end-to-end test**

Create `test/integration/secret-classes.test.ts`:
```ts
import { test, expect } from "bun:test";
import { reduce } from "../../core/reduce";
import { loadConfig } from "../../core/config";
import { renderHud } from "../../hud/statusline";
import { SecretLine } from "../../core/classes";
import { makeHome } from "../helpers";

test("unlock via xyzzy, equip the secret, and see it in the HUD", () => {
  const cfg = loadConfig(makeHome());
  const events = [
    { ts: "2026-06-11T12:00:00Z", source: "claude-code", session_id: "s", type: "prompt", repo: "cq" },
  ] as any;

  const unlocked = reduce(events, cfg, "2026-06-11", { xyzzy: true });
  expect(unlocked.unlocked_secret_classes).toContain(SecretLine.Trickster);

  const equipped = reduce(events, cfg, "2026-06-11", { xyzzy: true, line: SecretLine.Trickster });
  expect(equipped.class?.line).toBe(SecretLine.Trickster);
  expect(equipped.class?.branch).toBe(null);
  const line = renderHud({ ...equipped, updated_at: "" }, { model: "M", cost: 0, ctx: 0 });
  expect(line).toContain("✦"); // the Trickster icon renders
});
```

- [ ] **Step 2: Run the full suite**

Run: `bun test`
Expected: all PASS (Phase 0 → 2c.2).

- [ ] **Step 3: Type-check + format check**

Run: `bunx tsc --noEmit && bun run format:check`
Expected: no type errors; all files formatted. (If `tsc` flags an exhaustive-switch return in `isPassiveSignal`, confirm every `SecretLine` case is present — it is — TypeScript then sees all paths return.)

- [ ] **Step 4: Commit**
```bash
bun run format
git add test/integration/secret-classes.test.ts
git commit -m "test: secret class unlock -> equip -> HUD end-to-end"
```

---

## Task 8: Deploy + real-session verify (manual)

- [ ] **Step 1: Redeploy** — `tools/install.sh --link`.

- [ ] **Step 2: Try it on the real home**
```bash
bun ~/.agentrpg/tools/rpg.ts secrets        # locked ones show ??? with a hint
bun ~/.agentrpg/tools/rpg.ts xyzzy           # unlock the Trickster
bun ~/.agentrpg/tools/rpg.ts class trickster # equip it
bun ~/.agentrpg/tools/inspect.ts             # headline shows the secret form
```
Expect `secrets` to list `???` for the locked four (you won't meet the mid/late gates yet) and the Trickster to unlock + equip.

- [ ] **Step 3: Tune if desired** — unlock thresholds live in `~/.agentrpg/config.json`'s
`achievements` (override `maestro`/`night_owl`/`the_gremlin` `cond`); the Ascetic seal's
`Lv.25`/`< 0.2` are `ASCETIC_LEVEL`/`ASCETIC_MAX_RUN_RATIO` constants in `core/reduce.ts`.

- [ ] **Step 4: Finish the branch** — use the superpowers:finishing-a-development-branch skill
(grouping commit + push + PR, "Part of #3").

---

## Self-Review notes (already applied)

- **Spec coverage:** SecretLine+SECRET_TREE/D2 (Task 1); isNight §5 (Task 2); isPassiveSignal §6 (Task 3); signals+facts+unlock achievements §3/§5/§12 (Tasks 4–5); fold signals + `unlocked_secret_classes` + xyzzy §4/§8 (Task 5); rpg secrets/class/xyzzy §9 (Task 6); HUD renders via existing path §10 (Task 7); balance level-floors §12 (Task 4 conds); out-of-scope respected (no adapter, no gimmicks, no config-defined classes).
- **No placeholders:** every code step is complete; the Maestro micro-case total (10) is the same hand-derived arithmetic as 2b.2 (4 + 2·3).
- **Type/name consistency:** `SecretLine`, `TLine`, `isSecret`, `SECRET_TREE`, `ISecretDef`, `isPassiveSignal`, `eventLocalHour`/`isNight`, `stats.night_actions`/`failures_recovered`/`ascetic_seal`, `unlocked_secret_classes`, `collectUnlocks`, `reward.unlocks_class: SecretLine`, `profile.xyzzy` — consistent across tasks. Widening `formFor`/`iconFor`/`advancementPending`/`IClassState.line`/`IProfile.line` to `TLine` is backward-compatible (`ClassLine ⊂ TLine`), so existing reduce/rpg/HUD callers still type-check. Novice/main-line passive path is unchanged (`isPassiveSignal` for a `ClassLine` returns the old `lineForEvent` result).
```
