# Commit Quest Phase 2b.2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a chosen class multiply XP from its line's signals (`+20→50%` by tier) via an idempotent sequential fold, with the rate tunable in `config.json`.

**Architecture:** The reducer sorts events by `ts` and folds once, tracking running XP; each event's multiplier uses the tier derived from the running level *before* it (causal, no circularity). Novice (no line) leaves XP identical to before.

**Tech Stack:** Bun + TypeScript, `bun test`, Prettier. No runtime npm deps.

**Reference:** Spec `docs/superpowers/specs/2026-06-11-commit-quest-phase2b2-design.md`; conventions `CLAUDE.md` (string enums, `I*`/`T*` prefixes, no `any`, braces on if/else, clarity over cleverness).

**Commit convention:** end each commit body with `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. Run `bun run format` before committing.

**Branch:** already on `feat/phase2b2-class-passive` (off `main`); spec committed.

---

## File Structure

| File | Change |
|---|---|
| `core/xp.ts` | `TPassiveRates`, `DEFAULT_PASSIVE`, `basePct(tier, rates?)` |
| `core/affinity.ts` | export `lineForEvent` (was private `lineOf`) |
| `core/config.ts` | `IConfig.passive?` + merge over `DEFAULT_PASSIVE` |
| `config/default.json` | add the `passive` block |
| `core/classes.ts` | `IClassState.base_passive_pct` |
| `core/reduce.ts` | sequential causal fold; set `base_passive_pct` |
| `tools/rpg.ts` | `status` prints the passive line |

---

## Task 1: `core/xp.ts` — passive rates

**Files:**
- Modify: `core/xp.ts`
- Test: `test/core/xp.test.ts` (append)

- [ ] **Step 1: Write the failing test**

Append to `test/core/xp.test.ts`:
```ts
import { basePct, DEFAULT_PASSIVE } from "../../core/xp";

test("basePct returns the tier rate, 0 for tier 0 / unknown, and honors overrides", () => {
  expect(basePct(0)).toBe(0);
  expect(basePct(1)).toBe(0.2);
  expect(basePct(4)).toBe(0.5);
  expect(basePct(99)).toBe(0);
  expect(basePct(1, { 1: 0.5 })).toBe(0.5);
  expect(DEFAULT_PASSIVE[3]).toBe(0.4);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test test/core/xp.test.ts`
Expected: FAIL — `basePct`/`DEFAULT_PASSIVE` not exported.

- [ ] **Step 3: Add to `core/xp.ts`**

Append to `core/xp.ts`:
```ts
export type TPassiveRates = Record<number, number>;

export const DEFAULT_PASSIVE: TPassiveRates = { 1: 0.2, 2: 0.3, 3: 0.4, 4: 0.5 };

export function basePct(tier: number, rates: TPassiveRates = DEFAULT_PASSIVE): number {
  return rates[tier] ?? 0;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test test/core/xp.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
bun run format
git add core/xp.ts test/core/xp.test.ts
git commit -m "feat(core): per-tier passive rates (basePct)"
```

---

## Task 2: `core/affinity.ts` — export `lineForEvent`

**Files:**
- Modify: `core/affinity.ts`
- Test: `test/core/affinity.test.ts` (append)

- [ ] **Step 1: Write the failing test**

Append to `test/core/affinity.test.ts`:
```ts
import { lineForEvent } from "../../core/affinity";
import { ClassLine } from "../../core/classes";

test("lineForEvent maps an event to its line (or null)", () => {
  expect(lineForEvent(ev({ type: "action", action: "run" }))).toBe(ClassLine.Mage);
  expect(lineForEvent(ev({ type: "action", action: "edit", file: "a.tsx" }))).toBe(ClassLine.Ranger);
  expect(lineForEvent(ev({ type: "prompt" }))).toBe(null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test test/core/affinity.test.ts`
Expected: FAIL — `lineForEvent` not exported.

- [ ] **Step 3: Rename + export in `core/affinity.ts`**

In `core/affinity.ts`, change the function declaration from:
```ts
function lineOf(e: INormalizedEvent): ClassLine | null {
```
to:
```ts
export function lineForEvent(e: INormalizedEvent): ClassLine | null {
```
and update its one caller inside `computeAffinity` from `const line = lineOf(e);` to:
```ts
    const line = lineForEvent(e);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test test/core/affinity.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
bun run format
git add core/affinity.ts test/core/affinity.test.ts
git commit -m "refactor(core): export lineForEvent for reuse by the passive"
```

---

## Task 3: `core/config.ts` — passive rates in config

**Files:**
- Modify: `core/config.ts`
- Modify: `config/default.json`
- Test: `test/core/config.test.ts` (append)

- [ ] **Step 1: Write the failing test**

Append to `test/core/config.test.ts`:
```ts
import { DEFAULT_PASSIVE } from "../../core/xp";

test("passive rates default to the built-in set", () => {
  const c = loadConfig(makeHome());
  expect(c.passive?.[1]).toBe(0.2);
  expect(c.passive?.[4]).toBe(0.5);
});

test("config.json overrides passive rates per tier", () => {
  const home = makeHome();
  writeFileSync(join(home, "config.json"), JSON.stringify({ passive: { 1: 0.9 } }));
  const c = loadConfig(home);
  expect(c.passive?.[1]).toBe(0.9); // overridden
  expect(c.passive?.[2]).toBe(DEFAULT_PASSIVE[2]); // default kept
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test test/core/config.test.ts`
Expected: FAIL — `loadConfig` does not return `passive`.

- [ ] **Step 3: Update `core/config.ts`**

Add `DEFAULT_PASSIVE`/`TPassiveRates` to the `./xp` import and extend `IConfig` + `loadConfig`.
Change the `./xp` import line to include the new names:
```ts
import {
  DEFAULT_WEIGHTS,
  DEFAULT_DIFFICULTY,
  DEFAULT_PASSIVE,
  type IWeights,
  type IDifficulty,
  type TPassiveRates,
} from "./xp";
```
Add `passive` to `IConfig`:
```ts
export interface IConfig {
  weights: IWeights;
  difficulty: IDifficulty;
  achievements?: Record<string, IAchievementDef>;
  passive?: TPassiveRates;
}
```
In `loadConfig`, add `passive` to the `base` object:
```ts
  const base: IConfig = {
    weights: DEFAULT_WEIGHTS,
    difficulty: DEFAULT_DIFFICULTY,
    achievements: DEFAULT_ACHIEVEMENTS,
    passive: DEFAULT_PASSIVE,
  };
```
and to the merged return object (add the line after `achievements`):
```ts
      achievements: { ...DEFAULT_ACHIEVEMENTS, ...(raw?.achievements ?? {}) },
      passive: { ...DEFAULT_PASSIVE, ...(raw?.passive ?? {}) },
```

- [ ] **Step 4: Update `config/default.json`**

In `config/default.json`, add a `passive` block as a sibling of `difficulty`:
```json
  "difficulty": { "curve_k": 7, "curve_exp": 2.5, "level_cap": 50 },
  "passive": { "1": 0.2, "2": 0.3, "3": 0.4, "4": 0.5 }
```
(Add a comma after the `difficulty` line.)

- [ ] **Step 5: Run test to verify it passes**

Run: `bun test test/core/config.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
bun run format
git add core/config.ts config/default.json test/core/config.test.ts
git commit -m "feat(core): config carries tunable passive rates"
```

---

## Task 4: `core/classes.ts` + `core/reduce.ts` — sequential causal fold

**Files:**
- Modify: `core/classes.ts` (`IClassState.base_passive_pct`)
- Modify: `core/reduce.ts` (the fold)
- Test: `test/core/reduce.test.ts` (append)

- [ ] **Step 1: Add `base_passive_pct` to `IClassState`**

In `core/classes.ts`, add the field to `IClassState` (after `advancement_pending`):
```ts
export interface IClassState {
  line: ClassLine | null;
  tier: number;
  form: ClassForm;
  icon: string;
  branch: "a" | "b" | null;
  affinity: Record<string, number>;
  advancement_pending: "class" | "branch" | null;
  base_passive_pct: number;
}
```

- [ ] **Step 2: Write the failing test**

Append to `test/core/reduce.test.ts`:
```ts
import { basePct } from "../../core/xp";

const at = (sec: string, o: object) =>
  ({ ts: `2026-06-11T12:00:${sec}Z`, source: "claude-code", session_id: "s", ...o }) as any;

const microCfg = {
  weights: {
    prompt: 1, turn_end: 1, session_end: 1,
    actions: { edit: 1, write: 1, run: 1, read: 1, search: 1, delegate: 1, other: 1 },
  },
  difficulty: { curve_k: 1, curve_exp: 1, level_cap: 50 },
  passive: { 1: 1.0, 2: 1.0, 3: 1.0, 4: 1.0 },
};

// 4 prompts (no signal) carry running XP to 4 (= Lv.5 on this tuned curve),
// then 3 mage-signal runs each get x2 (passive +100%): 4 + 2 + 2 + 2 = 10.
const microEvents = [
  at("01", { type: "prompt", repo: "cq" }),
  at("02", { type: "prompt", repo: "cq" }),
  at("03", { type: "prompt", repo: "cq" }),
  at("04", { type: "prompt", repo: "cq" }),
  at("05", { type: "action", action: "run", repo: "cq" }),
  at("06", { type: "action", action: "run", repo: "cq" }),
  at("07", { type: "action", action: "run", repo: "cq" }),
];

test("base passive multiplies line-signal XP past Lv.5 (micro-case)", () => {
  const classed = reduce(microEvents, microCfg, "2026-06-11", { line: ClassLine.Mage });
  expect(classed.xp_total).toBe(10);
  const novice = reduce(microEvents, microCfg, "2026-06-11");
  expect(novice.xp_total).toBe(7); // no line -> no multiplier
});

test("xp_total is independent of input order (the reducer sorts by ts)", () => {
  const shuffled = [microEvents[6], microEvents[0], microEvents[4], microEvents[2], microEvents[5], microEvents[1], microEvents[3]];
  const ordered = reduce(microEvents, microCfg, "2026-06-11", { line: ClassLine.Mage });
  const out = reduce(shuffled, microCfg, "2026-06-11", { line: ClassLine.Mage });
  expect(out.xp_total).toBe(ordered.xp_total);
  expect(out).toEqual(ordered);
});

test("base_passive_pct reflects the resolved tier", () => {
  const s = reduce(promptsTo5, cfgA, "2026-06-11", { name: "G", line: ClassLine.Mage });
  expect(s.class?.tier).toBe(1);
  expect(s.class?.base_passive_pct).toBe(basePct(1)); // 0.2
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `bun test test/core/reduce.test.ts`
Expected: FAIL — `reduce` still sums plainly and has no `base_passive_pct`.

- [ ] **Step 4: Rewrite the fold in `core/reduce.ts`**

Add to the import block (merge with the existing `./xp` and `./affinity` imports):
```ts
import { xpFor, levelProgress, levelFor, basePct } from "./xp";
import { computeAffinity, lineForEvent } from "./affinity";
```
(Replace the existing `import { xpFor, levelProgress } from "./xp";` and
`import { computeAffinity } from "./affinity";` lines accordingly.)

Add a small helper above `reduce` (after `toGroupStats`):
```ts
function tsOrder(ts: string): number {
  return Date.parse(ts) || 0;
}
```

Round the per-group xp in `toGroupStats`:
```ts
function toGroupStats(groups: Record<string, IGroupAcc>): Record<string, IGroupStat> {
  const stats: Record<string, IGroupStat> = {};
  for (const [key, group] of Object.entries(groups)) {
    stats[key] = { xp: Math.round(group.xp), sessions: group.sessions.size };
  }
  return stats;
}
```

Replace the reducer's main loop + `xp_total` (the block from `let xp_total = 0;` through the
`const prog = levelProgress(...)` line) with the sequential fold. The body of `reduce` becomes:
```ts
export function reduce(events: INormalizedEvent[], config: IConfig, today?: string, profile?: IProfile): TReducedState {
  let prompts = 0;
  const actions: Record<string, number> = {};
  const sessions = new Set<string>();
  const bySource: Record<string, IGroupAcc> = {};
  const byRepo: Record<string, IGroupAcc> = {};
  const dates = new Set<string>();

  const line = profile?.line ?? null;
  const sorted = [...events].sort((a, b) => tsOrder(a.ts) - tsOrder(b.ts));
  let running = 0;
  for (const e of sorted) {
    const base = xpFor(e, config.weights);
    const level = levelFor(running, config.difficulty);
    const tier = line != null && level >= 5 ? tierForLevel(level) : 0;
    const isSignal = line != null && lineForEvent(e) === line;
    const mult = isSignal && tier >= 1 ? 1 + basePct(tier, config.passive) : 1;
    const gained = base * mult;
    running += gained;

    sessions.add(e.session_id);
    dates.add(eventLocalDate(e.ts));
    if (e.type === EventType.Prompt) {
      prompts++;
    }
    if (e.type === EventType.Action && e.action) {
      actions[e.action] = (actions[e.action] ?? 0) + 1;
    }
    tally(bySource, e.source, gained, e.session_id);
    if (e.repo) {
      tally(byRepo, e.repo, gained, e.session_id);
    }
  }

  const xp_total = Math.round(running);
  const prog = levelProgress(xp_total, config.difficulty);

  const branch = profile?.branch ?? null;
  const classTier = line ? tierForLevel(prog.level) : 0;
  const classState: IClassState = {
    line,
    tier: classTier,
    form: formFor(line, classTier, branch),
    icon: iconFor(line),
    branch,
    affinity: computeAffinity(events),
    advancement_pending: advancementPending(line, prog.level, branch),
    base_passive_pct: basePct(classTier, config.passive),
  };

  const prelim: TReducedState = {
    version: 1,
    xp_total,
    level: prog.level,
    xp_in_level: prog.xp_in_level,
    xp_to_next: prog.xp_to_next,
    stats: {
      prompts,
      actions,
      sessions: sessions.size,
      by_source: toGroupStats(bySource),
      by_repo: toGroupStats(byRepo),
    },
    streak: computeStreak([...dates], today),
    class: classState,
  };
  if (profile?.name) {
    prelim.name = profile.name;
  }
  return { ...prelim, achievements: evaluateAchievements(prelim, config.achievements) };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun test test/core/reduce.test.ts`
Expected: PASS (all reduce tests, including the pre-existing Novice ones).

- [ ] **Step 6: Commit**

```bash
bun run format
git add core/classes.ts core/reduce.ts test/core/reduce.test.ts
git commit -m "feat(core): sequential causal fold applies the base class passive"
```

---

## Task 5: `tools/rpg.ts` — show the passive in `status`

**Files:**
- Modify: `tools/rpg.ts`
- Test: `test/tools/rpg.test.ts` (append)

- [ ] **Step 1: Write the failing test**

Append to `test/tools/rpg.test.ts`:
```ts
test("status shows the passive percentage once a class is set", async () => {
  const home = makeHome(); seedLevel(home, 60); // Lv.5
  await rpg(home, "class", "mage");
  const r = await rpg(home, "status");
  expect(r.code).toBe(0);
  expect(r.stdout).toContain("passive: +20%");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test test/tools/rpg.test.ts`
Expected: FAIL — `status` has no passive line.

- [ ] **Step 3: Update `status` in `tools/rpg.ts`**

Replace the `return` of the `status` function with one that adds the passive line:
```ts
  const pct = Math.round((state.class?.base_passive_pct ?? 0) * 100);
  const form = state.class?.form ?? "Novice";
  return (
    `${profile.name ?? "Adventurer"} · ${form}  (Lv.${state.level})\n` +
    `passive: +${pct}% (${form})\n` +
    `affinity: ${bars}\nsuggested line: ${suggested}`
  );
```
(The `form`/`bars`/`suggested` locals already exist in `status`; remove the old inline
`state.class?.form ?? "Novice"` in the first line if duplicated.)

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test test/tools/rpg.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
bun run format
git add tools/rpg.ts test/tools/rpg.test.ts
git commit -m "feat(tools): rpg status shows the base passive percentage"
```

---

## Task 6: full suite + tsc + format + integration

**Files:**
- Test: `test/integration/class-passive.test.ts`

- [ ] **Step 1: Write an end-to-end test**

Create `test/integration/class-passive.test.ts`:
```ts
import { test, expect } from "bun:test";
import { reduce } from "../../core/reduce";
import { loadConfig } from "../../core/config";
import { ClassLine } from "../../core/classes";
import { makeHome } from "../helpers";

test("a classed character out-levels a Novice on the same line-heavy journal", () => {
  const cfg = loadConfig(makeHome());
  // 80 runs (mage signals) — plenty to pass Lv.5 and accrue the passive
  const run = { ts: "2026-06-11T12:00:00Z", source: "claude-code", session_id: "s", type: "action", action: "run", repo: "cq" } as any;
  const events = Array.from({ length: 80 }, () => ({ ...run }));

  const novice = reduce(events, cfg, "2026-06-11");
  const mage = reduce(events, cfg, "2026-06-11", { line: ClassLine.Mage });

  expect(mage.xp_total).toBeGreaterThan(novice.xp_total);
  expect(mage.level).toBeGreaterThanOrEqual(novice.level);
  expect(mage.class?.base_passive_pct).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Run the full suite**

Run: `bun test`
Expected: all PASS (Phase 0 → 2b.2).

- [ ] **Step 3: Type-check + format check**

Run: `bunx tsc --noEmit && bun run format:check`
Expected: no type errors; all files formatted.

- [ ] **Step 4: Commit**

```bash
bun run format
git add test/integration/class-passive.test.ts
git commit -m "test: class passive end-to-end"
```

---

## Task 7: Deploy + real-session verify (manual)

- [ ] **Step 1: Redeploy**

Run `tools/install.sh --link`.

- [ ] **Step 2: Observe the passive**

```bash
bun ~/.agentrpg/tools/rpg.ts status        # note current level
bun ~/.agentrpg/tools/rpg.ts class mage    # (Lv.5+); pick your suggested line
bun ~/.agentrpg/tools/inspect.ts           # level should jump vs before (retroactive passive)
bun ~/.agentrpg/tools/rpg.ts status        # shows `passive: +N%`
```
Expect the level to rise after choosing a class (line-signal XP now multiplied).

- [ ] **Step 3: Tune if desired**

If levels rise too fast/slow, edit `~/.agentrpg/config.json`'s `passive` block (e.g. lower to
`{ "1": 0.1, "2": 0.15, … }`) and re-run `inspect.ts`. No code change needed.

- [ ] **Step 4: Finish the branch**

Use the superpowers:finishing-a-development-branch skill to PR/merge `feat/phase2b2-class-passive`.

---

## Self-Review notes (already applied)

- **Spec coverage:** rates C3/§4 (Task 1); reused signals C4/§3 (Task 2); config.passive §4 (Task 3); sequential causal fold C2/§3 + `base_passive_pct` §5 (Task 4); rpg status §6 (Task 5); DoD §9 (Tasks 6–7); out-of-scope respected (no specialist/§6.4/selection-time).
- **No placeholders:** every code step is complete; the micro-case total (10) is hand-derived in the test comment.
- **Type/name consistency:** `TPassiveRates`/`DEFAULT_PASSIVE`/`basePct`, `lineForEvent`, `IConfig.passive`, `IClassState.base_passive_pct`, `reduce(events, config, today?, profile?)` — consistent. Novice path keeps `mult = 1`, so all pre-2b.2 reduce/group-xp assertions still hold; `microCfg` satisfies `IConfig` (achievements optional).
```

