# Phase 6.4 — Advance from the UI (class / branch / respec) design

> **Status:** design approved 2026-06-15. Plan: `docs/superpowers/plans/`.
> Makes the Talents panel interactive: choose your class at Lv.5, pick a T4 branch at Lv.50 (with a
> confirm, since it locks), and respec your class below Lv.50 — all from the UI, over the 6.3 write
> seam. The class-advancement logic moves into `core` so the CLI and the host share one source.

## Goal

Open Talents when an advancement is available and act on it:
- **Choose class** (Lv.5, no class yet) → pick one of the 4 lines + any unlocked secret class.
- **Pick branch** (Lv.50, main line, no branch) → choose `a`/`b`; a two-step confirm precedes the
  dispatch because the branch locks permanently.
- **Respec** (main line, below Lv.50) → a "Change class" affordance re-picks a different main line
  (clears the branch).

Otherwise the panel stays the read-only tree it is today.

## Architecture (over the 6.3 write seam)

```
Talents panel reads class.advance (denormalized) → renders the right interactive mode →
  dispatch({ name:"setClass", line }) | dispatch({ name:"setBranch", branch })
host applyAction: loadProfile → reduceToFile (level + unlocked secrets) →
  core/advance: setClass routes to chooseClass (no line yet) or respecClass (has a line);
  setBranch → chooseBranch → if ok: saveProfile + reduceToFile → push fresh state
```

The validation/mutation lives in **`core/advance.ts`** so `tools/rpg.ts` and the host share it (no
duplication, mirroring how 6.3 reused `core/profile`+`reduce`). The webview stays seam-clean — it
reads the denormalized `class.advance` and sends intents; it imports no `core` runtime, including no
`ClassLine` enum.

## Pure core (testable)

### `core/advance.ts` (new) — validate + mutate the profile (no fs; the caller persists)
```ts
export interface IAdvanceResult { ok: boolean; error?: string; }

// initial class pick: Lv.5+, a main line OR an unlocked secret line. Sets line, clears branch.
export const chooseClass = (
  profile: IProfile, line: string, level: number, unlockedSecrets: string[],
): IAdvanceResult;

// change an existing main class below Lv.50. Sets line, clears branch.
export const respecClass = (profile: IProfile, line: string, level: number): IAdvanceResult;

// T4 branch pick: Lv.50+, a main line, not already locked. Sets branch.
export const chooseBranch = (profile: IProfile, branch: string, level: number): IAdvanceResult;
```
These reproduce the exact rules + error strings currently in `tools/rpg.ts` (`setClass`/`respec`/
`setBranch`), so the CLI's behavior is unchanged after it delegates to them.

### `core/classes.ts` — denormalize the advance option
```ts
// kind stays a string union (not an enum) for the same seam reason as `branch`: the app compares it
// to these literals and may not import a core runtime enum (app/CLAUDE.md).
export interface IAdvanceOption {
  kind: "class" | "branch" | "respec";
  options: string[]; // class/respec → line ids; branch → ["a","b"]
}

export const advanceOption = (props: {
  line: TLine | null; level: number; branch: "a" | "b" | null; unlockedSecrets: string[];
}): IAdvanceOption | undefined;
```
Precedence: pending **branch** (`advancementPending` returns `"branch"`) → `{ kind:"branch",
options:["a","b"] }`; pending **class** → `{ kind:"class", options:[…4 main, …unlockedSecrets] }`;
else a **main line below Lv.50** → `{ kind:"respec", options:[…4 main] }`; otherwise `undefined`
(read-only: a locked/secret/too-low state). `IClassState` gains `advance?: IAdvanceOption`, set by
the reducer.

## Components / files

| File | Responsibility | New/Mod |
|---|---|---|
| `core/advance.ts` | `chooseClass`/`respecClass`/`chooseBranch` (pure validate+mutate) | Create |
| `core/classes.ts` | `IAdvanceOption` + `advanceOption(...)`; `IClassState.advance?` | Modify |
| `core/reduce.ts` | set `classState.advance = advanceOption({...})` | Modify |
| `tools/rpg.ts` | `setClass`/`respec`/`setBranch` delegate to `core/advance` (drop the duplicated checks) | Modify |
| `app/src/actions.ts` | add `ISetClassAction`/`ISetBranchAction` to `TClientAction` | Modify |
| `app/extension/src/host-actions.ts` | handle `setClass` (route chooseClass/respecClass) + `setBranch` | Modify |
| `app/src/components/talents-panel.tsx` | interactive modes from `class.advance` (+ branch confirm, + respec toggle); takes `dispatch` | Modify |
| `app/src/components/panel-overlay.tsx` | forward `dispatch` to `TalentsPanel` | Modify |
| `app/src/styles.css` | advance buttons + confirm | Modify |

### `actions.ts`
```ts
export interface ISetClassAction { type: "action"; name: "setClass"; line: string; }
export interface ISetBranchAction { type: "action"; name: "setBranch"; branch: string; }
export type TClientAction = IEquipAction | ISetClassAction | ISetBranchAction;
```

### `host-actions.ts` (adds to the existing `applyAction`)
`IRawAction` gains `line?: string` and `branch?: string`. New branches:
- `name === "setClass"`: `const state = reduceToFile(home); const profile = loadProfile(home);`
  `const r = profile.line == null ? chooseClass(profile, action.line ?? "", state.level,
  state.unlocked_secret_classes ?? []) : respecClass(profile, action.line ?? "", state.level);`
  if `r.ok` → `saveProfile` + `reduceToFile` → `readStateText`; else `null`.
- `name === "setBranch"`: `chooseBranch(profile, action.branch ?? "", state.level)` then the same
  persist/return on `ok`, else `null`.

### `talents-panel.tsx`
Reads `klass.advance`. Local state: a `confirmBranch: "a"|"b"|null` and a `respecOpen: boolean`.
- `advance.kind === "class"` → "Choose your class" + a button per `option` (label = the form-ish line
  name; for display, title-case the id) → `dispatch({ type:"action", name:"setClass", line })`.
- `advance.kind === "respec"` → a "Change class" button that reveals the same line buttons
  (dispatching `setClass`); collapsed by default so respec is deliberate.
- `advance.kind === "branch"` → the existing `a`/`b` fork nodes become buttons; clicking sets
  `confirmBranch`, which shows "Lock branch <form>? This is permanent." with Confirm/Cancel; Confirm →
  `dispatch({ type:"action", name:"setBranch", branch })`.
- no `advance` → today's read-only tree.

## Data flow & error handling

- **Validation in `core/advance`** (shared): class = Lv.5+ / unlocked secret; respec = Lv.<50, main;
  branch = Lv.50+, main, not locked. The host re-validates regardless of what the UI sent.
- **Branch confirm is UI-only** (a two-step guard); the host still rejects a second branch
  (`profile.branch` already set) so a stale UI can't double-lock.
- Invalid/garbage action → `applyAction` returns `null`, no state change (same as 6.3).
- The panel only renders a mode when `class.advance` says so → failures are rare and defensive.

## Testing

- **`core/advance`** (bun, pure): `chooseClass` (main ok / secret-locked / Lv<5 / unknown);
  `respecClass` (main ok / Lv≥50 rejected / non-main rejected); `chooseBranch` (a|b ok / Lv<50 /
  secret / already-locked). Assert the profile mutation and the `ok`/`error`.
- **`advanceOption`** (bun): each precedence case returns the right `{kind, options}` or `undefined`.
- **`tools/rpg.test.ts`** must stay green — the delegation is behavior-preserving (same errors).
- **`host-actions`** (bun, temp HOME): `setClass` picks a class; `respec` changes it below Lv.50;
  `setBranch` locks at Lv.50 and a second `setBranch` is rejected.
- **Talents panel**: interactive — verified visually in the VS Code panel (choose class → tree
  appears; branch confirm → fork locks; respec → class changes).

## Scope / non-goals

- **Advancements + respec only.** No XP/level editing, no un-respec of secrets, no branch un-lock.
- **No optimistic UI / no toast** — the panel waits for the host's state push (same as 6.3).
- **The `rpg` CLI keeps its commands** — they now delegate to `core/advance`, behavior unchanged.
- **No browser-SSE write path** — `send` no-ops there.
