# Commit Quest Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fold the journal into `state.json` (level + XP + stats) and render it live in the Claude Code statusline.

**Architecture:** Pure `reduce(events) → state` over the Phase 0 journal, written atomically to `state.json`. The statusline calls a throttled re-reduce (≤ every 2 s), reads `state.json`, and prints one HUD line. All XP/curve numbers come from `config.json` (defaults baked into `core/`).

**Tech Stack:** Bun + TypeScript. Tests via `bun test`. No npm runtime deps (type-only devDeps only).

**Reference:** Spec `docs/superpowers/specs/2026-06-11-commit-quest-phase1-design.md`; conventions `CLAUDE.md` (string enums, `I*`/`T*` prefixes, no `any`).

**Commit convention:** end each commit body with `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>` (omitted from the short `-m` examples below).

**Branch:** already on `feat/phase1-reducer` (off `main`); spec already committed.

---

## File Structure

| File | Responsibility |
|---|---|
| `core/xp.ts` | weights + curve: `xpFor`, `xpForLevel`, `levelFor`, `levelProgress`, defaults |
| `core/journal.ts` | `loadEvents(home)` — shared journal reader (extracted from `inspect.ts`) |
| `core/config.ts` | `loadConfig(home)` — merge `config.json` over defaults |
| `core/state.ts` | `IState`, `IGroupStat` |
| `core/reduce.ts` | `reduce` (pure), `reduceToFile`, `reduceThrottled` |
| `hud/statusline.ts` | `renderHud` (pure) + main (stdin → throttle → state → print) |
| `config/default.json` | add `xp.weights` + `difficulty` |
| `adapters/claude-code/settings.snippet.json` | add `statusLine` |
| `tools/install.sh` | deploy `hud/` |
| `inspect.ts` | refactor to import `loadEvents` from `core/journal.ts` |

---

## Task 1: `core/xp.ts` — weights + curve

**Files:**
- Create: `core/xp.ts`
- Test: `test/core/xp.test.ts`

- [ ] **Step 1: Write the failing test**

Create `test/core/xp.test.ts`:
```ts
import { test, expect } from "bun:test";
import { xpFor, xpForLevel, levelFor, levelProgress, DEFAULT_WEIGHTS, DEFAULT_DIFFICULTY } from "../../core/xp";
import { EventType, AgentAction } from "../../core/events";

const ev = (o: object) => ({ ts: "t", source: "claude-code", session_id: "s", ...o }) as any;

test("xpFor maps events to weights; session_start/action_fail = 0", () => {
  expect(xpFor(ev({ type: EventType.Prompt }))).toBe(5);
  expect(xpFor(ev({ type: EventType.TurnEnd }))).toBe(10);
  expect(xpFor(ev({ type: EventType.SessionEnd }))).toBe(20);
  expect(xpFor(ev({ type: EventType.Action, action: AgentAction.Edit }))).toBe(4);
  expect(xpFor(ev({ type: EventType.Action, action: AgentAction.Run }))).toBe(3);
  expect(xpFor(ev({ type: EventType.Action, action: AgentAction.Delegate }))).toBe(8);
  expect(xpFor(ev({ type: EventType.Action, action: AgentAction.Other }))).toBe(1);
  expect(xpFor(ev({ type: EventType.ActionFail, action: AgentAction.Run }))).toBe(0);
  expect(xpFor(ev({ type: EventType.SessionStart }))).toBe(0);
});

test("xpForLevel matches the curve", () => {
  expect(xpForLevel(1)).toBe(0);
  expect(xpForLevel(2)).toBe(7);
  expect(xpForLevel(5)).toBe(Math.round(7 * Math.pow(4, 2.5))); // 224
});

test("levelFor respects boundaries and cap", () => {
  expect(levelFor(0)).toBe(1);
  expect(levelFor(6)).toBe(1);
  expect(levelFor(7)).toBe(2);
  expect(levelFor(10_000_000)).toBe(DEFAULT_DIFFICULTY.level_cap);
});

test("levelProgress splits in-level vs to-next; cap has 0 to-next", () => {
  const p = levelProgress(7); // exactly level 2 start
  expect(p.level).toBe(2);
  expect(p.xp_in_level).toBe(0);
  expect(p.xp_to_next).toBe(xpForLevel(3) - 7);

  const max = levelProgress(99_999_999);
  expect(max.level).toBe(DEFAULT_DIFFICULTY.level_cap);
  expect(max.xp_to_next).toBe(0);
});

test("defaults are present", () => {
  expect(DEFAULT_WEIGHTS.prompt).toBe(5);
  expect(DEFAULT_WEIGHTS.actions.delegate).toBe(8);
  expect(DEFAULT_DIFFICULTY.curve_exp).toBe(2.5);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test test/core/xp.test.ts`
Expected: FAIL — cannot find module `../../core/xp`.

- [ ] **Step 3: Write `core/xp.ts`**

Create `core/xp.ts`:
```ts
import { EventType, AgentAction, type INormalizedEvent } from "./events";

export interface IWeights {
  prompt: number;
  turn_end: number;
  session_end: number;
  actions: Record<AgentAction, number>;
}

export interface IDifficulty {
  curve_k: number;
  curve_exp: number;
  level_cap: number;
}

export const DEFAULT_WEIGHTS: IWeights = {
  prompt: 5,
  turn_end: 10,
  session_end: 20,
  actions: {
    [AgentAction.Edit]: 4,
    [AgentAction.Write]: 4,
    [AgentAction.Run]: 3,
    [AgentAction.Read]: 1,
    [AgentAction.Search]: 1,
    [AgentAction.Delegate]: 8,
    [AgentAction.Other]: 1,
  },
};

export const DEFAULT_DIFFICULTY: IDifficulty = { curve_k: 7, curve_exp: 2.5, level_cap: 50 };

export function xpFor(e: INormalizedEvent, w: IWeights = DEFAULT_WEIGHTS): number {
  switch (e.type) {
    case EventType.Prompt: return w.prompt;
    case EventType.TurnEnd: return w.turn_end;
    case EventType.SessionEnd: return w.session_end;
    case EventType.Action: return w.actions[e.action ?? AgentAction.Other];
    default: return 0; // session_start, action_fail
  }
}

export function xpForLevel(L: number, d: IDifficulty = DEFAULT_DIFFICULTY): number {
  return Math.round(d.curve_k * Math.pow(L - 1, d.curve_exp));
}

export function levelFor(xp: number, d: IDifficulty = DEFAULT_DIFFICULTY): number {
  let level = 1;
  for (let L = 2; L <= d.level_cap; L++) {
    if (xp >= xpForLevel(L, d)) level = L;
    else break;
  }
  return level;
}

export interface IProgress {
  level: number;
  xp_in_level: number;
  xp_to_next: number;
}

export function levelProgress(xp: number, d: IDifficulty = DEFAULT_DIFFICULTY): IProgress {
  const level = levelFor(xp, d);
  if (level >= d.level_cap) {
    return { level, xp_in_level: xp - xpForLevel(level, d), xp_to_next: 0 };
  }
  const floor = xpForLevel(level, d);
  const ceil = xpForLevel(level + 1, d);
  return { level, xp_in_level: xp - floor, xp_to_next: ceil - xp };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test test/core/xp.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add core/xp.ts test/core/xp.test.ts
git commit -m "feat(core): xp weights + level curve"
```

---

## Task 2: `core/journal.ts` — shared reader (refactor `inspect.ts`)

**Files:**
- Create: `core/journal.ts`
- Modify: `tools/inspect.ts` (use the shared reader)
- Modify: `test/tools/inspect.test.ts` (drop the moved import)
- Test: `test/core/journal.test.ts`

- [ ] **Step 1: Write the failing test**

Create `test/core/journal.test.ts`:
```ts
import { test, expect } from "bun:test";
import { loadEvents } from "../../core/journal";
import { makeHome } from "../helpers";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";

test("loadEvents reads all files, skips malformed, counts session files", () => {
  const home = makeHome();
  const dir = join(home, "journal");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "a.ndjson"),
    `{"ts":"t","source":"claude-code","session_id":"a","type":"prompt"}\nbroken\n`);
  writeFileSync(join(dir, "b.ndjson"),
    `{"ts":"t","source":"claude-code","session_id":"b","type":"action","action":"edit"}\n`);
  const { events, sessions } = loadEvents(home);
  expect(events.length).toBe(2);
  expect(sessions).toBe(2);
});

test("loadEvents on a home with no journal returns empty", () => {
  const { events, sessions } = loadEvents(makeHome());
  expect(events).toEqual([]);
  expect(sessions).toBe(0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test test/core/journal.test.ts`
Expected: FAIL — cannot find module `../../core/journal`.

- [ ] **Step 3: Write `core/journal.ts`**

Create `core/journal.ts`:
```ts
import { readdirSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import { isNormalizedEvent, type INormalizedEvent } from "./events";

export function loadEvents(home: string): { events: INormalizedEvent[]; sessions: number } {
  const dir = join(home, "journal");
  if (!existsSync(dir)) return { events: [], sessions: 0 };
  const files = readdirSync(dir).filter((f) => f.endsWith(".ndjson"));
  const events: INormalizedEvent[] = [];
  for (const f of files) {
    for (const line of readFileSync(join(dir, f), "utf8").split("\n")) {
      const t = line.trim();
      if (!t) continue;
      try {
        const o = JSON.parse(t);
        if (isNormalizedEvent(o)) events.push(o);
      } catch {
        // skip malformed lines — the journal must survive partial writes
      }
    }
  }
  return { events, sessions: files.length };
}
```

- [ ] **Step 4: Refactor `tools/inspect.ts` to use it**

In `tools/inspect.ts`, replace the imports + the local `loadEvents` definition. Change the top of the file from:
```ts
import { readdirSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import { isNormalizedEvent, type INormalizedEvent } from "../core/events";

const HOME = process.env.AGENTRPG_HOME || join(process.env.HOME ?? "", ".agentrpg");

export function loadEvents(home: string): { events: INormalizedEvent[]; sessions: number } {
  const dir = join(home, "journal");
  if (!existsSync(dir)) return { events: [], sessions: 0 };
  const files = readdirSync(dir).filter((f) => f.endsWith(".ndjson"));
  const events: INormalizedEvent[] = [];
  for (const f of files) {
    for (const line of readFileSync(join(dir, f), "utf8").split("\n")) {
      const t = line.trim();
      if (!t) continue;
      try {
        const o = JSON.parse(t);
        if (isNormalizedEvent(o)) events.push(o);
      } catch {
        // skip malformed lines — the journal must survive partial writes
      }
    }
  }
  return { events, sessions: files.length };
}
```
to:
```ts
import { join } from "path";
import { type INormalizedEvent } from "../core/events";
import { loadEvents } from "../core/journal";

const HOME = process.env.AGENTRPG_HOME || join(process.env.HOME ?? "", ".agentrpg");
```
Leave the rest of `inspect.ts` (`countBy`, `fmt`, `summarize`, the `import.meta.main` block) unchanged.

- [ ] **Step 5: Update `test/tools/inspect.test.ts` import**

The moved `loadEvents` test now lives in `journal.test.ts`. In `test/tools/inspect.test.ts`, change the first import line from:
```ts
import { summarize, loadEvents } from "../../tools/inspect";
```
to:
```ts
import { summarize } from "../../tools/inspect";
```
Then delete the test named `"loadEvents skips malformed lines and counts sessions by file"` (it is now covered by `journal.test.ts`). Keep the `summarize` and `empty home` tests.

- [ ] **Step 6: Run tests to verify they pass**

Run: `bun test test/core/journal.test.ts test/tools/inspect.test.ts`
Expected: PASS (2 + 2 tests).

- [ ] **Step 7: Commit**

```bash
git add core/journal.ts tools/inspect.ts test/core/journal.test.ts test/tools/inspect.test.ts
git commit -m "refactor(core): extract loadEvents into core/journal, shared with inspect"
```

---

## Task 3: `core/config.ts` + `config/default.json`

**Files:**
- Create: `core/config.ts`
- Modify: `config/default.json`
- Test: `test/core/config.test.ts`

- [ ] **Step 1: Write the failing test**

Create `test/core/config.test.ts`:
```ts
import { test, expect } from "bun:test";
import { loadConfig } from "../../core/config";
import { DEFAULT_WEIGHTS } from "../../core/xp";
import { makeHome } from "../helpers";
import { writeFileSync } from "fs";
import { join } from "path";

test("missing config.json yields defaults", () => {
  const c = loadConfig(makeHome());
  expect(c.weights.prompt).toBe(5);
  expect(c.difficulty.level_cap).toBe(50);
});

test("config.json overrides merge over defaults", () => {
  const home = makeHome();
  writeFileSync(join(home, "config.json"), JSON.stringify({
    xp: { weights: { prompt: 9, actions: { edit: 99 } } },
    difficulty: { level_cap: 60 },
  }));
  const c = loadConfig(home);
  expect(c.weights.prompt).toBe(9);                 // overridden
  expect(c.weights.actions.edit).toBe(99);          // nested override
  expect(c.weights.actions.run).toBe(DEFAULT_WEIGHTS.actions.run); // untouched default kept
  expect(c.difficulty.level_cap).toBe(60);
  expect(c.difficulty.curve_k).toBe(7);             // untouched default kept
});

test("invalid config.json falls back to defaults", () => {
  const home = makeHome();
  writeFileSync(join(home, "config.json"), "not json");
  expect(loadConfig(home).weights.prompt).toBe(5);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test test/core/config.test.ts`
Expected: FAIL — cannot find module `../../core/config`.

- [ ] **Step 3: Write `core/config.ts`**

Create `core/config.ts`:
```ts
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { DEFAULT_WEIGHTS, DEFAULT_DIFFICULTY, type IWeights, type IDifficulty } from "./xp";

export interface IConfig {
  weights: IWeights;
  difficulty: IDifficulty;
}

export function loadConfig(home: string): IConfig {
  const base: IConfig = { weights: DEFAULT_WEIGHTS, difficulty: DEFAULT_DIFFICULTY };
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
    };
  } catch {
    return base;
  }
}
```

- [ ] **Step 4: Update `config/default.json`**

Replace `config/default.json` with:
```json
{
  "home": "~/.agentrpg",
  "source_default": "claude-code",
  "adapters": { "claude-code": { "enabled": true } },
  "xp": {
    "weights": {
      "prompt": 5,
      "turn_end": 10,
      "session_end": 20,
      "actions": { "edit": 4, "write": 4, "run": 3, "read": 1, "search": 1, "delegate": 8, "other": 1 }
    }
  },
  "difficulty": { "curve_k": 7, "curve_exp": 2.5, "level_cap": 50 }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun test test/core/config.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add core/config.ts config/default.json test/core/config.test.ts
git commit -m "feat(core): config loader (merge over defaults) + default xp/difficulty"
```

---

## Task 4: `core/state.ts` + `core/reduce.ts` — pure reduce

**Files:**
- Create: `core/state.ts`
- Create: `core/reduce.ts`
- Test: `test/core/reduce.test.ts`

- [ ] **Step 1: Write the failing test**

Create `test/core/reduce.test.ts`:
```ts
import { test, expect } from "bun:test";
import { reduce } from "../../core/reduce";
import { DEFAULT_WEIGHTS, DEFAULT_DIFFICULTY } from "../../core/xp";

const cfg = { weights: DEFAULT_WEIGHTS, difficulty: DEFAULT_DIFFICULTY };
const ev = (o: object) => ({ ts: "t", source: "claude-code", session_id: "s1", ...o }) as any;

test("reduce sums xp, counts stats, splits by source/repo", () => {
  const events = [
    ev({ session_id: "s1", type: "session_start", repo: "cq" }),
    ev({ session_id: "s1", type: "prompt", repo: "cq" }),                       // +5
    ev({ session_id: "s1", type: "action", action: "edit", repo: "cq" }),       // +4
    ev({ session_id: "s1", type: "action", action: "run", repo: "cq" }),        // +3
    ev({ session_id: "s1", type: "action_fail", action: "run", repo: "cq" }),   // +0
    ev({ session_id: "s2", type: "prompt", repo: "pos" }),                       // +5
    ev({ session_id: "s2", type: "session_end" }),                               // +20, no repo
  ];
  const s = reduce(events, cfg);
  expect(s.xp_total).toBe(37);
  expect(s.stats.prompts).toBe(2);
  expect(s.stats.actions).toEqual({ edit: 1, run: 1 });   // action_fail not counted
  expect(s.stats.sessions).toBe(2);
  expect(s.stats.by_source["claude-code"]).toEqual({ xp: 37, sessions: 2 });
  expect(s.stats.by_repo.cq).toEqual({ xp: 12, sessions: 1 });
  expect(s.stats.by_repo.pos).toEqual({ xp: 5, sessions: 1 }); // session_end (no repo) excluded
  expect(s.level).toBe(2); // 37 >= xpForLevel(2)=7, < xpForLevel(3)=40
  expect(s.version).toBe(1);
});

test("reduce of no events is a clean level-1 zero state", () => {
  const s = reduce([], cfg);
  expect(s.xp_total).toBe(0);
  expect(s.level).toBe(1);
  expect(s.stats.sessions).toBe(0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test test/core/reduce.test.ts`
Expected: FAIL — cannot find module `../../core/reduce`.

- [ ] **Step 3: Write `core/state.ts`**

Create `core/state.ts`:
```ts
export interface IGroupStat {
  xp: number;
  sessions: number;
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
}
```

- [ ] **Step 4: Write `core/reduce.ts` (pure `reduce` only for now)**

Create `core/reduce.ts`:
```ts
import { EventType, type INormalizedEvent } from "./events";
import { xpFor, levelProgress } from "./xp";
import { type IConfig } from "./config";
import { type IState, type IGroupStat } from "./state";

export type TReducedState = Omit<IState, "updated_at">;

export function reduce(events: INormalizedEvent[], config: IConfig): TReducedState {
  let xp_total = 0;
  let prompts = 0;
  const actions: Record<string, number> = {};
  const sessions = new Set<string>();
  const by_source: Record<string, IGroupStat> = {};
  const by_repo: Record<string, IGroupStat> = {};
  const srcSessions: Record<string, Set<string>> = {};
  const repoSessions: Record<string, Set<string>> = {};

  for (const e of events) {
    const w = xpFor(e, config.weights);
    xp_total += w;
    sessions.add(e.session_id);
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
  return {
    version: 1,
    xp_total,
    level: prog.level,
    xp_in_level: prog.xp_in_level,
    xp_to_next: prog.xp_to_next,
    stats: { prompts, actions, sessions: sessions.size, by_source, by_repo },
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun test test/core/reduce.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add core/state.ts core/reduce.ts test/core/reduce.test.ts
git commit -m "feat(core): pure reduce(events) -> state"
```

---

## Task 5: `reduceToFile` + `reduceThrottled`

**Files:**
- Modify: `core/reduce.ts` (append functions)
- Test: `test/core/reduce-file.test.ts`

- [ ] **Step 1: Write the failing test**

Create `test/core/reduce-file.test.ts`:
```ts
import { test, expect } from "bun:test";
import { reduceToFile, reduceThrottled } from "../../core/reduce";
import { makeHome } from "../helpers";
import { mkdirSync, writeFileSync, readFileSync, existsSync, statSync } from "fs";
import { join } from "path";

function seedJournal(home: string) {
  const dir = join(home, "journal");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "s1.ndjson"),
    `{"ts":"t","source":"claude-code","session_id":"s1","type":"prompt","repo":"cq"}\n`);
}

test("reduceToFile writes a valid state.json with updated_at", () => {
  const home = makeHome();
  seedJournal(home);
  const state = reduceToFile(home);
  expect(state.xp_total).toBe(5);
  expect(state.updated_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
  const onDisk = JSON.parse(readFileSync(join(home, "state.json"), "utf8"));
  expect(onDisk.xp_total).toBe(5);
});

test("reduceThrottled skips when state.json is fresh, recomputes when stale", () => {
  const home = makeHome();
  seedJournal(home);
  reduceThrottled(home);                                  // first call writes
  const p = join(home, "state.json");
  expect(existsSync(p)).toBe(true);
  const mtime1 = statSync(p).mtimeMs;

  reduceThrottled(home, 60_000);                          // within window -> skip
  expect(statSync(p).mtimeMs).toBe(mtime1);

  reduceThrottled(home, 0);                               // zero window -> recompute
  expect(statSync(p).mtimeMs).toBeGreaterThanOrEqual(mtime1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test test/core/reduce-file.test.ts`
Expected: FAIL — `reduceToFile`/`reduceThrottled` are not exported.

- [ ] **Step 3: Append to `core/reduce.ts`**

Add these imports to the top of `core/reduce.ts` (merge with the existing import block):
```ts
import { writeFileSync, renameSync, existsSync, statSync } from "fs";
import { join } from "path";
import { loadConfig } from "./config";
import { loadEvents } from "./journal";
```
Append at the end of `core/reduce.ts`:
```ts
function nowStamp(): string {
  return new Date().toISOString().slice(0, 19) + "Z";
}

export function reduceToFile(home: string): IState {
  const { events } = loadEvents(home);
  const reduced = reduce(events, loadConfig(home));
  const state: IState = { ...reduced, updated_at: nowStamp() };
  const dst = join(home, "state.json");
  const tmp = dst + ".tmp";
  writeFileSync(tmp, JSON.stringify(state, null, 2));
  renameSync(tmp, dst); // atomic: statusline never reads a half-written file
  return state;
}

export function reduceThrottled(home: string, maxAgeMs = 2000): void {
  const p = join(home, "state.json");
  if (existsSync(p) && Date.now() - statSync(p).mtimeMs < maxAgeMs) return;
  reduceToFile(home);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test test/core/reduce-file.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add core/reduce.ts test/core/reduce-file.test.ts
git commit -m "feat(core): reduceToFile (atomic) + reduceThrottled"
```

---

## Task 6: `renderHud` (pure)

**Files:**
- Create: `hud/statusline.ts` (renderHud + types; main added in Task 7)
- Test: `test/hud/statusline.test.ts`

- [ ] **Step 1: Write the failing test**

Create `test/hud/statusline.test.ts`:
```ts
import { test, expect } from "bun:test";
import { renderHud, type ITail } from "../../hud/statusline";
import type { IState } from "../../core/state";

const state = (o: Partial<IState>): IState => ({
  version: 1, updated_at: "", xp_total: 0, level: 1, xp_in_level: 0, xp_to_next: 7,
  stats: { prompts: 0, actions: {}, sessions: 0, by_source: {}, by_repo: {} }, ...o,
});

test("renders level, bar, percent, model, cost, ctx", () => {
  const s = state({ level: 5, xp_in_level: 200, xp_to_next: 300 }); // pct 0.4
  const tail: ITail = { model: "Opus 4.8", cost: 0.42, ctx: 8 };
  expect(renderHud(s, tail)).toBe("Lv.5 ████░░░░░░ 40%  |  Opus 4.8  $0.42  ·  ctx 8%");
});

test("null cost -> $0.00, null ctx -> ctx 0%, null model -> ?", () => {
  const s = state({ level: 1, xp_in_level: 0, xp_to_next: 7 });
  expect(renderHud(s, { model: null, cost: null, ctx: null })).toBe(
    "Lv.1 ░░░░░░░░░░ 0%  |  ?  $0.00  ·  ctx 0%");
});

test("non-integer ctx is rounded", () => {
  const s = state({ level: 1, xp_in_level: 0, xp_to_next: 7 });
  expect(renderHud(s, { model: "M", cost: 1, ctx: 23.5 })).toContain("ctx 24%");
});

test("max level shows full bar + MAX at 100%", () => {
  const s = state({ level: 50, xp_in_level: 1000, xp_to_next: 0 });
  expect(renderHud(s, { model: "M", cost: 0, ctx: 0 })).toBe(
    "Lv.50 ██████████ MAX 100%  |  M  $0.00  ·  ctx 0%");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test test/hud/statusline.test.ts`
Expected: FAIL — cannot find module `../../hud/statusline`.

- [ ] **Step 3: Write `hud/statusline.ts` (renderHud only)**

Create `hud/statusline.ts`:
```ts
import type { IState } from "../core/state";

export interface ITail {
  model: string | null;
  cost: number | null;
  ctx: number | null;
}

export function renderHud(state: IState, tail: ITail): string {
  const pct = state.xp_to_next === 0 ? 1 : state.xp_in_level / (state.xp_in_level + state.xp_to_next);
  const filled = Math.round(pct * 10);
  const bar = "█".repeat(filled) + "░".repeat(10 - filled);
  const maxed = state.xp_to_next === 0 ? " MAX" : "";
  const model = tail.model || "?";
  const cost = tail.cost == null ? "0.00" : tail.cost.toFixed(2);
  const ctx = tail.ctx == null ? 0 : Math.round(tail.ctx);
  return `Lv.${state.level} ${bar}${maxed} ${Math.round(pct * 100)}%  |  ${model}  $${cost}  ·  ctx ${ctx}%`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test test/hud/statusline.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add hud/statusline.ts test/hud/statusline.test.ts
git commit -m "feat(hud): renderHud pure formatter"
```

---

## Task 7: statusline `main` + integration

**Files:**
- Modify: `hud/statusline.ts` (add stdin → throttle → state → print)
- Test: `test/hud/statusline-integration.test.ts`

- [ ] **Step 1: Write the failing integration test**

Create `test/hud/statusline-integration.test.ts`:
```ts
import { test, expect } from "bun:test";
import { makeHome } from "../helpers";
import { writeFileSync } from "fs";
import { join } from "path";

const SCRIPT = new URL("../../hud/statusline.ts", import.meta.url).pathname;

test("statusline prints a HUD line from a seeded state, exit 0", async () => {
  const home = makeHome();
  // seed a fresh state.json so the throttle skips re-reduce and uses this state
  writeFileSync(join(home, "state.json"), JSON.stringify({
    version: 1, updated_at: "t", xp_total: 224, level: 5, xp_in_level: 0, xp_to_next: 167,
    stats: { prompts: 0, actions: {}, sessions: 0, by_source: {}, by_repo: {} },
  }));
  const stdin = JSON.stringify({
    model: { display_name: "Opus 4.8" },
    cost: { total_cost_usd: 0.42 },
    context_window: { used_percentage: 8 },
  });
  const proc = Bun.spawn(["bun", SCRIPT], {
    stdin: Buffer.from(stdin),
    env: { ...process.env, AGENTRPG_HOME: home },
    stdout: "pipe", stderr: "pipe",
  });
  const out = await new Response(proc.stdout).text();
  expect(await proc.exited).toBe(0);
  expect(out).toContain("Lv.5");
  expect(out).toContain("Opus 4.8");
  expect(out).toContain("$0.42");
  expect(out).toContain("ctx 8%");
});

test("statusline never throws on empty stdin / empty home", async () => {
  const home = makeHome();
  const proc = Bun.spawn(["bun", SCRIPT], {
    stdin: Buffer.from(""),
    env: { ...process.env, AGENTRPG_HOME: home },
    stdout: "pipe", stderr: "pipe",
  });
  const out = await new Response(proc.stdout).text();
  expect(await proc.exited).toBe(0);
  expect(out).toContain("Lv.1");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test test/hud/statusline-integration.test.ts`
Expected: FAIL — the script has no `main`, prints nothing.

- [ ] **Step 3: Append `main` to `hud/statusline.ts`**

Add these imports at the top of `hud/statusline.ts` (merge with the existing import):
```ts
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { reduceThrottled } from "../core/reduce";
import { levelProgress, DEFAULT_DIFFICULTY } from "../core/xp";
```
Append at the end of `hud/statusline.ts`:
```ts
const HOME = process.env.AGENTRPG_HOME || join(process.env.HOME ?? "", ".agentrpg");

function readState(home: string): IState {
  const p = join(home, "state.json");
  if (existsSync(p)) {
    try {
      return JSON.parse(readFileSync(p, "utf8")) as IState;
    } catch {
      // fall through to the zero state
    }
  }
  const prog = levelProgress(0, DEFAULT_DIFFICULTY);
  return {
    version: 1, updated_at: "", xp_total: 0,
    level: prog.level, xp_in_level: prog.xp_in_level, xp_to_next: prog.xp_to_next,
    stats: { prompts: 0, actions: {}, sessions: 0, by_source: {}, by_repo: {} },
  };
}

async function main(): Promise<void> {
  let raw = "";
  try {
    raw = await new Response(Bun.stdin.stream()).text();
  } catch {
    // no stdin
  }
  let tail: ITail = { model: null, cost: null, ctx: null };
  try {
    const j = JSON.parse(raw);
    tail = {
      model: j?.model?.display_name ?? null,
      cost: j?.cost?.total_cost_usd ?? null,
      ctx: j?.context_window?.used_percentage ?? null,
    };
  } catch {
    // keep nulls
  }
  try {
    reduceThrottled(HOME);
  } catch {
    // statusline must never break the prompt
  }
  process.stdout.write(renderHud(readState(HOME), tail));
}

if (import.meta.main) {
  main().catch(() => process.stdout.write("Lv.1 ░░░░░░░░░░ 0%  |  ?  $0.00  ·  ctx 0%"));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test test/hud/statusline-integration.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add hud/statusline.ts test/hud/statusline-integration.test.ts
git commit -m "feat(hud): statusline main (stdin -> throttle -> render)"
```

---

## Task 8: install + settings snippet

**Files:**
- Modify: `adapters/claude-code/settings.snippet.json` (add `statusLine`)
- Modify: `tools/install.sh` (deploy `hud`)
- Test: `test/adapters/settings.test.ts` (append), `test/tools/install.test.ts` (append)

- [ ] **Step 1: Write the failing tests**

Append to `test/adapters/settings.test.ts`:
```ts
test("declares a statusLine pointing at the deployed statusline.ts", () => {
  expect(snippet.statusLine.type).toBe("command");
  expect(snippet.statusLine.command).toBe("bun ~/.agentrpg/hud/statusline.ts");
});
```

Append to `test/tools/install.test.ts`:
```ts
test("--link deploys hud/", async () => {
  const home = makeHome();
  await runInstall(home, ["--link"]);
  expect(existsSync(join(home, "hud/statusline.ts"))).toBe(true);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test test/adapters/settings.test.ts test/tools/install.test.ts`
Expected: FAIL — no `statusLine` key; `hud/` not deployed.

- [ ] **Step 3: Add `statusLine` to `settings.snippet.json`**

In `adapters/claude-code/settings.snippet.json`, add a top-level `statusLine` sibling to `hooks`. The file becomes:
```json
{
  "hooks": {
    "SessionStart":       [ { "hooks": [ { "type": "command", "command": "~/.agentrpg/adapters/claude-code/hooks/on-session-start.sh" } ] } ],
    "UserPromptSubmit":   [ { "hooks": [ { "type": "command", "command": "~/.agentrpg/adapters/claude-code/hooks/on-prompt.sh" } ] } ],
    "PostToolUse":        [ { "matcher": "Edit|MultiEdit|Write|Bash|Read|Grep|Glob|Task", "hooks": [ { "type": "command", "command": "~/.agentrpg/adapters/claude-code/hooks/on-tool.sh" } ] } ],
    "PostToolUseFailure": [ { "hooks": [ { "type": "command", "command": "~/.agentrpg/adapters/claude-code/hooks/on-tool.sh" } ] } ],
    "Stop":               [ { "hooks": [ { "type": "command", "command": "~/.agentrpg/adapters/claude-code/hooks/on-stop.sh" } ] } ],
    "SessionEnd":         [ { "hooks": [ { "type": "command", "command": "~/.agentrpg/adapters/claude-code/hooks/on-session-end.sh" } ] } ]
  },
  "statusLine": { "type": "command", "command": "bun ~/.agentrpg/hud/statusline.ts", "padding": 0 }
}
```

- [ ] **Step 4: Add `hud` to the `install.sh` deploy list**

In `tools/install.sh`, change the deploy block from:
```bash
deploy adapters
deploy tools
deploy core
```
to:
```bash
deploy adapters
deploy tools
deploy core
deploy hud
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `bun test test/adapters/settings.test.ts test/tools/install.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add adapters/claude-code/settings.snippet.json tools/install.sh test/adapters/settings.test.ts test/tools/install.test.ts
git commit -m "feat: deploy hud + statusLine snippet"
```

---

## Task 9: full suite + tsc + docs

**Files:**
- Modify: `README.md` (statusline verify note)
- Test: `test/integration/reduce-render.test.ts`

- [ ] **Step 1: Write an end-to-end reduce→render test**

Create `test/integration/reduce-render.test.ts`:
```ts
import { test, expect } from "bun:test";
import { reduceToFile } from "../../core/reduce";
import { renderHud } from "../../hud/statusline";
import { makeHome } from "../helpers";
import { mkdirSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";

test("journal -> reduceToFile -> renderHud produces a coherent line", () => {
  const home = makeHome();
  const dir = join(home, "journal");
  mkdirSync(dir, { recursive: true });
  // 5 prompts (25) + 4 edits (16) = 41 xp -> level 3 (>=40)
  const lines = [
    ...Array(5).fill(`{"ts":"t","source":"claude-code","session_id":"s","type":"prompt","repo":"cq"}`),
    ...Array(4).fill(`{"ts":"t","source":"claude-code","session_id":"s","type":"action","action":"edit","repo":"cq"}`),
  ];
  writeFileSync(join(dir, "s.ndjson"), lines.join("\n") + "\n");

  const state = reduceToFile(home);
  expect(state.xp_total).toBe(41);
  expect(state.level).toBe(3);

  const onDisk = JSON.parse(readFileSync(join(home, "state.json"), "utf8"));
  const line = renderHud(onDisk, { model: "Opus 4.8", cost: 0.1, ctx: 12 });
  expect(line).toContain("Lv.3");
  expect(line).toContain("ctx 12%");
});
```

- [ ] **Step 2: Run the full suite**

Run: `bun test`
Expected: all PASS (Phase 0 + Phase 1 files).

- [ ] **Step 3: Type-check**

Run: `bunx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Add a statusline note to `README.md`**

In `README.md`, under the `## Verify` section, after the existing `inspect.ts` block, add:
```markdown

After merging the `statusLine` from the snippet into `~/.claude/settings.json`, the bottom
of Claude Code shows `Lv.N ███░░ %  |  model  $cost  ·  ctx %`, updating as you work.
```

- [ ] **Step 5: Commit**

```bash
git add test/integration/reduce-render.test.ts README.md
git commit -m "test: reduce->render integration; document statusline"
```

---

## Task 10: Wire statusLine into settings.json + real-session verify (manual)

This covers the DoD item fixtures can't: a live statusline.

- [ ] **Step 1: Deploy**

Run `tools/install.sh --link` (deploys `hud/` and reprints the snippet). `~/.agentrpg/hud/statusline.ts` now resolves through the symlink.

- [ ] **Step 2: Merge the `statusLine` key into `~/.claude/settings.json`**

Back up first, then set the `statusLine` key (the hooks block is already merged from Phase 0):
```bash
SET="$HOME/.claude/settings.json"; cp "$SET" "$SET.bak.$(date +%Y%m%d-%H%M%S)"
TMP="$(mktemp)"
jq --slurpfile snip "$HOME/.agentrpg/adapters/claude-code/settings.snippet.json" \
   '.statusLine = $snip[0].statusLine' "$SET" > "$TMP" && mv "$TMP" "$SET"
jq -e '.statusLine.command' "$SET"   # prints the command if set
```
If a `statusLine` already existed, it is replaced; the prior value is in the `.bak`.

- [ ] **Step 3: Real session**

Open a NEW Claude Code session (settings load at startup). Confirm the bottom shows
`Lv.N … %  |  model  $cost  ·  ctx %`, and that the level/XP rises as you prompt and edit.

- [ ] **Step 4: Confirm state updates**

Run: `bun ~/.agentrpg/tools/inspect.ts` and `cat ~/.agentrpg/state.json` — `xp_total`/`level`
should reflect the session; `updated_at` recent.

- [ ] **Step 5: Finish the branch**

Use the superpowers:finishing-a-development-branch skill to PR/merge `feat/phase1-reducer`.

---

## Self-Review notes (already applied)

- **Spec coverage:** XP weights+curve §3 (Task 1); reduce/stats/by_source/by_repo §4,§6 (Task 4); config tunable §3,§8 (Task 3); throttle+atomic reduceToFile §6 (Task 5); shared journal reader §5 (Task 2); renderHud format incl. ctx + null/max §7 (Task 6); statusline main + stdin fields P4 §7 (Task 7); install/statusLine §8 (Task 8); DoD §10 (Tasks 9–10); out-of-scope respected (no class/loot/streak).
- **No placeholders:** every code step is complete and runnable.
- **Type/name consistency:** `IWeights`/`IDifficulty`/`IConfig`/`IState`/`IGroupStat`/`ITail`/`TReducedState`, `xpFor`/`xpForLevel`/`levelFor`/`levelProgress`, `reduce`/`reduceToFile`/`reduceThrottled`, `loadEvents`/`loadConfig`, `renderHud` — consistent across tasks and the spec. `actions` weights keyed by `AgentAction`; `by_repo` skips repo-less events.
