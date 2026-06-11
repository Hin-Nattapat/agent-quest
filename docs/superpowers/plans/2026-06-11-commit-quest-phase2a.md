# Commit Quest Phase 2a Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the reducer with a daily streak and an achievement tally (pure, idempotent), and show 🔥 streak in the statusline.

**Architecture:** Two new pure modules — `core/streak.ts` (local-date streak math) and `core/achievements.ts` (data-driven condition evaluator + default registry). `reduce` folds them into `state.json`; the statusline renders 🔥. All facts are monotonic so a single evaluation is stable.

**Tech Stack:** Bun + TypeScript, `bun test`. No runtime npm deps.

**Reference:** Spec `docs/superpowers/specs/2026-06-11-commit-quest-phase2a-design.md`; conventions `CLAUDE.md` (string enums, `I*`/`T*` prefixes, no `any`). Deferred git/command achievements: `docs/reference/command-aware-achievements.md`.

**Commit convention:** end each commit body with `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

**Branch:** already on `feat/phase2a-streak-achievements` (off `main`); spec already committed.

**Registry location:** `DEFAULT_ACHIEVEMENTS` lives in `core/achievements.ts` (code); `config.json` may override per-id (mirrors Phase 1's `DEFAULT_WEIGHTS`). This keeps achievements working even with a stale deployed `config.json`.

---

## File Structure

| File | Responsibility |
|---|---|
| `core/streak.ts` | `eventLocalDate`, `localTodayKey`, `computeStreak`, `IStreak` |
| `core/achievements.ts` | `TCond`, `IAchievementDef`, `DEFAULT_ACHIEVEMENTS`, `evaluateAchievements` |
| `core/state.ts` | add `IAchievementsState`, optional `streak`/`achievements` on `IState` |
| `core/config.ts` | `IConfig.achievements?` + merge `DEFAULT_ACHIEVEMENTS` |
| `core/reduce.ts` | `reduce(events, config, today?)` — fold streak + achievements |
| `hud/statusline.ts` | `renderHud` inserts `🔥{n}d` |
| `tools/inspect.ts` | headline line with level/xp/streak/achievements |

---

## Task 1: `core/streak.ts`

**Files:**
- Create: `core/streak.ts`
- Test: `test/core/streak.test.ts`

- [ ] **Step 1: Write the failing test**

Create `test/core/streak.test.ts`:
```ts
import { test, expect } from "bun:test";
import { computeStreak, eventLocalDate } from "../../core/streak";

test("a 3-day run ending today gives current=best=3", () => {
  const s = computeStreak(["2026-06-09", "2026-06-10", "2026-06-11"], "2026-06-11");
  expect(s).toEqual({ current_days: 3, best_days: 3, last_active: "2026-06-11" });
});

test("active yesterday (gap 1) keeps the streak alive", () => {
  const s = computeStreak(["2026-06-10", "2026-06-11"], "2026-06-12");
  expect(s.current_days).toBe(2);
});

test("a gap > 1 day breaks current but best survives", () => {
  const s = computeStreak(["2026-06-01", "2026-06-02", "2026-06-03", "2026-06-10", "2026-06-11"], "2026-06-15");
  expect(s.best_days).toBe(3);     // 01-03
  expect(s.current_days).toBe(0);  // last active 06-11, today 06-15 -> broken
  expect(s.last_active).toBe("2026-06-11");
});

test("duplicates are collapsed; empty input is zero", () => {
  expect(computeStreak(["2026-06-11", "2026-06-11"], "2026-06-11").current_days).toBe(1);
  expect(computeStreak([], "2026-06-11")).toEqual({ current_days: 0, best_days: 0, last_active: "" });
});

test("eventLocalDate returns a YYYY-MM-DD key", () => {
  expect(eventLocalDate("2026-06-11T12:00:00Z")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test test/core/streak.test.ts`
Expected: FAIL — cannot find module `../../core/streak`.

- [ ] **Step 3: Write `core/streak.ts`**

Create `core/streak.ts`:
```ts
export interface IStreak {
  current_days: number;
  best_days: number;
  last_active: string;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

// UTC ts -> the machine's LOCAL calendar day. The only timezone-dependent function.
export function eventLocalDate(ts: string): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function localTodayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Date key -> whole-day epoch. Parsed as UTC midnight so the run math is TZ-neutral.
function dayNumber(key: string): number {
  return Date.parse(`${key}T00:00:00Z`) / 86_400_000;
}

export function computeStreak(dateKeys: string[], today: string): IStreak {
  const days = [...new Set(dateKeys)].sort();
  if (days.length === 0) return { current_days: 0, best_days: 0, last_active: "" };

  let best = 1;
  let run = 1;
  for (let i = 1; i < days.length; i++) {
    run = dayNumber(days[i]) - dayNumber(days[i - 1]) === 1 ? run + 1 : 1;
    if (run > best) best = run;
  }

  let endRun = 1;
  for (let i = days.length - 1; i > 0; i--) {
    if (dayNumber(days[i]) - dayNumber(days[i - 1]) === 1) endRun++;
    else break;
  }

  const last = days[days.length - 1];
  const gap = dayNumber(today) - dayNumber(last);
  return { current_days: gap > 1 ? 0 : endRun, best_days: best, last_active: last };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test test/core/streak.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add core/streak.ts test/core/streak.test.ts
git commit -m "feat(core): local-day streak math"
```

---

## Task 2: `core/state.ts` + `core/achievements.ts`

**Files:**
- Modify: `core/state.ts` (add `IAchievementsState`, optional fields)
- Create: `core/achievements.ts`
- Test: `test/core/achievements.test.ts`

- [ ] **Step 1: Add shapes to `core/state.ts`**

In `core/state.ts`, add an import at the top and two optional fields + the achievements-state interface. Change the file to:
```ts
import type { IStreak } from "./streak";

export interface IGroupStat {
  xp: number;
  sessions: number;
}

export interface IAchievementsState {
  earned: string[];
  points: number;
  progress: Record<string, number>;
}

export interface IState {
  version: number;
  updated_at: string;
  xp_total: number;
  level: number;
  xp_in_level: number;
  xp_to_next: number;
  stats: {
    prompts: number;
    actions: Record<string, number>;
    sessions: number;
    by_source: Record<string, IGroupStat>;
    by_repo: Record<string, IGroupStat>;
  };
  streak?: IStreak;
  achievements?: IAchievementsState;
}
```

- [ ] **Step 2: Write the failing test**

Create `test/core/achievements.test.ts`:
```ts
import { test, expect } from "bun:test";
import { evaluateAchievements, type IAchievementDef } from "../../core/achievements";
import type { IState } from "../../core/state";

const st = (o: Partial<IState>): IState => ({
  version: 1, updated_at: "", xp_total: 0, level: 1, xp_in_level: 0, xp_to_next: 7,
  stats: { prompts: 0, actions: {}, sessions: 0, by_source: {}, by_repo: {} }, ...o,
});

const registry: Record<string, IAchievementDef> = {
  starter: { name: "Starter", desc: "", cond: { stat: "actions_total", gte: 1 }, points: 5, reward: { title: "Rookie" } },
  big: { name: "Big", desc: "", cond: { stat: "actions_total", gte: 1000 }, points: 10 },
  weekly: { name: "Weekly", desc: "", cond: { stat: "streak_best", gte: 7 }, points: 15 },
  explorer: { name: "Explorer", desc: "", cond: { distinct: "repo", gte: 2 }, points: 15 },
  combo: { name: "Combo", desc: "", cond: { all: [{ stat: "edits", gte: 1 }, { stat: "runs", gte: 1 }] }, points: 20 },
  secret: { name: "Secret", desc: "", cond: { stat: "level", gte: 5 }, points: 25, reward: { unlocks_class: "maestro" } },
};

test("earns met conditions, sums points, ignores unknown reward keys", () => {
  const state = st({
    level: 5,
    stats: { prompts: 0, actions: { edit: 3, run: 2 }, sessions: 1,
      by_source: { "claude-code": { xp: 1, sessions: 1 } },
      by_repo: { a: { xp: 1, sessions: 1 }, b: { xp: 1, sessions: 1 } } },
    streak: { current_days: 8, best_days: 8, last_active: "2026-06-11" },
  });
  const r = evaluateAchievements(state, registry);
  expect(r.earned.sort()).toEqual(["combo", "explorer", "secret", "starter", "weekly"]);
  // starter 5 + weekly 15 + explorer 15 + combo 20 + secret 25 = 80; "big" needs 1000 -> not earned
  expect(r.points).toBe(80);
  expect(r.progress.big).toBe(5); // actions_total = 5, unearned single-stat -> progress
});

test("empty/undefined registry is safe", () => {
  expect(evaluateAchievements(st({}), {})).toEqual({ earned: [], points: 0, progress: {} });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `bun test test/core/achievements.test.ts`
Expected: FAIL — cannot find module `../../core/achievements`.

- [ ] **Step 4: Write `core/achievements.ts`**

Create `core/achievements.ts`:
```ts
import type { IState, IAchievementsState } from "./state";

export type TCond =
  | { stat: string; gte?: number; lt?: number }
  | { distinct: "source" | "repo"; gte: number }
  | { all: TCond[] }
  | { any: TCond[] };

export interface IAchievementDef {
  name: string;
  desc: string;
  cond: TCond;
  points: number;
  reward?: { title?: string; loot_roll?: string; unlocks_class?: string };
  hidden?: boolean;
}

type TFacts = Record<string, number>;
type TStateLike = Omit<IState, "updated_at">;

function facts(state: TStateLike): TFacts {
  const a = state.stats.actions;
  const n = (k: string) => a[k] ?? 0;
  return {
    xp_total: state.xp_total,
    level: state.level,
    prompts: state.stats.prompts,
    sessions: state.stats.sessions,
    actions_total: Object.values(a).reduce((s, x) => s + x, 0),
    edits: n("edit"),
    writes: n("write"),
    runs: n("run"),
    reads: n("read"),
    searches: n("search"),
    delegates: n("delegate"),
    streak_best: state.streak?.best_days ?? 0,
    distinct_source: Object.keys(state.stats.by_source).length,
    distinct_repo: Object.keys(state.stats.by_repo).length,
  };
}

function passes(cond: TCond, f: TFacts): boolean {
  if ("all" in cond) return cond.all.every((c) => passes(c, f));
  if ("any" in cond) return cond.any.some((c) => passes(c, f));
  if ("distinct" in cond) {
    const v = cond.distinct === "source" ? f.distinct_source : f.distinct_repo;
    return v >= cond.gte;
  }
  const v = f[cond.stat] ?? 0;
  return (cond.gte == null || v >= cond.gte) && (cond.lt == null || v < cond.lt);
}

// Current value for a simple gte condition, for an unearned progress bar. null = no simple bar.
function progressValue(cond: TCond, f: TFacts): number | null {
  if ("distinct" in cond) return cond.distinct === "source" ? f.distinct_source : f.distinct_repo;
  if ("stat" in cond && cond.gte != null && cond.lt == null) return f[cond.stat] ?? 0;
  return null;
}

export function evaluateAchievements(
  state: TStateLike,
  registry: Record<string, IAchievementDef> = {},
): IAchievementsState {
  const f = facts(state);
  const earned: string[] = [];
  let points = 0;
  const progress: Record<string, number> = {};
  for (const [id, def] of Object.entries(registry)) {
    if (passes(def.cond, f)) {
      earned.push(id);
      points += def.points;
    } else {
      const p = progressValue(def.cond, f);
      if (p != null) progress[id] = p;
    }
  }
  return { earned, points, progress };
}

export const DEFAULT_ACHIEVEMENTS: Record<string, IAchievementDef> = {
  first_blood: { name: "First Blood", desc: "Run your first action", cond: { stat: "actions_total", gte: 1 }, points: 5, reward: { title: "Rookie" } },
  tooling_up: { name: "Tooling Up", desc: "1,000 tool actions", cond: { stat: "actions_total", gte: 1000 }, points: 10 },
  tool_master: { name: "Tool Master", desc: "10,000 tool actions", cond: { stat: "actions_total", gte: 10000 }, points: 25, reward: { title: "Veteran" } },
  wordsmith: { name: "Wordsmith", desc: "500 prompts", cond: { stat: "prompts", gte: 500 }, points: 10 },
  level_10: { name: "Double Digits", desc: "Reach level 10", cond: { stat: "level", gte: 10 }, points: 15 },
  level_25: { name: "Halfway Hero", desc: "Reach level 25", cond: { stat: "level", gte: 25 }, points: 30, reward: { title: "Adept" } },
  century: { name: "Century", desc: "100 sessions", cond: { stat: "sessions", gte: 100 }, points: 20 },
  refactor_slayer: { name: "Refactor Slayer", desc: "1,000 edits", cond: { stat: "edits", gte: 1000 }, points: 15, reward: { title: "Refactor Slayer" } },
  shell_wizard: { name: "Shell Wizard", desc: "1,000 shell runs", cond: { stat: "runs", gte: 1000 }, points: 15, reward: { title: "Shell Wizard" } },
  bookworm: { name: "Bookworm", desc: "2,000 reads", cond: { stat: "reads", gte: 2000 }, points: 10 },
  week_warrior: { name: "Week Warrior", desc: "7-day streak", cond: { stat: "streak_best", gte: 7 }, points: 15, reward: { title: "Consistent" } },
  monthly_grind: { name: "Monthly Grind", desc: "30-day streak", cond: { stat: "streak_best", gte: 30 }, points: 30, reward: { title: "Dedicated" } },
  unbroken: { name: "Unbroken", desc: "100-day streak", cond: { stat: "streak_best", gte: 100 }, points: 50, reward: { title: "Unstoppable" } },
  wanderer: { name: "Wanderer", desc: "Work in 5 repos", cond: { distinct: "repo", gte: 5 }, points: 15, reward: { title: "Explorer" } },
  globetrotter: { name: "Globetrotter", desc: "Work in 20 repos", cond: { distinct: "repo", gte: 20 }, points: 25 },
  polyglot: { name: "Polyglot", desc: "Use 3 different agent sources", cond: { distinct: "source", gte: 3 }, points: 25, hidden: true },
  well_rounded: { name: "Well-Rounded", desc: "100+ each of edit, run, read, prompt", cond: { all: [{ stat: "edits", gte: 100 }, { stat: "runs", gte: 100 }, { stat: "reads", gte: 100 }, { stat: "prompts", gte: 100 }] }, points: 20, reward: { title: "Full-Stack" } },
  bash_goblin: { name: "Bash Goblin", desc: "5,000 shell runs", cond: { stat: "runs", gte: 5000 }, points: 20, reward: { title: "Goblin" } },
  keyboard_archaeologist: { name: "Keyboard Archaeologist", desc: "5,000 reads", cond: { stat: "reads", gte: 5000 }, points: 15 },
  yak_shaver: { name: "Yak Shaver", desc: "200 sessions", cond: { stat: "sessions", gte: 200 }, points: 20, reward: { title: "Yak Shaver" } },
  delegator_supreme: { name: "Delegator Supreme", desc: "100 subagent delegations", cond: { stat: "delegates", gte: 100 }, points: 15, reward: { title: "Overlord" } },
  leet: { name: "1337", desc: "Reach 1,337 XP", cond: { stat: "xp_total", gte: 1337 }, points: 13, hidden: true },
  the_grind: { name: "The Grind Never Stops", desc: "50,000 tool actions", cond: { stat: "actions_total", gte: 50000 }, points: 50, reward: { title: "Machine" } },
  cant_stop: { name: "I Can't Stop", desc: "Reach level 50", cond: { stat: "level", gte: 50 }, points: 50, reward: { title: "Maxed" } },
  talk_is_cheap: { name: "Talk Is Cheap", desc: "2,000 prompts and 50 delegations", cond: { all: [{ stat: "prompts", gte: 2000 }, { stat: "delegates", gte: 50 }] }, points: 20, reward: { title: "Manager" } },
};
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun test test/core/achievements.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add core/state.ts core/achievements.ts test/core/achievements.test.ts
git commit -m "feat(core): achievement evaluator + default registry"
```

---

## Task 3: `core/config.ts` — achievements registry

**Files:**
- Modify: `core/config.ts`
- Test: `test/core/config.test.ts` (append)

- [ ] **Step 1: Write the failing test**

Append to `test/core/config.test.ts`:
```ts
import { DEFAULT_ACHIEVEMENTS } from "../../core/achievements";

test("achievements default to the built-in registry", () => {
  const c = loadConfig(makeHome());
  expect(c.achievements?.first_blood?.points).toBe(5);
  expect(Object.keys(c.achievements ?? {}).length).toBe(Object.keys(DEFAULT_ACHIEVEMENTS).length);
});

test("config.json can override/add achievements per id", () => {
  const home = makeHome();
  writeFileSync(join(home, "config.json"), JSON.stringify({
    achievements: { first_blood: { name: "X", desc: "", cond: { stat: "level", gte: 99 }, points: 1 } },
  }));
  const c = loadConfig(home);
  expect(c.achievements?.first_blood?.points).toBe(1);          // overridden
  expect(c.achievements?.tooling_up?.points).toBe(10);          // other defaults kept
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test test/core/config.test.ts`
Expected: FAIL — `loadConfig` does not return `achievements`.

- [ ] **Step 3: Update `core/config.ts`**

Change `core/config.ts` to:
```ts
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { DEFAULT_WEIGHTS, DEFAULT_DIFFICULTY, type IWeights, type IDifficulty } from "./xp";
import { DEFAULT_ACHIEVEMENTS, type IAchievementDef } from "./achievements";

export interface IConfig {
  weights: IWeights;
  difficulty: IDifficulty;
  achievements?: Record<string, IAchievementDef>; // optional so pre-2a reduce(events, cfg) callers still type-check
}

export function loadConfig(home: string): IConfig {
  const base: IConfig = { weights: DEFAULT_WEIGHTS, difficulty: DEFAULT_DIFFICULTY, achievements: DEFAULT_ACHIEVEMENTS };
  const p = join(home, "config.json");
  if (!existsSync(p)) return base;
  try {
    const raw = JSON.parse(readFileSync(p, "utf8"));
    return {
      weights: {
        ...DEFAULT_WEIGHTS,
        ...(raw?.xp?.weights ?? {}),
        actions: { ...DEFAULT_WEIGHTS.actions, ...(raw?.xp?.weights?.actions ?? {}) },
      },
      difficulty: { ...DEFAULT_DIFFICULTY, ...(raw?.difficulty ?? {}) },
      achievements: { ...DEFAULT_ACHIEVEMENTS, ...(raw?.achievements ?? {}) },
    };
  } catch {
    return base;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test test/core/config.test.ts`
Expected: PASS (5 tests total in the file).

- [ ] **Step 5: Commit**

```bash
git add core/config.ts test/core/config.test.ts
git commit -m "feat(core): config carries the achievement registry"
```

---

## Task 4: `core/reduce.ts` — fold streak + achievements

**Files:**
- Modify: `core/reduce.ts`
- Test: `test/core/reduce.test.ts` (append)

- [ ] **Step 1: Write the failing test**

Append to `test/core/reduce.test.ts`:
```ts
import { DEFAULT_ACHIEVEMENTS } from "../../core/achievements";

const cfgA = { weights: DEFAULT_WEIGHTS, difficulty: DEFAULT_DIFFICULTY, achievements: DEFAULT_ACHIEVEMENTS };
const evd = (day: string, o: object) =>
  ({ ts: `${day}T12:00:00Z`, source: "claude-code", session_id: "s", ...o }) as any;

test("reduce folds a streak across consecutive local days", () => {
  const events = [
    evd("2026-06-10", { type: "action", action: "edit", repo: "cq" }),
    evd("2026-06-11", { type: "action", action: "edit", repo: "cq" }),
  ];
  const s = reduce(events, cfgA, "2026-06-11");
  expect(s.streak?.best_days).toBe(2);
  expect(s.streak?.current_days).toBe(2);
});

test("an explicit today with a gap breaks current_days", () => {
  const events = [evd("2026-06-01", { type: "prompt", repo: "cq" })];
  const s = reduce(events, cfgA, "2026-06-15");
  expect(s.streak?.current_days).toBe(0);
});

test("reduce earns first_blood once an action exists", () => {
  const events = [evd("2026-06-11", { type: "action", action: "edit", repo: "cq" })];
  const s = reduce(events, cfgA, "2026-06-11");
  expect(s.achievements?.earned).toContain("first_blood");
  expect(s.achievements?.points).toBeGreaterThanOrEqual(5);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test test/core/reduce.test.ts`
Expected: FAIL — `reduce` ignores `today`, returns no `streak`/`achievements`.

- [ ] **Step 3: Update `core/reduce.ts`**

Add imports at the top of `core/reduce.ts` (merge with the existing import block):
```ts
import { eventLocalDate, computeStreak, localTodayKey } from "./streak";
import { evaluateAchievements } from "./achievements";
```
Replace the `reduce` function signature and its return so the fold also collects dates and appends streak + achievements. The function becomes:
```ts
export function reduce(events: INormalizedEvent[], config: IConfig, today?: string): TReducedState {
  let xp_total = 0;
  let prompts = 0;
  const actions: Record<string, number> = {};
  const sessions = new Set<string>();
  const by_source: Record<string, IGroupStat> = {};
  const by_repo: Record<string, IGroupStat> = {};
  const srcSessions: Record<string, Set<string>> = {};
  const repoSessions: Record<string, Set<string>> = {};
  const dates = new Set<string>();

  for (const e of events) {
    const w = xpFor(e, config.weights);
    xp_total += w;
    sessions.add(e.session_id);
    dates.add(eventLocalDate(e.ts));
    if (e.type === EventType.Prompt) prompts++;
    if (e.type === EventType.Action && e.action) actions[e.action] = (actions[e.action] ?? 0) + 1;

    (by_source[e.source] ??= { xp: 0, sessions: 0 }).xp += w;
    (srcSessions[e.source] ??= new Set()).add(e.session_id);

    if (e.repo) {
      (by_repo[e.repo] ??= { xp: 0, sessions: 0 }).xp += w;
      (repoSessions[e.repo] ??= new Set()).add(e.session_id);
    }
  }
  for (const s of Object.keys(by_source)) by_source[s].sessions = srcSessions[s].size;
  for (const r of Object.keys(by_repo)) by_repo[r].sessions = repoSessions[r].size;

  const prog = levelProgress(xp_total, config.difficulty);
  const dateKeys = [...dates];
  const lastActive = dateKeys.length ? [...dateKeys].sort().at(-1)! : "";
  const streak = computeStreak(dateKeys, today ?? lastActive);

  const prelim: TReducedState = {
    version: 1,
    xp_total,
    level: prog.level,
    xp_in_level: prog.xp_in_level,
    xp_to_next: prog.xp_to_next,
    stats: { prompts, actions, sessions: sessions.size, by_source, by_repo },
    streak,
  };
  return { ...prelim, achievements: evaluateAchievements(prelim, config.achievements) };
}
```
Then update `reduceToFile` to pass today's local key. Change its first two lines from:
```ts
  const { events } = loadEvents(home);
  const reduced = reduce(events, loadConfig(home));
```
to:
```ts
  const { events } = loadEvents(home);
  const reduced = reduce(events, loadConfig(home), localTodayKey());
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test test/core/reduce.test.ts`
Expected: PASS (5 tests in the file).

- [ ] **Step 5: Commit**

```bash
git add core/reduce.ts test/core/reduce.test.ts
git commit -m "feat(core): reduce folds streak + achievements"
```

---

## Task 5: `hud/statusline.ts` — 🔥 streak

**Files:**
- Modify: `hud/statusline.ts` (`renderHud`)
- Test: `test/hud/statusline.test.ts` (append)

- [ ] **Step 1: Write the failing test**

Append to `test/hud/statusline.test.ts`:
```ts
test("shows the fire streak when current_days >= 1, hidden at 0", () => {
  const base = state({ level: 5, xp_in_level: 200, xp_to_next: 300 });
  const tail = { model: "M", cost: 0, ctx: 0 };
  const hot = { ...base, streak: { current_days: 5, best_days: 9, last_active: "2026-06-11" } };
  expect(renderHud(hot, tail)).toContain(" 🔥5d ");
  const cold = { ...base, streak: { current_days: 0, best_days: 9, last_active: "2026-06-01" } };
  expect(renderHud(cold, tail)).not.toContain("🔥");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test test/hud/statusline.test.ts`
Expected: FAIL — no 🔥 in output.

- [ ] **Step 3: Update `renderHud` in `hud/statusline.ts`**

Replace the final `return` of `renderHud` with a version that inserts the streak after the XP percent:
```ts
  const ctx = tail.ctx == null ? 0 : Math.round(tail.ctx);
  const fire = state.streak && state.streak.current_days >= 1 ? ` 🔥${state.streak.current_days}d` : "";
  return `Lv.${state.level} ${bar}${maxed} ${Math.round(pct * 100)}%${fire}  |  ${model}  $${cost}  ·  ctx ${ctx}%`;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test test/hud/statusline.test.ts`
Expected: PASS (existing renderHud tests still pass — they have no `streak`, so `fire` is empty).

- [ ] **Step 5: Commit**

```bash
git add hud/statusline.ts test/hud/statusline.test.ts
git commit -m "feat(hud): show fire streak in the statusline"
```

---

## Task 6: `tools/inspect.ts` — reduced headline

**Files:**
- Modify: `tools/inspect.ts`
- Test: `test/tools/inspect.test.ts` (append)

- [ ] **Step 1: Write the failing test**

Append to `test/tools/inspect.test.ts`:
```ts
test("summary headline shows level, xp, streak, achievements", () => {
  const home = makeHome();
  const dir = join(home, "journal");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "s.ndjson"),
    `{"ts":"2026-06-11T12:00:00Z","source":"claude-code","session_id":"s","type":"action","action":"edit","repo":"cq"}\n`);
  const out = summarize(home);
  expect(out).toContain("level:");
  expect(out).toContain("achievements:");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test test/tools/inspect.test.ts`
Expected: FAIL — no `level:`/`achievements:` line.

- [ ] **Step 3: Update `tools/inspect.ts`**

Add imports under the existing imports in `tools/inspect.ts`:
```ts
import { reduce } from "../core/reduce";
import { loadConfig } from "../core/config";
import { localTodayKey } from "../core/streak";
```
In `summarize`, after `const { events, sessions } = loadEvents(home);`, build a headline and prepend it to the returned array. Change the `summarize` body's start + the returned array:
```ts
export function summarize(home: string): string {
  const { events, sessions } = loadEvents(home);
  const s = reduce(events, loadConfig(home), localTodayKey());
  const streak = s.streak ? `${s.streak.current_days}d (best ${s.streak.best_days})` : "0d";
  const headline =
    `level: ${s.level}  xp: ${s.xp_total}  streak: ${streak}  ` +
    `achievements: ${s.achievements?.earned.length ?? 0} (${s.achievements?.points ?? 0} pts)`;
```
and change the final `return [` line to start with `headline`:
```ts
  return [
    headline,
    `events: ${events.length}  sessions: ${sessions}`,
    `by type:`, fmt(countBy(events, "type")),
    `by action:`, fmt(countBy(events, "action")),
    `by source:`, fmt(countBy(events, "source")),
    `by repo:`, fmt(countBy(events, "repo")),
    `last 10:`, last10 || "  (none)",
  ].join("\n");
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test test/tools/inspect.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tools/inspect.ts test/tools/inspect.test.ts
git commit -m "feat(tools): inspect headline with level/xp/streak/achievements"
```

---

## Task 7: full suite + tsc + integration

**Files:**
- Test: `test/integration/streak-achievements.test.ts`

- [ ] **Step 1: Write an end-to-end test**

Create `test/integration/streak-achievements.test.ts`:
```ts
import { test, expect } from "bun:test";
import { reduceToFile } from "../../core/reduce";
import { renderHud } from "../../hud/statusline";
import { makeHome } from "../helpers";
import { mkdirSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";

test("journal -> reduceToFile -> state has streak+achievements; HUD shows fire", () => {
  const home = makeHome();
  const dir = join(home, "journal");
  mkdirSync(dir, { recursive: true });
  // one action today -> first_blood; today's activity -> current streak >= 1
  const today = new Date().toISOString().slice(0, 10);
  writeFileSync(join(dir, "s.ndjson"),
    `{"ts":"${today}T12:00:00Z","source":"claude-code","session_id":"s","type":"action","action":"edit","repo":"cq"}\n`);

  const state = reduceToFile(home);
  expect(state.achievements?.earned).toContain("first_blood");
  expect(state.streak?.current_days).toBeGreaterThanOrEqual(1);

  const onDisk = JSON.parse(readFileSync(join(home, "state.json"), "utf8"));
  expect(renderHud(onDisk, { model: "M", cost: 0, ctx: 0 })).toContain("🔥");
});
```

- [ ] **Step 2: Run the full suite**

Run: `bun test`
Expected: all PASS (Phase 0 + 1 + 2a).

- [ ] **Step 3: Type-check**

Run: `bunx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add test/integration/streak-achievements.test.ts
git commit -m "test: streak + achievements end-to-end"
```

---

## Task 8: Deploy + real-session verify (manual)

- [ ] **Step 1: Redeploy**

Run `tools/install.sh --link` (re-links; `core/` and `hud/` already covered).

- [ ] **Step 2: Reduce the real journal and inspect**

Run: `bun ~/.agentrpg/tools/inspect.ts`
Expected: the headline shows `level: … streak: … achievements: N (… pts)`; with prior activity, `first_blood` (and more) are earned.

- [ ] **Step 3: Real session shows 🔥**

Open a new Claude Code session; if you have activity today, the statusline shows
`Lv.N … % 🔥{n}d  |  …`. (No new settings merge needed — the `statusLine` command is unchanged.)

- [ ] **Step 4: Finish the branch**

Use the superpowers:finishing-a-development-branch skill to PR/merge `feat/phase2a-streak-achievements`.

---

## Self-Review notes (already applied)

- **Spec coverage:** streak local-day math A1 (Task 1); evaluator core conditions + registry A3/§4/§5 (Task 2); rewards points+title, graceful unknown reward A4 (Task 2 test); config carries registry §7 (Task 3); reduce folds streak+achievements, `today` param, monotonic facts A5/§8 (Task 4); HUD 🔥 A2/§9 (Task 5); inspect line §7 (Task 6); DoD §11 (Tasks 7–8); out-of-scope respected (no class/loot/secret/git).
- **No placeholders:** every code step is complete and runnable.
- **Type/name consistency:** `IStreak`/`IAchievementsState`/`IAchievementDef`/`TCond`/`IConfig`, `eventLocalDate`/`localTodayKey`/`computeStreak`, `evaluateAchievements`/`DEFAULT_ACHIEVEMENTS`, `reduce(events, config, today?)`, `renderHud` — consistent across tasks. `IConfig.achievements` is **optional** so pre-2a `reduce(events, cfg)` callers (Phase 1 tests) still type-check; `evaluateAchievements` defaults an absent registry to `{}`. `loadConfig` always populates it at runtime.
```

