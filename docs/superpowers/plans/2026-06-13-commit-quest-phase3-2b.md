# Commit Quest Phase 3.2b Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rate-based boss encounters that drop loot — a seeded, idempotent reducer mechanic — and the app animates each encounter (defeated + loot / fled).

**Architecture:** The reducer rolls a seeded boss per `action` event (`boss_rate`), then a flee roll (`boss_flee_rate`); a slain boss adds a `boss`-table drop to inventory, and `stats.boss_defeated`/`boss_fled` counts make every outcome visible. The app diffs consecutive states (`diffStates`, pure) → transient boss-encounter animations.

**Tech Stack:** Bun + TS (core + tests), React + Vite (app). `core` stays jq+bun, dep-free.

**Reference:** Spec `docs/superpowers/specs/2026-06-13-commit-quest-phase3-2b-design.md`. Conventions `CLAUDE.md` + `app/CLAUDE.md`. End commit bodies with `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. Run `bun run format` before committing. Branch: already on `feat/phase3.2b-boss-loot`; spec committed.

---

## File Structure

| File | Change |
|---|---|
| `core/loot.ts` | `DROP_TABLES.boss` + `DEFAULT_BOSS_RATE`/`DEFAULT_BOSS_FLEE_RATE` |
| `core/config.ts` + `config/default.json` | `boss_rate?` / `boss_flee_rate?` |
| `core/state.ts` | `stats.boss_defeated?` / `boss_fled?` |
| `core/reduce.ts` | per-action seeded spawn→flee→loot roll; counts; boss triggers |
| `app/src/game-events.ts` | `GameEventType` + `diffStates` (pure) |
| `app/src/use-encounter.ts` | prev-ref diff → encounter queue + min-duration timer |
| `app/src/components/{boss-encounter,loot-toast}.tsx` | encounter + drop visuals (skeleton) |
| `app/src/components/scene-view.tsx` | mount the encounter layer |
| `app/src/styles.css` | boss + flee + loot-drop animations |

---

## Task 1: boss drop table + config rates

**Files:** Modify `core/loot.ts`, `core/config.ts`, `config/default.json`; Test `test/core/loot.test.ts`, `test/core/config.test.ts` (append)

- [ ] **Step 1: Write the failing tests**

Append to `test/core/loot.test.ts`:
```ts
import { DROP_TABLES, DEFAULT_BOSS_RATE, DEFAULT_BOSS_FLEE_RATE } from "../../core/loot";

test("the boss drop table exists and rolls a valid item", () => {
  expect(DROP_TABLES.boss).toBeDefined();
  const id = rollDrop({ table: "boss", seed: "b1" });
  expect(id).not.toBe(null);
  expect(LOOT_TABLE[id!]).toBeDefined();
});

test("boss rate defaults are sane fractions", () => {
  expect(DEFAULT_BOSS_RATE).toBeGreaterThan(0);
  expect(DEFAULT_BOSS_RATE).toBeLessThan(1);
  expect(DEFAULT_BOSS_FLEE_RATE).toBeGreaterThan(0);
  expect(DEFAULT_BOSS_FLEE_RATE).toBeLessThan(1);
});
```

Append to `test/core/config.test.ts`:
```ts
test("boss rates default and can be overridden", () => {
  const c = loadConfig(makeHome());
  expect(c.boss_rate).toBe(0.02);
  expect(c.boss_flee_rate).toBe(0.2);

  const home = makeHome();
  writeFileSync(join(home, "config.json"), JSON.stringify({ boss_rate: 0.5 }));
  const o = loadConfig(home);
  expect(o.boss_rate).toBe(0.5);
  expect(o.boss_flee_rate).toBe(0.2); // default kept
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun test test/core/loot.test.ts test/core/config.test.ts`
Expected: FAIL — `DROP_TABLES.boss` / `DEFAULT_BOSS_RATE` / `c.boss_rate` undefined.

- [ ] **Step 3: Add the boss table + constants to `core/loot.ts`**

Add a `boss` entry to `DROP_TABLES` (richer than `clean`):
```ts
  boss: [
    { rarity: Rarity.Common, weight: 0.4 },
    { rarity: Rarity.Rare, weight: 0.35 },
    { rarity: Rarity.Epic, weight: 0.2 },
    { rarity: Rarity.Legendary, weight: 0.05 },
  ],
```
Add the rate defaults (after `DROP_TABLES`):
```ts
export const DEFAULT_BOSS_RATE = 0.02;
export const DEFAULT_BOSS_FLEE_RATE = 0.2;
```

- [ ] **Step 4: Plumb rates through `core/config.ts`**

Add to the `./loot` import: `DEFAULT_BOSS_RATE`, `DEFAULT_BOSS_FLEE_RATE`.
Add to `IConfig` (after `drops?`):
```ts
  boss_rate?: number;
  boss_flee_rate?: number;
```
Add to the `base` object:
```ts
    boss_rate: DEFAULT_BOSS_RATE,
    boss_flee_rate: DEFAULT_BOSS_FLEE_RATE,
```
Add to the merged return object (after `drops`):
```ts
      boss_rate: raw?.boss_rate ?? DEFAULT_BOSS_RATE,
      boss_flee_rate: raw?.boss_flee_rate ?? DEFAULT_BOSS_FLEE_RATE,
```

- [ ] **Step 5: Document in `config/default.json`**

Add after the `passive` line (add a comma after `passive`):
```json
  "passive": { "1": 0.2, "2": 0.3, "3": 0.4, "4": 0.5 },
  "boss_rate": 0.02,
  "boss_flee_rate": 0.2
```

- [ ] **Step 6: Run to verify it passes**

Run: `bun test test/core/loot.test.ts test/core/config.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**
```bash
bun run format
git add core/loot.ts core/config.ts config/default.json test/core/loot.test.ts test/core/config.test.ts
git commit -m "feat(core): boss drop table + tunable boss_rate/boss_flee_rate"
```

---

## Task 2: reducer rolls bosses; state carries the counts

**Files:** Modify `core/state.ts`, `core/reduce.ts`; Test `test/core/reduce.test.ts` (append)

- [ ] **Step 1: Add the counts to `core/state.ts`**

In `IState.stats`, add (after `cmds?`):
```ts
    boss_defeated?: number;
    boss_fled?: number;
```

- [ ] **Step 2: Write the failing test**

Append to `test/core/reduce.test.ts`:
```ts
test("bosses are rate-based, seeded, and idempotent", () => {
  const home = makeHome();
  const acts = Array.from(
    { length: 20 },
    () =>
      ({
        ts: "2026-06-11T12:00:00Z",
        source: "claude-code",
        session_id: "s",
        type: "action",
        action: "read",
        repo: "cq",
      }) as any,
  );

  const none = reduce(acts, { ...loadConfig(home), boss_rate: 0 }, "2026-06-11");
  expect(none.stats.boss_defeated).toBe(0);
  expect(none.stats.boss_fled).toBe(0);

  const won = reduce(
    acts,
    { ...loadConfig(home), boss_rate: 1, boss_flee_rate: 0 },
    "2026-06-11",
  );
  expect(won.stats.boss_defeated).toBe(20);
  expect(won.stats.boss_fled).toBe(0);
  expect((won.inventory ?? []).length).toBeGreaterThan(0);

  const fled = reduce(
    acts,
    { ...loadConfig(home), boss_rate: 1, boss_flee_rate: 1 },
    "2026-06-11",
  );
  expect(fled.stats.boss_fled).toBe(20);
  expect(fled.stats.boss_defeated).toBe(0);

  // idempotent
  expect(
    reduce(acts, { ...loadConfig(home), boss_rate: 1, boss_flee_rate: 0 }, "2026-06-11"),
  ).toEqual(won);
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `bun test test/core/reduce.test.ts`
Expected: FAIL — `boss_defeated` undefined.

- [ ] **Step 4: Roll bosses in `core/reduce.ts`**

Add `seededRng` to the imports:
```ts
import { seededRng } from "./rng";
```
Add `DEFAULT_BOSS_RATE`, `DEFAULT_BOSS_FLEE_RATE` to the existing `./loot` import.

Add the accumulators with the other `let`s (after `const cmds: Record<string, number> = {};`):
```ts
  let bossOrdinal = 0;
  let bossDefeated = 0;
  let bossFled = 0;
  const bossTriggers: ITrigger[] = [];
  const bossRate = config.boss_rate ?? DEFAULT_BOSS_RATE;
  const bossFleeRate = config.boss_flee_rate ?? DEFAULT_BOSS_FLEE_RATE;
```

In the fold loop, after the `if (e.cmd) { ... }` block, add the boss roll:
```ts
    if (e.type === EventType.Action) {
      bossOrdinal++;
      if (seededRng(`boss:${bossOrdinal}`)() < bossRate) {
        if (seededRng(`bossflee:${bossOrdinal}`)() < bossFleeRate) {
          bossFled++;
        } else {
          bossDefeated++;
          bossTriggers.push({ table: "boss", seed: `bossloot:${bossOrdinal}` });
        }
      }
    }
```

Add the boss triggers to the trigger list — just before the `const inventory = rollInventory(...)` line:
```ts
  triggers.push(...bossTriggers);
  const inventory = rollInventory(triggers, lootTable, config.drops ?? DROP_TABLES);
```

Add the counts to `prelim.stats` (after `cmds,`):
```ts
      boss_defeated: bossDefeated,
      boss_fled: bossFled,
```

- [ ] **Step 5: Run the NEW test, then the FULL suite**

Run: `bun test test/core/reduce.test.ts` → the new boss test PASSES.
Then run: `bun test`.
**Expected regression:** `boss_rate` now defaults to `0.02`, so any pre-existing test that has
`action` events **and asserts an exact inventory / full-state `toEqual`** may fail because a seeded
boss roll added a drop. Likely candidates: `test/core/loot.test.ts` ("a clean session drops loot" →
expects `length` 1; "cosmetics resolve only when owned" → expects `[]`) and any integration test
asserting an exact inventory.

- [ ] **Step 6: Isolate the affected tests with `boss_rate: 0`**

For each test that broke **and is not about bosses**, pin the boss roll off in that test's config so it
keeps testing its own thing. Example (loot.test):
```ts
// before
expect(reduce(clean, zeroCfg, "2026-06-11").inventory?.length).toBe(1);
// after — isolate from the random boss mechanic
expect(reduce(clean, { ...zeroCfg, boss_rate: 0 }, "2026-06-11").inventory?.length).toBe(1);
```
Apply the same `{ ...cfg, boss_rate: 0 }` to every broken exact-inventory / `toEqual(state)` assertion
(loot.test cases, any integration test). Re-run `bun test` until green. (Tests that assert *xp/level/
counts only* are unaffected — bosses add loot, not xp.)

- [ ] **Step 7: Commit**
```bash
bun run format
git add core/state.ts core/reduce.ts test/core/reduce.test.ts test/core/loot.test.ts test/integration
git commit -m "feat(core): seeded per-action boss encounters drop loot (boss_defeated/fled)"
```

---

## Task 3: `app/src/game-events.ts` — diff state into encounters

**Files:** Create `app/src/game-events.ts`, `app/src/game-events.test.ts`

- [ ] **Step 1: Write the failing test**

Create `app/src/game-events.test.ts`:
```ts
import { test, expect } from "bun:test";
import { diffStates, GameEventType } from "./game-events";

const st = (defeated: number, fled: number, inv: { id: string; rarity: string; count: number }[]) =>
  ({
    version: 1,
    xp_total: 0,
    level: 1,
    xp_in_level: 0,
    xp_to_next: 7,
    stats: {
      prompts: 0,
      actions: {},
      sessions: 0,
      by_source: {},
      by_repo: {},
      boss_defeated: defeated,
      boss_fled: fled,
    },
    inventory: inv,
  }) as any;

test("diffStates emits boss outcomes with the loot delta", () => {
  const prev = st(0, 0, []);
  const won = st(1, 0, [{ id: "neon_theme", rarity: "rare", count: 1 }]);
  expect(diffStates(prev, won)).toEqual([
    { type: GameEventType.BossDefeated, items: ["neon_theme"] },
  ]);

  const fled = st(0, 1, []);
  expect(diffStates(prev, fled)).toEqual([{ type: GameEventType.BossFled, items: [] }]);

  expect(diffStates(prev, prev)).toEqual([]);
  expect(diffStates(null, won)).toEqual([]); // no animation on first load
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun test app/src/game-events.test.ts`
Expected: FAIL — `game-events` module not found.

- [ ] **Step 3: Create `app/src/game-events.ts`**
```ts
import type { IState } from "../../core/state";

export enum GameEventType {
  BossDefeated = "boss_defeated",
  BossFled = "boss_fled",
}

export interface IGameEvent {
  type: GameEventType;
  items: string[];
}

// ids gained in `next.inventory` vs `prev` (counts the per-item increase).
function newItems(prev: IState | null, next: IState): string[] {
  const before = new Map((prev?.inventory ?? []).map(i => [i.id, i.count]));
  const out: string[] = [];
  for (const item of next.inventory ?? []) {
    const had = before.get(item.id) ?? 0;
    for (let k = 0; k < item.count - had; k++) {
      out.push(item.id);
    }
  }
  return out;
}

export function diffStates(prev: IState | null, next: IState): IGameEvent[] {
  if (!prev) {
    return [];
  }
  const events: IGameEvent[] = [];
  const defeated = (next.stats.boss_defeated ?? 0) - (prev.stats.boss_defeated ?? 0);
  const fled = (next.stats.boss_fled ?? 0) - (prev.stats.boss_fled ?? 0);
  if (defeated > 0) {
    events.push({ type: GameEventType.BossDefeated, items: newItems(prev, next) });
  }
  if (fled > 0) {
    events.push({ type: GameEventType.BossFled, items: [] });
  }
  return events;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `bun test app/src/game-events.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
bun run format
git add app/src/game-events.ts app/src/game-events.test.ts
git commit -m "feat(app): diffStates — state delta into boss encounter events"
```

---

## Task 4: the encounter visual (hook + components + CSS)

**Files:** Create `app/src/use-encounter.ts`, `app/src/components/{boss-encounter,loot-toast}.tsx`; Modify `app/src/components/scene-view.tsx`, `app/src/styles.css`

> Presentational + a timer hook — verified by build + visually (the diff is covered in Task 3).

- [ ] **Step 1: Create the hook `app/src/use-encounter.ts`**
```ts
import { useEffect, useRef, useState } from "react";
import type { IState } from "../../core/state";
import { diffStates, type IGameEvent } from "./game-events";

const ENCOUNTER_MS = 4500; // min on-screen battle so a real drop never flashes

// Diffs each new state into encounter events and plays them one at a time.
export function useEncounter(state: IState | null): IGameEvent | null {
  const prevRef = useRef<IState | null>(null);
  const [queue, setQueue] = useState<IGameEvent[]>([]);
  const [current, setCurrent] = useState<IGameEvent | null>(null);

  useEffect(() => {
    if (!state) {
      return;
    }
    const events = diffStates(prevRef.current, state);
    prevRef.current = state;
    if (events.length > 0) {
      setQueue(q => [...q, ...events]);
    }
  }, [state]);

  useEffect(() => {
    if (current || queue.length === 0) {
      return;
    }
    const [next, ...rest] = queue;
    setQueue(rest);
    setCurrent(next);
    const id = setTimeout(() => setCurrent(null), ENCOUNTER_MS);
    return () => clearTimeout(id);
  }, [current, queue]);

  return current;
}
```

- [ ] **Step 2: Create `app/src/components/loot-toast.tsx`**
```tsx
interface IProps {
  items: string[];
}

const LootToast = (props: IProps) => {
  const { items } = props;
  if (items.length === 0) {
    return null;
  }
  return (
    <div className="loot-toast">
      {items.map((id, i) => (
        <span key={i} className="loot-item">
          🎁 {id}
        </span>
      ))}
    </div>
  );
};

export default LootToast;
```

- [ ] **Step 3: Create `app/src/components/boss-encounter.tsx`**
```tsx
import { GameEventType, type IGameEvent } from "../game-events";
import LootToast from "./loot-toast";

interface IProps {
  encounter: IGameEvent;
}

const BossEncounter = (props: IProps) => {
  const { encounter } = props;
  const outcome = encounter.type === GameEventType.BossFled ? "fled" : "defeated";

  return (
    <div className={`boss-encounter boss-${outcome}`}>
      <div className="sprite boss" aria-label="boss" />
      {encounter.type === GameEventType.BossDefeated && <LootToast items={encounter.items} />}
    </div>
  );
};

export default BossEncounter;
```

- [ ] **Step 4: Mount the encounter layer in `app/src/components/scene-view.tsx`**

Add the imports:
```ts
import { useEncounter } from "../use-encounter";
import BossEncounter from "./boss-encounter";
```
Add the hook at the top of the component body (after `const { state, activity } = props;`):
```ts
  const encounter = useEncounter(state);
```
Render it inside the `.scene` div, after `<Hero … />`:
```tsx
      {encounter && <BossEncounter encounter={encounter} />}
```

- [ ] **Step 5: Append the encounter styles to `app/src/styles.css`**
```css

/* ── Phase 3.2b: boss encounter (CSS art surface — swap for realm boss sprites §7) ── */
.boss-encounter {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  pointer-events: none;
}
.boss-encounter .boss {
  position: static;
  width: 96px;
  height: 96px;
  font-size: 64px;
}
.boss-encounter .boss::after {
  content: "🐉";
}
.boss-defeated .boss {
  animation: boss-hit 0.5s steps(2) 8;
}
.boss-fled .boss {
  animation: boss-flee 1s ease-in forwards;
}
@keyframes boss-hit {
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(5px);
  }
}
@keyframes boss-flee {
  to {
    transform: translateX(120px);
    opacity: 0;
  }
}
.loot-toast {
  position: absolute;
  bottom: 56px;
  display: flex;
  gap: 8px;
  animation: toast-rise 0.6s ease-out;
}
.loot-item {
  background: #1d212bdd;
  border: 1px solid #b08a3e;
  border-radius: 6px;
  padding: 4px 9px;
  font-size: 0.85rem;
  color: #e8c873;
}
@keyframes toast-rise {
  from {
    transform: translateY(12px);
    opacity: 0;
  }
}
```

- [ ] **Step 6: Typecheck + build**

Run: `cd app && bun run typecheck && bun run build`
Expected: clean; `app/dist/` rebuilt.

- [ ] **Step 7: Commit**
```bash
cd /Users/calypso/Project/Ottery/commit-quest
bun run format
git add app/src/use-encounter.ts app/src/components/boss-encounter.tsx app/src/components/loot-toast.tsx app/src/components/scene-view.tsx app/src/styles.css
git commit -m "feat(app): boss encounter + loot-drop animation (state-diff driven)"
```

---

## Task 5: verify — tests, types, build, live run

- [ ] **Step 1: Logic tests + root typecheck + format**

Run: `bun test && bunx tsc --noEmit && bun run format:check`
Expected: all pass; root tsc clean; formatting clean.

- [ ] **Step 2: App typecheck + build**

Run: `cd app && bun run typecheck && bun run build`
Expected: clean; `app/dist/` produced.

- [ ] **Step 3: Live run with a high boss rate (so encounters are visible quickly)**

Temporarily set a high rate: `echo '{"boss_rate":0.5}' > ~/.agentrpg/config.json`, then run the bridge:
`cd app && AGENTRPG_HOME="$HOME/.agentrpg" AGENTRPG_PORT=7077 bun server.ts` and open
`http://localhost:7077` in Simple Browser.
Expected: as you work (new `action` events), bosses 🐉 appear, battle ~4.5 s, then drop a loot toast or
flee. Restore the config afterward: `rm ~/.agentrpg/config.json` (or set `boss_rate` back).

- [ ] **Step 4: Commit any formatting fixes** (if Step 1 changed files)
```bash
bun run format
git add -A app
git commit -m "chore(app): formatting" --allow-empty
```

---

## Task 6: finish

- [ ] **Step 1: Update the project structure doc**

In `docs/reference/project-structure.md`, add `game-events.ts` + `use-encounter.ts` and
`components/{boss-encounter,loot-toast}.tsx` to the `app/src/` listing (the boss encounter layer).

- [ ] **Step 2: Commit**
```bash
git add docs/reference/project-structure.md
git commit -m "docs: app/ boss encounter files in the project structure"
```

- [ ] **Step 3: Finish the branch** — superpowers:finishing-a-development-branch (grouping commit +
push + PR, "Part of Phase 3"). Note: boss loot is a seeded reducer mechanic (idempotent); the app is a
state-diff visual; `boss_rate`/`boss_flee_rate`/`drops.boss` are config-tunable.

---

## Self-Review notes (already applied)

- **Spec coverage:** boss table + rates §4/H2 (Task 1); per-action seeded spawn→flee→loot + counts
  §4/H1/H4 (Task 2); `diffStates` §5 (Task 3); encounter hook + visuals + min-duration §5/H5 (Task 4);
  DoD §8 — tests/types/build + live (Task 5). Out-of-scope respected (no up-class transition,
  monster-approach, branch realms, boss-XP).
- **No placeholders:** every file's full contents/edits are given; the rate-boundary tests (0/1) and
  the idempotency assertion are concrete; the live check tunes `boss_rate` for visibility.
- **Type/name consistency:** `DROP_TABLES.boss`, `DEFAULT_BOSS_RATE`/`DEFAULT_BOSS_FLEE_RATE`,
  `IConfig.boss_rate`/`boss_flee_rate`, `stats.boss_defeated`/`boss_fled`, `seededRng` seeds
  (`boss:`/`bossflee:`/`bossloot:` + ordinal), `GameEventType`/`IGameEvent`/`diffStates`,
  `useEncounter`, `BossEncounter`/`LootToast`. Bosses roll only on `EventType.Action` (farming, not
  failures). `config.drops` already merges `DROP_TABLES` (so `boss` is present even with a partial
  `config.json.drops`).
```
