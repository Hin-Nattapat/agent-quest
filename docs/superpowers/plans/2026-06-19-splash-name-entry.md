# Splash / Start + Name entry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A title screen with a Start Game button shows each time the panel opens; if the player has no name, Start leads to a name-entry step that persists the name; then the game.

**Architecture:** A session-scoped `started` flag in `app.tsx` gates a full-panel `NewGameOverlay` (splash → optional name step). A new `setName` webview action persists `profile.name` via the extension host (`host-actions.applyAction`). No reducer change — `name` already flows from `profile.json`.

**Tech Stack:** React 19 + TS + CSS; Bun host (`host-actions`); `bun test`.

**Spec:** `docs/superpowers/specs/2026-06-19-splash-name-entry-design.md`

**Branch:** `feat/splash-name-entry` (off main; spec already committed there).

**Conventions** (`app/CLAUDE.md`): arrow-const; `interface I*` / `type T*`; **string enums** (no bare unions — but the action `name` discriminants here are string literals matching the existing `IEquipAction`/`ISetClassAction` pattern in actions.ts, so follow that file's style); no `any`; braces on every if/else; one component per file `export default`; comments explain WHY; Prettier. Tests `bun test`.

**Run:** app tests `cd app && bun test 2>&1 | grep -E "pass|fail"`; typecheck `cd app && bun run typecheck 2>&1 | tail -2`; host tests `cd app/extension && bun test 2>&1 | grep -E "pass|fail"`.

**Existing patterns:**
- `app/src/actions.ts`: `IEquipAction`/`ISetClassAction`/`ISetBranchAction` (each `{ type: "action"; name: "…"; … }`) + `TClientAction` union.
- `app/extension/src/host-actions.ts`: `applyAction(home, action)` with an `IRawAction` shape; mutates `profile` via `loadProfile`/`saveProfile`, then `reduceToFile(home)`, returns `readStateText(home)` or `null`.
- `app/src/app.tsx`: `const state = useGameState(transport)` → `if (!state) loading` → `<SceneView state dispatch={transport.send} />`.
- `app/src/components/talents-panel.tsx` dispatches `{ type: "action", name: "setClass", line }` — the dispatch shape to mirror.

---

## File Structure

- `app/src/actions.ts` — `ISetNameAction` + union (Task 1).
- `app/extension/src/host-actions.ts` + `…/host-actions.test.ts` — persist `setName` (Task 2).
- `app/src/components/new-game-overlay.tsx` (new) — splash + name step (Task 3).
- `app/src/app.tsx` — `started` gate (Task 3).
- `app/src/styles.css` — `.new-game` + children (Task 4).
- Browser verification (Task 5).

---

## Task 1: `setName` action type

**Files:** Modify `app/src/actions.ts`

- [ ] **Step 1: Add the interface + extend the union.** After `ISetBranchAction`:

```ts
export interface ISetNameAction {
  type: "action";
  name: "setName";
  value: string;
}
```
Change the union to:
```ts
export type TClientAction =
  | IEquipAction
  | ISetClassAction
  | ISetBranchAction
  | ISetNameAction;
```

- [ ] **Step 2: Typecheck.** Run: `cd /Users/calypso/Project/Ottery/commit-quest/app && bun run typecheck 2>&1 | tail -2` (clean).

- [ ] **Step 3: Commit**

```bash
cd /Users/calypso/Project/Ottery/commit-quest
git add app/src/actions.ts
git commit -m "feat(app): setName client action type"
```

---

## Task 2: Persist `setName` in the extension host (TDD)

**Files:** Modify `app/extension/src/host-actions.ts`, `app/extension/src/host-actions.test.ts`

- [ ] **Step 1: Read the test file** to match its fixture style (how it builds a `home` with a `profile.json` + journal and calls `applyAction`). Find an existing test that asserts a profile mutation (e.g. setClass/equip) and mirror its setup.

- [ ] **Step 2: Add failing tests** to `app/extension/src/host-actions.test.ts` (use the file's existing home-fixture helper):

```ts
test("setName trims, caps at 24, and persists to the profile", () => {
  const home = makeHome(); // ← use whatever the file's fixture helper is called
  const out = applyAction(home, { name: "setName", value: "  Gandalf the Grey the White  " });
  expect(out).not.toBeNull();
  expect(loadProfile(home).name).toBe("Gandalf the Grey the Whit"); // 24 chars, trimmed
});

test("setName rejects an empty/whitespace value and leaves the profile unchanged", () => {
  const home = makeHome();
  const before = loadProfile(home).name;
  expect(applyAction(home, { name: "setName", value: "   " })).toBeNull();
  expect(loadProfile(home).name).toBe(before);
});
```
(Import `loadProfile` from `../../../core/profile` if not already imported in the test.)

- [ ] **Step 3: Run — expect FAIL** (setName unhandled → returns null for the first test).

Run: `cd /Users/calypso/Project/Ottery/commit-quest/app/extension && bun test host-actions.test.ts 2>&1 | grep -E "pass|fail|error"`

- [ ] **Step 4: Implement.** In `app/extension/src/host-actions.ts`:
  (a) add `value?: string;` to the `IRawAction` interface.
  (b) at the START of `applyAction`'s body (before the `setClass` branch):
```ts
  if (action.name === "setName") {
    const value = (action.value ?? "").trim().slice(0, 24);
    if (!value) {
      return null;
    }
    const profile = loadProfile(home);
    profile.name = value;
    saveProfile(home, profile);
    reduceToFile(home);
    return readStateText(home);
  }
```
(`loadProfile`/`saveProfile`/`reduceToFile`/`readStateText` are already imported.)

- [ ] **Step 5: Run — expect PASS + full host suite green.**

Run: `cd /Users/calypso/Project/Ottery/commit-quest/app/extension && bun test 2>&1 | grep -E "pass|fail" | tail -1`. Prettier: `cd /Users/calypso/Project/Ottery/commit-quest && npx prettier --write app/extension/src/host-actions.ts app/extension/src/host-actions.test.ts 2>&1 | tail -1`.

- [ ] **Step 6: Commit**

```bash
cd /Users/calypso/Project/Ottery/commit-quest
git add app/extension/src/host-actions.ts app/extension/src/host-actions.test.ts
git commit -m "feat(ext): persist setName action to the profile"
```

---

## Task 3: NewGameOverlay component + app gate

**Files:** Create `app/src/components/new-game-overlay.tsx`; modify `app/src/app.tsx`

- [ ] **Step 1: Create `app/src/components/new-game-overlay.tsx`:**

```tsx
import { useState } from "react";
import type { IState } from "../../../core/state";
import type { TClientAction } from "../actions";

interface IProps {
  state: IState;
  dispatch: (action: TClientAction) => void;
  onStart: () => void;
}

// Title screen shown on every panel open (the `started` flag lives in app.tsx, per session). Start
// drops into the game; a nameless player gets a name step first, which persists via the setName action.
const NewGameOverlay = (props: IProps) => {
  const { state, dispatch, onStart } = props;
  const [stage, setStage] = useState<"splash" | "name">("splash");
  const [value, setValue] = useState("");

  const start = () => {
    if (state.name) {
      onStart();
    } else {
      setStage("name");
    }
  };
  const begin = () => {
    const name = value.trim();
    if (!name) {
      return;
    }
    dispatch({ type: "action", name: "setName", value: name });
    onStart();
  };

  return (
    <div className="new-game">
      <div className="ng-scrim" aria-hidden="true" />
      <div className="ng-inner">
        {stage === "splash" ? (
          <>
            <h1 className="ng-title">Commit Quest</h1>
            <p className="ng-tagline">Turn your coding sessions into an adventure.</p>
            <button type="button" className="ng-btn" onClick={start}>
              ▶ Start Game
            </button>
          </>
        ) : (
          <>
            <h1 className="ng-title">Name your adventurer</h1>
            <input
              className="ng-input"
              type="text"
              maxLength={24}
              autoFocus
              value={value}
              placeholder="Adventurer"
              onChange={e => setValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") {
                  begin();
                }
              }}
            />
            <button
              type="button"
              className="ng-btn"
              disabled={value.trim().length === 0}
              onClick={begin}
            >
              Begin Quest
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default NewGameOverlay;
```

- [ ] **Step 2: Gate it in `app/src/app.tsx`.** Add the import + a `started` state and return the overlay before SceneView:

```tsx
import { useState } from "react";
import NewGameOverlay from "./components/new-game-overlay";
// …
const App = (props: IProps) => {
  const { transport } = props;
  const state = useGameState(transport);
  const activity = useActivity(state);
  const [started, setStarted] = useState(false);

  if (!state) {
    return <div className="loading">Connecting…</div>;
  }
  if (!started) {
    return (
      <NewGameOverlay
        state={state}
        dispatch={transport.send}
        onStart={() => setStarted(true)}
      />
    );
  }
  return <SceneView state={state} activity={activity} dispatch={transport.send} />;
};
```

- [ ] **Step 3: Typecheck + suite.** Run: `cd /Users/calypso/Project/Ottery/commit-quest/app && bun run typecheck 2>&1 | tail -2` (clean) and `bun test 2>&1 | grep -E "pass|fail" | tail -1`. Prettier: `cd /Users/calypso/Project/Ottery/commit-quest && npx prettier --write app/src/components/new-game-overlay.tsx app/src/app.tsx 2>&1 | tail -1`.

- [ ] **Step 4: Commit**

```bash
cd /Users/calypso/Project/Ottery/commit-quest
git add app/src/components/new-game-overlay.tsx app/src/app.tsx
git commit -m "feat(app): new-game splash + name-entry overlay"
```

---

## Task 4: Splash styling

**Files:** Modify `app/src/styles.css`

- [ ] **Step 1: Add CSS** (place near the other full-panel layers, e.g. after the `.loading` rule). Uses the existing tokens; the BG falls back to a dusk→gold gradient until `splash.png` (400×128) lands.

```css
/* Title screen: full-panel BG (400x128 splash.png, cover) under a scrim, with a centered column. */
.new-game {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background:
    url("/splash.png") center / cover no-repeat,
    linear-gradient(180deg, #1a1330 0%, #2a1f48 55%, #3a2a14 100%);
  image-rendering: pixelated;
  display: grid;
  place-items: center;
}
.ng-scrim {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at center, #0a0810cc 0%, #0a0810f2 100%);
}
.ng-inner {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  padding: 24px;
  text-align: center;
}
.ng-title {
  margin: 0;
  font-family: var(--font-display);
  font-size: clamp(28px, 6cqw, 52px);
  color: var(--gold-soft);
  text-shadow: 0 2px 0 #000;
  letter-spacing: 1px;
}
.ng-tagline {
  margin: 0;
  color: var(--text);
  font-size: 13px;
  max-width: 42ch;
}
.ng-btn {
  font-family: "Pixelify Sans", monospace;
  font-size: 15px;
  padding: 8px 22px;
  color: var(--ink);
  background: var(--gold-soft);
  border: 2px solid var(--ink);
  border-radius: 3px;
  cursor: pointer;
  transition: background 120ms ease-out;
}
.ng-btn:hover {
  background: var(--gold);
}
.ng-btn:active {
  transform: translateY(1px);
}
.ng-btn:focus-visible {
  outline: 2px solid var(--gold-soft);
  outline-offset: 2px;
}
.ng-btn:disabled {
  background: var(--panel);
  color: var(--dim);
  cursor: default;
}
.ng-input {
  font-family: "Pixelify Sans", monospace;
  font-size: 15px;
  text-align: center;
  padding: 7px 12px;
  width: min(260px, 70cqw);
  color: var(--text);
  background: var(--panel-dark);
  border: 2px solid var(--gold);
  border-radius: 3px;
}
.ng-input:focus-visible {
  outline: 2px solid var(--gold-soft);
  outline-offset: 2px;
}
```

- [ ] **Step 2: Prettier + typecheck/suite.** Run: `cd /Users/calypso/Project/Ottery/commit-quest && npx prettier --write app/src/styles.css 2>&1 | tail -1` and `cd app && bun test 2>&1 | grep -E "pass|fail" | tail -1`.

- [ ] **Step 3: Commit**

```bash
cd /Users/calypso/Project/Ottery/commit-quest
git add app/src/styles.css
git commit -m "style(app): new-game splash screen"
```

---

## Task 5: Browser verification

Controller (browser). The dev SSE transport's `send` is a no-op, so verify the overlay *flow*, not name persistence (that's Task 2's unit test).

- [ ] **Step 1: Build + serve two fixtures** — one without a name, one with. Reuse the panels fixture pattern:

```bash
cd /Users/calypso/Project/Ottery/commit-quest/app
pkill -f "bun server.ts" 2>/dev/null; sleep 0.3
npm run build 2>&1 | tail -1
NONAME="$CLAUDE_JOB_DIR/tmp/fakesplash"; mkdir -p "$NONAME"
NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)
cat > "$NONAME/state.json" <<JSON
{ "version":1,"updated_at":"$NOW","xp_total":50,"level":2,"xp_in_level":10,"xp_to_next":30,
  "stats":{"prompts":4,"actions":{"edit":2},"sessions":1,"by_source":{},"by_repo":{},"boss_defeated":0,"boss_fled":0},
  "class":{"line":null,"tier":0,"form":"Novice","icon":"⚔","branch":null,"affinity":{"mage":0.3,"ranger":0.3,"rogue":0.2,"sage":0.2}},
  "last_event":{"ts":"$NOW","type":"post_tool"},"inventory":[],"recent":[],"cosmetics":{} }
JSON
AGENTRPG_HOME="$NONAME" AGENTRPG_PORT=7198 nohup bun server.ts > "$CLAUDE_JOB_DIR/tmp/serve-splash.log" 2>&1 &
sleep 1.3; echo "serve $(curl -s -o /dev/null -w '%{http_code}' http://localhost:7198/)"
```

- [ ] **Step 2: Verify (no name).** Navigate to `http://localhost:7198`. Assert via DOM:
  - `.new-game` present, `.ng-title` text = "Commit Quest", a `.ng-btn` "Start Game" exists.
  - Click Start → `.ng-input` appears (name stage), the button reads "Begin Quest" and is `disabled` while empty.
  - Set the input value to "Tester" (fire input event) → the button enables → click it → `.new-game` is gone and `.companion`/`.scene` (the game) is shown. (Name won't persist over SSE — that's fine; `onStart` reveals the game.)

- [ ] **Step 3: Verify (with name).** Add `"name":"Gandalf"` to the fixture state.json (python3), refresh, navigate. Assert: `.new-game` splash shows, and clicking Start goes **straight** to the game (no `.ng-input` stage). Screenshot. Kill the server + `rm -rf app/.playwright-mcp .playwright-mcp`.

- [ ] **Step 4: Final sweep.** Run: `cd /Users/calypso/Project/Ottery/commit-quest/app && bun test 2>&1 | grep -E "pass|fail" | tail -1` and `cd app/extension && bun test 2>&1 | grep -E "pass|fail" | tail -1` and `cd /Users/calypso/Project/Ottery/commit-quest && bun run format 2>&1 | tail -1`. If Prettier changed tracked files, commit `style: prettier`.

---

## Self-Review (completed)

**Spec coverage:** Splash-every-open + `started` gate → Task 3 (app.tsx). setName action → Task 1. Persist setName (trim/cap/reject-empty) → Task 2. Splash → name conditional flow → Task 3 (`start`/`begin`). BG 400×128 + gradient fallback + scrim + title overlay → Task 4. Testing (host unit + browser flow + named-skip) → Tasks 2 + 5. Out-of-scope items untouched.

**Placeholder scan:** None. Task 2 Step 1 instructs reading the test fixture helper name (it varies by file) rather than guessing it — an explicit lookup, not a placeholder.

**Type consistency:** `ISetNameAction { type:"action"; name:"setName"; value:string }`, `TClientAction` union, `IRawAction.value?`, `applyAction` setName branch, `NewGameOverlay` props `{ state, dispatch, onStart }`, `stage: "splash" | "name"`, `.new-game/.ng-*` classes, `splash.png` — consistent across tasks. The dispatch payload in the overlay (`{ type:"action", name:"setName", value }`) matches `ISetNameAction`.

**Follow-up:** the user generates `splash.png` (400×128, prompt in the spec) → drop it at `app/public/splash.png`; the gradient fallback covers the gap until then.
