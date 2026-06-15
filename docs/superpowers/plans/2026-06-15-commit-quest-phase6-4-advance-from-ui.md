# Phase 6.4 — Advance from the UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Talents panel interactive — choose a class (Lv.5), pick a T4 branch with a confirm (Lv.50, locks), and respec below Lv.50 — over the 6.3 write seam, with the advancement logic shared between the CLI and the host.

**Architecture:** `core/advance.ts` holds pure `chooseClass`/`respecClass`/`chooseBranch` (validate + mutate the profile); `tools/rpg.ts` and `app/extension/src/host-actions.ts` both delegate to it. The reducer denormalizes a `class.advance: { kind, options }` field the seam-clean webview reads to render the right interactive mode and `dispatch` an intent.

**Tech Stack:** TypeScript, Bun (`bun test`), React 19 webview, esbuild host. Builds on the 6.3 write seam (this branch is stacked on `feat/phase6.3-equip-write-seam`).

**Spec:** `docs/superpowers/specs/2026-06-15-commit-quest-phase6-4-advance-from-ui-design.md`

---

## Context for the implementer

- Builds on 6.3: `transport.send`, `app/src/actions.ts` (`TClientAction`), `host-actions.applyAction` (handles `equip`) all exist; `dispatch` is already threaded app→scene-view→panel-overlay→items-panel.
- The advancement rules currently live in `tools/rpg.ts` (`setClass`/`setBranch`/`respec`). This plan **moves them into `core/advance.ts`** (behavior-preserving) and has the CLI delegate. `rpg.test.ts` asserts substrings only (`"level 5"`, `"level 50"`, exit code 1 for locked secret) — the extracted error strings keep those, so it stays green.
- `core/classes.ts` exports `ClassLine` (mage/ranger/rogue/sage), `SecretLine`, `isSecret`, `CLASS_TREE`, `advancementPending`, `tierForLevel`, `type TLine`. `core/profile.ts` `IProfile` has `line?: TLine`, `branch?: "a" | "b"`. `IState.unlocked_secret_classes?: SecretLine[]`, `IState.level`.
- In `core/reduce.ts`, `classState` is built at ~line 264 but `unlocked` (secret unlocks) is computed later (~line 336) — so set `classState.advance` AFTER `unlocked` exists.
- `app/src/` stays seam-clean: no `core` runtime import (the app reads denormalized `class.advance`; the host imports `core`). Run `bun test 2>&1 | grep -E "pass|fail"` — never `tail`.

---

## Task 1: `core/advance.ts` + delegate the CLI

**Files:**
- Create: `core/advance.ts`
- Test: `test/core/advance.test.ts`
- Modify: `tools/rpg.ts`

- [ ] **Step 1: Write the failing test — create `test/core/advance.test.ts`:**

```ts
import { test, expect } from "bun:test";
import type { IProfile } from "../../core/profile";
import { chooseClass, respecClass, chooseBranch } from "../../core/advance";

const P = (over: Partial<IProfile> = {}): IProfile => ({ ...over });

test("chooseClass: main needs Lv.5; secret needs unlock; unknown rejected", () => {
  const low = P();
  expect(chooseClass(low, "mage", 4, []).error).toContain("level 5");

  const ok = P();
  expect(chooseClass(ok, "mage", 5, []).ok).toBe(true);
  expect(ok.line).toBe("mage");

  expect(chooseClass(P(), "maestro", 60, []).error).toContain("locked");
  const sec = P();
  expect(chooseClass(sec, "maestro", 60, ["maestro"]).ok).toBe(true);
  expect(sec.line).toBe("maestro");

  expect(chooseClass(P(), "wizard", 60, []).error).toContain("Unknown");
});

test("respecClass: main only, below Lv.50; clears branch", () => {
  const p = P({ line: "mage", branch: "a" });
  expect(respecClass(p, "rogue", 30).ok).toBe(true);
  expect(p.line).toBe("rogue");
  expect(p.branch).toBeUndefined();

  expect(respecClass(P({ line: "mage" }), "rogue", 50).error).toContain("level 50");
  expect(respecClass(P({ line: "mage" }), "maestro", 30).error).toContain("Unknown");
});

test("chooseBranch: a|b, Lv.50, main, not locked", () => {
  expect(chooseBranch(P({ line: "mage" }), "c", 50).error).toContain("a");
  expect(chooseBranch(P(), "a", 50).error).toContain("class first");
  expect(chooseBranch(P({ line: "maestro" }), "a", 50).error).toContain("Secret");
  expect(chooseBranch(P({ line: "mage" }), "a", 49).error).toContain("level 50");
  expect(chooseBranch(P({ line: "mage", branch: "a" }), "b", 50).error).toContain("locked");

  const p = P({ line: "mage" });
  expect(chooseBranch(p, "b", 50).ok).toBe(true);
  expect(p.branch).toBe("b");
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun test test/core/advance.test.ts 2>&1 | grep -E "pass|fail"` → FAIL (module not found).

- [ ] **Step 3: Implement `core/advance.ts`**

```ts
import type { IProfile } from "./profile";
import { ClassLine, SecretLine, isSecret, type TLine } from "./classes";

export interface IAdvanceResult {
  ok: boolean;
  error?: string;
}

const MAIN_LINES = Object.values(ClassLine) as string[];
const SECRET_LINES = Object.values(SecretLine) as string[];

// Initial class pick (Lv.5+): a main line, or an unlocked secret. Sets line, clears branch.
export const chooseClass = (
  profile: IProfile,
  line: string,
  level: number,
  unlockedSecrets: string[],
): IAdvanceResult => {
  if (MAIN_LINES.includes(line)) {
    if (level < 5) {
      return { ok: false, error: "Reach level 5 before choosing a class." };
    }
    profile.line = line as ClassLine;
    profile.branch = undefined;
    return { ok: true };
  }
  if (SECRET_LINES.includes(line)) {
    if (!unlockedSecrets.includes(line)) {
      return { ok: false, error: `Secret class "${line}" is locked.` };
    }
    profile.line = line as SecretLine;
    profile.branch = undefined;
    return { ok: true };
  }
  return { ok: false, error: `Unknown class "${line}".` };
};

// Respec an existing main class below Lv.50. Sets line, clears branch.
export const respecClass = (profile: IProfile, line: string, level: number): IAdvanceResult => {
  if (!MAIN_LINES.includes(line)) {
    return { ok: false, error: `Unknown class "${line}".` };
  }
  if (level >= 50) {
    return { ok: false, error: "Cannot respec at level 50." };
  }
  profile.line = line as ClassLine;
  profile.branch = undefined;
  return { ok: true };
};

// T4 branch pick (Lv.50+, main line, not locked). Sets branch.
export const chooseBranch = (profile: IProfile, branch: string, level: number): IAdvanceResult => {
  if (branch !== "a" && branch !== "b") {
    return { ok: false, error: `Branch must be "a" or "b".` };
  }
  if (!profile.line) {
    return { ok: false, error: "Choose a class first." };
  }
  if (isSecret(profile.line as TLine)) {
    return { ok: false, error: "Secret classes have no branch." };
  }
  if (level < 50) {
    return { ok: false, error: "Reach level 50 before branching." };
  }
  if (profile.branch) {
    return { ok: false, error: "Branch already chosen (locked)." };
  }
  profile.branch = branch;
  return { ok: true };
};
```

- [ ] **Step 4: Run to verify it passes**

Run: `bun test test/core/advance.test.ts 2>&1 | grep -E "pass|fail"` → PASS.

- [ ] **Step 5: Delegate the CLI in `tools/rpg.ts`**

Add the import:
```ts
import { chooseClass, respecClass, chooseBranch } from "../core/advance";
```
Replace the `setClass`, `setBranch`, and `respec` functions with delegating versions (keep `persist`):
```ts
const setClass = (profile: IProfile, line: string): string => {
  const state = reduceToFile(HOME);
  const r = chooseClass(profile, line, state.level, (state.unlocked_secret_classes ?? []) as string[]);
  if (!r.ok) {
    fail(r.error ?? "");
  }
  persist(profile);
  return `Class set to ${line}.`;
};

const setBranch = (profile: IProfile, branch: string): string => {
  const state = reduceToFile(HOME);
  const r = chooseBranch(profile, branch, state.level);
  if (!r.ok) {
    fail(r.error ?? "");
  }
  persist(profile);
  return `Branch locked: ${branch}.`;
};

const respec = (profile: IProfile, line: string): string => {
  const state = reduceToFile(HOME);
  const r = respecClass(profile, line, state.level);
  if (!r.ok) {
    fail(r.error ?? "");
  }
  persist(profile);
  return `Respec to ${line}.`;
};
```
If `currentLevel` is now unused (it was only used by these three), remove its definition. Remove any now-unused imports flagged by tsc (e.g. `ClassLine`/`SecretLine`/`CLASS_TREE`/`isSecret` if no longer referenced — check, don't assume).

- [ ] **Step 6: Verify the CLI still passes + types**

Run: `bun test test/tools/rpg.test.ts 2>&1 | grep -E "pass|fail"` → all pass (the rules + substrings are preserved).
Run: `bunx tsc --noEmit 2>&1 | grep -E "error TS" | head` → no output.

- [ ] **Step 7: Commit**

```bash
git add core/advance.ts test/core/advance.test.ts tools/rpg.ts
git commit -m "feat(core): advance.ts (choose/respec class, choose branch); CLI delegates"
```

---

## Task 2: Denormalize `class.advance`

**Files:**
- Modify: `core/classes.ts`
- Modify: `core/reduce.ts`
- Test: `test/core/classes.test.ts`

- [ ] **Step 1: Add the failing test — append to `test/core/classes.test.ts`** (add `advanceOption` to the existing `from "../../core/classes"` import):

```ts
test("advanceOption: class pick, branch pick, respec, or none", () => {
  // no class yet, Lv.5+ → class pick (main lines + unlocked secrets)
  const c = advanceOption({ line: null, level: 6, branch: null, unlockedSecrets: ["maestro"] });
  expect(c?.kind).toBe("class");
  expect(c?.options).toContain("mage");
  expect(c?.options).toContain("maestro");

  // main line, Lv.50, no branch → branch pick
  expect(
    advanceOption({ line: ClassLine.Mage, level: 50, branch: null, unlockedSecrets: [] }),
  ).toEqual({ kind: "branch", options: ["a", "b"] });

  // main line below Lv.50 → respec (main lines only)
  const r = advanceOption({ line: ClassLine.Mage, level: 20, branch: null, unlockedSecrets: [] });
  expect(r?.kind).toBe("respec");
  expect(r?.options).toEqual(["mage", "ranger", "rogue", "sage"]);

  // locked main line (Lv.50 + branch chosen) → none
  expect(
    advanceOption({ line: ClassLine.Mage, level: 50, branch: "a", unlockedSecrets: [] }),
  ).toBeUndefined();

  // secret line → none (no branch, no respec)
  expect(
    advanceOption({ line: SecretLine.Maestro, level: 60, branch: null, unlockedSecrets: [] }),
  ).toBeUndefined();

  // no class, below Lv.5 → none
  expect(
    advanceOption({ line: null, level: 3, branch: null, unlockedSecrets: [] }),
  ).toBeUndefined();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun test test/core/classes.test.ts 2>&1 | grep -E "pass|fail"` → FAIL (`advanceOption` not exported).

- [ ] **Step 3: Implement in `core/classes.ts`**

Add `advance?` to `IClassState` (after `tree?`):
```ts
  advance?: IAdvanceOption;
```
Add the type + helper (near `advancementPending`):
```ts
// kind stays a string union (not an enum) for the same seam reason as `branch`: the app compares it
// to these literals and may not import a core runtime enum (app/CLAUDE.md).
export interface IAdvanceOption {
  kind: "class" | "branch" | "respec";
  options: string[]; // class/respec → line ids; branch → ["a","b"]
}

const MAIN_LINE_IDS = Object.values(ClassLine) as string[];

interface IAdvanceOptionArgs {
  line: TLine | null;
  level: number;
  branch: "a" | "b" | null;
  unlockedSecrets: string[];
}

export const advanceOption = (props: IAdvanceOptionArgs): IAdvanceOption | undefined => {
  const { line, level, branch, unlockedSecrets } = props;
  const pending = advancementPending({ line, level, branch });
  if (pending === AdvancementKind.Branch) {
    return { kind: "branch", options: ["a", "b"] };
  }
  if (pending === AdvancementKind.Class) {
    return { kind: "class", options: [...MAIN_LINE_IDS, ...unlockedSecrets] };
  }
  if (line !== null && !isSecret(line) && level < 50) {
    return { kind: "respec", options: [...MAIN_LINE_IDS] };
  }
  return undefined;
};
```

- [ ] **Step 4: Set `classState.advance` in `core/reduce.ts`**

The `classState` object is built without `advance`. After the line where `unlocked` is computed (`const unlocked = collectUnlocks({...})`, ~line 336), add:
```ts
  classState.advance = advanceOption({
    line,
    level: prog.level,
    branch,
    unlockedSecrets: unlocked as string[],
  });
```
Add `advanceOption` to the existing `from "./classes"` import.

- [ ] **Step 5: Run to verify + idempotency + full suite**

Run: `bun test test/core/classes.test.ts 2>&1 | grep -E "pass|fail"` → PASS.
Run: `bun test test/core/reduce.test.ts 2>&1 | grep -E "pass|fail"` → PASS (reduce stays idempotent; `advance` is a pure function of the same inputs).
Run: `bunx tsc --noEmit 2>&1 | grep -E "error TS" | head` → no output.

- [ ] **Step 6: Commit**

```bash
git add core/classes.ts core/reduce.ts test/core/classes.test.ts
git commit -m "feat(core): denormalize class.advance (class/branch/respec options) for the app"
```

---

## Task 3: Action types + host `setClass`/`setBranch`

**Files:**
- Modify: `app/src/actions.ts`
- Modify: `app/extension/src/host-actions.ts`
- Test: `app/extension/src/host-actions.test.ts`

- [ ] **Step 1: Extend the action contract in `app/src/actions.ts`**

```ts
export interface ISetClassAction {
  type: "action";
  name: "setClass";
  line: string;
}
export interface ISetBranchAction {
  type: "action";
  name: "setBranch";
  branch: string;
}
export type TClientAction = IEquipAction | ISetClassAction | ISetBranchAction;
```
(Keep `EquipKind`/`IEquipAction` as they are.)

- [ ] **Step 2: Add failing host tests — append to `app/extension/src/host-actions.test.ts`** (reuse the file's existing `makeHome`/imports; add a journal-only seeder for level):

```ts
import { reduceToFile } from "../../../core/reduce";

// A journal that reaches a target level via prompt xp (default config weights).
function seedPrompts(home: string, n: number) {
  const dir = join(home, "journal");
  mkdirSync(dir, { recursive: true });
  const line = `{"ts":"2026-06-11T12:00:00Z","source":"claude-code","session_id":"s","type":"prompt","repo":"cq"}`;
  writeFileSync(join(dir, "s.ndjson"), Array(n).fill(line).join("\n") + "\n");
}

test("applyAction setClass picks a class, then respec changes it (below Lv.50)", () => {
  const home = makeHome();
  seedPrompts(home, 60); // enough xp for >= Lv.5, < Lv.50
  expect(reduceToFile(home).level).toBeGreaterThanOrEqual(5);

  const s1 = applyAction(home, { name: "setClass", line: "mage" });
  expect(s1).not.toBeNull();
  expect(JSON.parse(readFileSync(join(home, "profile.json"), "utf8")).line).toBe("mage");

  const s2 = applyAction(home, { name: "setClass", line: "rogue" }); // has a line → respec
  expect(s2).not.toBeNull();
  expect(JSON.parse(readFileSync(join(home, "profile.json"), "utf8")).line).toBe("rogue");

  const bad = applyAction(home, { name: "setClass", line: "wizard" });
  expect(bad).toBeNull();
});

test("applyAction setBranch rejects below Lv.50", () => {
  const home = makeHome();
  seedPrompts(home, 60); // < Lv.50
  applyAction(home, { name: "setClass", line: "mage" });
  const r = applyAction(home, { name: "setBranch", branch: "a" });
  expect(r).toBeNull(); // not Lv.50 yet
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `bun test app/extension/src/host-actions.test.ts 2>&1 | grep -E "pass|fail"` → FAIL (setClass/setBranch not handled).

- [ ] **Step 4: Extend `app/extension/src/host-actions.ts`**

Add to the imports:
```ts
import { chooseClass, respecClass, chooseBranch } from "../../../core/advance";
```
Add `line?` and `branch?` to `IRawAction`:
```ts
interface IRawAction {
  name?: string;
  kind?: string;
  id?: string;
  line?: string;
  branch?: string;
}
```
At the **top** of `applyAction` (before the existing `equip` logic, which is gated on `action.name !== "equip"`), insert handlers for the two new names. Restructure so each `name` has its own branch — e.g.:
```ts
export const applyAction = (home: string, action: IRawAction): string | null => {
  if (action.name === "setClass") {
    return applyAdvance(home, profile => {
      const state = reduceToFile(home);
      return profile.line == null
        ? chooseClass(profile, action.line ?? "", state.level, (state.unlocked_secret_classes ?? []) as string[])
        : respecClass(profile, action.line ?? "", state.level);
    });
  }
  if (action.name === "setBranch") {
    return applyAdvance(home, profile => {
      const state = reduceToFile(home);
      return chooseBranch(profile, action.branch ?? "", state.level);
    });
  }
  if (action.name !== "equip") {
    return null;
  }
  // … existing equip logic unchanged …
};
```
Add the shared helper above `applyAction` (it loads the profile, runs the validator, and persists+reduces on ok):
```ts
const applyAdvance = (
  home: string,
  run: (profile: ReturnType<typeof loadProfile>) => { ok: boolean },
): string | null => {
  const profile = loadProfile(home);
  if (!run(profile).ok) {
    return null;
  }
  saveProfile(home, profile);
  reduceToFile(home);
  return readStateText(home);
};
```

- [ ] **Step 5: Run to verify it passes + types**

Run: `bun test app/extension/src/host-actions.test.ts 2>&1 | grep -E "pass|fail"` → PASS.
Run: `cd app && bunx tsc --noEmit 2>&1 | grep -E "error TS" | head` → no output.
Run: `cd app/extension && bunx tsc --noEmit 2>&1 | grep -E "error TS" | head` → no output.

- [ ] **Step 6: Commit**

```bash
git add app/src/actions.ts app/extension/src/host-actions.ts app/extension/src/host-actions.test.ts
git commit -m "feat: setClass/setBranch actions + host advance handlers (via core/advance)"
```

---

## Task 4: Interactive Talents panel

**Files:**
- Modify: `app/src/components/talents-panel.tsx`
- Modify: `app/src/components/panel-overlay.tsx`
- Modify: `app/src/styles.css`

- [ ] **Step 1: Forward `dispatch` to `TalentsPanel` in `panel-overlay.tsx`**

`dispatch` is already a prop on `PanelOverlay` (from 6.3). Change the Talents render branch to pass it:
```tsx
        {activePanel === PanelId.Talents ? (
          <TalentsPanel state={state} dispatch={dispatch} />
        ) : null}
```

- [ ] **Step 2: Make `talents-panel.tsx` interactive** — replace the whole file:

```tsx
import { useState } from "react";
import type { IState } from "../../../core/state";
import type { TClientAction } from "../actions";

interface IProps {
  state: IState;
  dispatch: (action: TClientAction) => void;
}

const nodeState = (t: number, tier: number): string => {
  if (t === tier) {
    return "current";
  }
  if (t < tier) {
    return "past";
  }
  return "locked";
};

const titleCase = (id: string): string =>
  id
    .split("_")
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

const TalentsPanel = (props: IProps) => {
  const { state, dispatch } = props;
  const klass = state.class;
  const advance = klass?.advance;
  const [respecOpen, setRespecOpen] = useState(false);
  const [confirmBranch, setConfirmBranch] = useState<string | null>(null);

  const pickClass = (line: string) => {
    dispatch({ type: "action", name: "setClass", line });
    setRespecOpen(false);
  };

  // Class not chosen yet: a picker, no tree to show.
  if (advance?.kind === "class") {
    return (
      <div className="panel-body talents-panel">
        <div className="panel-head">Choose your class</div>
        <div className="advance-options">
          {advance.options.map(line => (
            <button key={line} type="button" className="advance-btn" onClick={() => pickClass(line)}>
              {titleCase(line)}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const tree = klass?.tree;
  const tier = klass?.tier ?? 0;
  const branch = klass?.branch ?? null;
  if (!tree) {
    return (
      <div className="panel-body talents-panel">
        <div className="panel-empty">Reach level 5 to choose a class.</div>
      </div>
    );
  }

  return (
    <div className="panel-body talents-panel">
      <div className="talent-tree">
        {tree.forms.map((form, i) => {
          const t = i + 1;
          return (
            <div key={form} className={`talent-node ${nodeState(t, tier)}`}>
              <span className="tn-tier">T{t}</span>
              <span className="tn-form">{form}</span>
            </div>
          );
        })}
        {tree.branches ? (
          <div className="talent-fork">
            {(["a", "b"] as const).map(b => {
              const pickable = advance?.kind === "branch";
              const node = (
                <div
                  className={`talent-node branch ${branch === b ? "current" : "locked"}`}
                >
                  <span className="tn-tier">T4 · {b}</span>
                  <span className="tn-form">{tree.branches![b]}</span>
                </div>
              );
              if (!pickable) {
                return <div key={b}>{node}</div>;
              }
              return (
                <button
                  key={b}
                  type="button"
                  className="branch-pick"
                  onClick={() => setConfirmBranch(b)}
                >
                  {node}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      {advance?.kind === "respec" ? (
        <div className="advance-foot">
          {respecOpen ? (
            <div className="advance-options">
              {advance.options.map(line => (
                <button
                  key={line}
                  type="button"
                  className="advance-btn"
                  onClick={() => pickClass(line)}
                >
                  {titleCase(line)}
                </button>
              ))}
              <button type="button" className="advance-cancel" onClick={() => setRespecOpen(false)}>
                Cancel
              </button>
            </div>
          ) : (
            <button type="button" className="advance-btn" onClick={() => setRespecOpen(true)}>
              Change class
            </button>
          )}
        </div>
      ) : null}

      {confirmBranch ? (
        <div className="advance-confirm">
          <span>Lock branch {tree.branches?.[confirmBranch as "a" | "b"]}? This is permanent.</span>
          <div className="advance-confirm-row">
            <button
              type="button"
              className="advance-btn"
              onClick={() => {
                dispatch({ type: "action", name: "setBranch", branch: confirmBranch });
                setConfirmBranch(null);
              }}
            >
              Confirm
            </button>
            <button type="button" className="advance-cancel" onClick={() => setConfirmBranch(null)}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default TalentsPanel;
```

- [ ] **Step 3: Add the styles — append to `app/src/styles.css` (after the `.talent-fork` rules; search for `.talent-node`):**

```css
.advance-options {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
}
.advance-btn {
  font-family: "Pixelify Sans", monospace;
  font-size: 12px;
  padding: 5px 10px;
  color: var(--ink);
  background: var(--gold-soft);
  border: 2px solid var(--ink);
  border-radius: 3px;
  cursor: pointer;
}
.advance-btn:hover {
  background: var(--gold);
}
.advance-cancel {
  font-family: "Pixelify Sans", monospace;
  font-size: 12px;
  padding: 5px 10px;
  color: var(--dim);
  background: var(--panel-dark);
  border: 2px solid var(--gold);
  border-radius: 3px;
  cursor: pointer;
}
.branch-pick {
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
}
.advance-foot {
  margin-top: 8px;
}
.advance-confirm {
  margin-top: 8px;
  padding: 8px;
  background: var(--panel-2);
  border: 2px solid var(--gold);
  border-radius: 3px;
  font-size: 12px;
  color: var(--text);
}
.advance-confirm-row {
  display: flex;
  gap: 8px;
  margin-top: 6px;
}
```

- [ ] **Step 4: Type-check + full suite + grep**

Run: `cd app && bunx tsc --noEmit 2>&1 | grep -E "error TS" | head` → no output.
Run: `bun test 2>&1 | grep -E "pass|fail" | tail -2` → all pass, 0 fail.
Run: `grep -n "dispatch" app/src/components/talents-panel.tsx` → matches.

- [ ] **Step 5: Commit**

```bash
git add app/src/components/talents-panel.tsx app/src/components/panel-overlay.tsx app/src/styles.css
git commit -m "feat(app): interactive Talents — pick class, branch (confirm), respec"
```

- [ ] **Step 6: Visual verification (report, do not automate)**

Report for the human: `cd app/extension && npm run reinstall`, reload, open **Talents** — at Lv.5 with no class, pick a class (tree appears); below Lv.50, "Change class" respecs; at Lv.50, the a/b fork is clickable and asks to confirm before locking.

---

## Self-Review

**Spec coverage:**
- `core/advance.ts` chooseClass/respecClass/chooseBranch (pure, tested) + CLI delegation → Task 1. ✅
- `class.advance` denormalization (`advanceOption` + reduce) → Task 2. ✅
- `setClass`/`setBranch` actions + host handlers (route chooseClass/respecClass, chooseBranch) → Task 3. ✅
- Interactive Talents (class picker / branch confirm / respec toggle) reading `class.advance` → Task 4. ✅
- Seam: app reads denormalized `advance`, imports no `core` runtime; host imports `core/advance` → Tasks 2–4. ✅
- CLI behavior preserved (rpg.test green) → Task 1 step 6. ✅
- Testing: pure `advance` + `advanceOption`; host setClass/setBranch; reduce idempotency; visual → all tasks. ✅
- Scope: advance + respec only; no optimistic UI/toast → all tasks. ✅

**Placeholder scan:** none — every step has full code.

**Type consistency:** `IAdvanceResult { ok, error? }` from `core/advance` (Task 1) consumed by the host helper `applyAdvance` (Task 3, which only reads `.ok`). `IAdvanceOption { kind: "class"|"branch"|"respec"; options: string[] }` + `advanceOption(IAdvanceOptionArgs)` defined in Task 2, consumed in `reduce.ts` (Task 2) and read as `klass.advance` in `talents-panel.tsx` (Task 4). `ISetClassAction`/`ISetBranchAction` added to `TClientAction` (Task 3) are dispatched in Task 4 (`{ name:"setClass", line }`, `{ name:"setBranch", branch }`) and handled by `applyAction`'s name branches (Task 3). `IRawAction` gains `line?`/`branch?` matching those payloads.
