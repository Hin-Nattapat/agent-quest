# Phase 6.3 — Equip from UI (write seam) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the companion equip/unequip a title or theme from the Items panel — the first time the UI writes game state — by having the extension host mutate `profile.json` + re-reduce, reusing the same `core` functions as the `rpg` CLI.

**Architecture:** The webview emits an intent (`transport.send` → `postMessage`); the extension host (a Node process, like the CLI) validates ownership and toggles the profile slot via `core/profile` + `core/reduce`, then pushes the fresh state back. `app/src` (the webview) never imports `core` or writes files — the seam holds. esbuild bundles `core/*` into `dist/extension.js` so the packaged `.vsix` is standalone.

**Tech Stack:** TypeScript, Bun (`bun test`), React 19 (Vite) webview, esbuild extension host, VS Code webview `postMessage`.

**Spec:** `docs/superpowers/specs/2026-06-15-commit-quest-phase6-3-equip-write-seam-design.md`

---

## Context for the implementer

- **Ownership model (verified):** the Items panel renders `state.inventory` only. So for BOTH title and theme the host validates uniformly: **`id` ∈ inventory AND `LOOT_TABLE[id].kind` matches the action kind**. (The CLI's title path also accepts achievement-reward titles, which aren't in inventory and so are out of scope here.)
- **The mutation path the host reuses** (from `tools/rpg.ts`): `loadProfile(home)` / `saveProfile(home, profile)` (`core/profile`), `reduceToFile(home)` (`core/reduce`, reads journal+config+profile → writes `state.json`, returns the state), `LOOT_TABLE` + `LootKind` (`core/loot`).
- **Seam:** `app/src` (webview bundle) stays pure — it sends a message. The extension host (`app/extension/src`, Node) may import `core` at runtime, exactly like `hud/` and the CLI. Don't import `core` from `app/src`.
- **Transports** (`app/src/transport.ts`): `postMessageTransport` (VS Code) and `sseTransport` (browser dev) both implement `ITransport`. The webview→host channel already carries `{ type:"ready" }`; host→webview carries `{ type:"state", json }`.
- **Tests:** `bun test` from repo root runs every `*.test.ts` (incl. `app/extension/src/*.test.ts`). Read results with `bun test 2>&1 | grep -E "pass|fail"` — never `tail`. The host test reuses the `seedOneClean` + `rollDrop` deterministic-drop pattern from `test/tools/rpg.test.ts`.

---

## Task 1: Action contract + `transport.send`

**Files:**
- Create: `app/src/actions.ts`
- Modify: `app/src/transport.ts`
- Test: `app/src/transport.test.ts`

- [ ] **Step 1: Create `app/src/actions.ts` (the webview→host contract)**

```ts
export enum EquipKind {
  Title = "title",
  Theme = "theme",
}

export interface IEquipAction {
  type: "action";
  name: "equip";
  kind: EquipKind;
  id: string;
}

export type TClientAction = IEquipAction;
```

- [ ] **Step 2: Write the failing test** — append to `app/src/transport.test.ts` (add `EquipKind` import from `./actions` at the top):

```ts
import { EquipKind } from "./actions";

test("postMessageTransport.send posts the action; sseTransport.send is a no-op", () => {
  const posted: unknown[] = [];
  const api = { postMessage: (m: unknown) => posted.push(m) };
  const fake = new FakeTarget();
  const t = postMessageTransport(api, fake as unknown as IMessageTarget);
  t.send({ type: "action", name: "equip", kind: EquipKind.Title, id: "rookie" });
  expect(posted).toEqual([{ type: "action", name: "equip", kind: "title", id: "rookie" }]);

  // SSE has no host to write to: send must exist and do nothing (no throw).
  const sse = sseTransport("/events", () => new FakeSource() as unknown as EventSource);
  expect(() => sse.send({ type: "action", name: "equip", kind: EquipKind.Theme, id: "x" })).not.toThrow();
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `cd app && bun test src/transport.test.ts 2>&1 | grep -E "pass|fail"`
Expected: FAIL — `ITransport.send` doesn't exist.

- [ ] **Step 4: Add `send` to `transport.ts`**

Add the import at the top:
```ts
import type { TClientAction } from "./actions";
```
Extend the interface:
```ts
export interface ITransport {
  // Calls onState with the latest state, then on every change. Returns an unsubscribe fn.
  subscribe(onState: (state: IState) => void): () => void;
  // Send an intent to the host (equip, …). No-op where there is no host (browser/SSE).
  send(action: TClientAction): void;
}
```
In `postMessageTransport`'s returned object, add (alongside `subscribe`):
```ts
    send(action) {
      api.postMessage(action);
    },
```
In `sseTransport`'s returned object, add (alongside `subscribe`):
```ts
    send() {
      // browser/SSE dev has no host to mutate; a write bridge could be added later
    },
```

- [ ] **Step 5: Run to verify it passes + full app suite**

Run: `cd app && bun test src/transport.test.ts 2>&1 | grep -E "pass|fail"` → PASS.
Run: `cd app && bunx tsc --noEmit 2>&1 | grep -E "error TS" | head` → no output.

- [ ] **Step 6: Commit**

```bash
git add app/src/actions.ts app/src/transport.ts app/src/transport.test.ts
git commit -m "feat(app): client action contract + transport.send (intent channel)"
```

---

## Task 2: Host `applyAction` (the mutation)

**Files:**
- Create: `app/extension/src/host-actions.ts`
- Test: `app/extension/src/host-actions.test.ts`

The host validates raw messages itself (imports only `core`, not `app/src`), so the wire stays loose JSON.

- [ ] **Step 1: Write the failing test — create `app/extension/src/host-actions.test.ts`:**

```ts
import { test, expect } from "bun:test";
import { mkdirSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";
import { makeHome } from "../../../test/helpers";
import { rollDrop, LOOT_TABLE, LootKind } from "../../../core/loot";
import { applyAction } from "./host-actions";

// Zero-weight config so a single session_end is the only trigger: one deterministic clean drop.
function seedOneClean(home: string) {
  writeFileSync(
    join(home, "config.json"),
    JSON.stringify({
      xp: {
        weights: {
          prompt: 0,
          turn_end: 0,
          session_end: 0,
          actions: { edit: 0, write: 0, run: 0, read: 0, search: 0, delegate: 0, other: 0 },
        },
      },
    }),
  );
  const dir = join(home, "journal");
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "s.ndjson"),
    `{"ts":"2026-06-11T12:00:00Z","source":"claude-code","session_id":"s","type":"session_end","repo":"cq"}\n`,
  );
}

const profile = (home: string) => JSON.parse(readFileSync(join(home, "profile.json"), "utf8"));

test("applyAction equips an owned title/theme, then toggles it off; rejects unowned", () => {
  const home = makeHome();
  seedOneClean(home);
  const droppedId = rollDrop({ trigger: { table: "clean", seed: "clean:s" } })!;
  const kind = LOOT_TABLE[droppedId].kind;

  if (kind === LootKind.Title || kind === LootKind.Theme) {
    const slot = kind === LootKind.Title ? "title" : "theme";

    const s1 = applyAction(home, { name: "equip", kind, id: droppedId });
    expect(s1).not.toBeNull();
    expect(profile(home)[slot]).toBe(droppedId); // equipped

    const s2 = applyAction(home, { name: "equip", kind, id: droppedId });
    expect(s2).not.toBeNull();
    expect(profile(home)[slot]).toBeUndefined(); // toggled off
  }

  const unowned = Object.keys(LOOT_TABLE).find(
    id => id !== droppedId && LOOT_TABLE[id].kind === LootKind.Theme,
  )!;
  const before = profile(home);
  const bad = applyAction(home, { name: "equip", kind: "theme", id: unowned });
  expect(bad).toBeNull();
  expect(profile(home)).toEqual(before); // unchanged
});
```

(`makeHome` writes an empty `profile.json` lazily via `loadProfile`/`saveProfile`; reading it before any save may 404 — the test only reads `profile(home)` after a successful `applyAction` or for the `before` snapshot which follows the toggle block, by which point a profile exists. If `profile(home)` throws because the file is absent in the unowned-only path, guard the `before` read with the same try the helpers use; in practice the toggle block above runs for the clean-table drop, creating the file.)

- [ ] **Step 2: Run to verify it fails**

Run: `bun test app/extension/src/host-actions.test.ts 2>&1 | grep -E "pass|fail"`
Expected: FAIL — `host-actions` module / `applyAction` not found.

- [ ] **Step 3: Implement `app/extension/src/host-actions.ts`**

```ts
import { loadProfile, saveProfile } from "../../../core/profile";
import { reduceToFile } from "../../../core/reduce";
import { LOOT_TABLE, LootKind } from "../../../core/loot";
import { readStateText } from "./state-feed";

interface IRawAction {
  name?: string;
  kind?: string;
  id?: string;
}

const LOOT_KIND: Record<string, LootKind> = {
  title: LootKind.Title,
  theme: LootKind.Theme,
};

// Apply an equip/unequip toggle from the webview, mirroring the rpg CLI: validate ownership, set the
// matching profile slot, re-reduce. Returns the fresh state.json text on success, null on bad input.
export const applyAction = (home: string, action: IRawAction): string | null => {
  if (action.name !== "equip") {
    return null;
  }
  const kind = action.kind ? LOOT_KIND[action.kind] : undefined;
  const id = action.id;
  if (!kind || !id) {
    return null;
  }
  const row = LOOT_TABLE[id];
  if (!row || row.kind !== kind) {
    return null;
  }
  const owned = new Set((reduceToFile(home).inventory ?? []).map(i => i.id));
  if (!owned.has(id)) {
    return null;
  }

  const profile = loadProfile(home);
  if (kind === LootKind.Title) {
    profile.title = profile.title === id ? undefined : id;
  } else {
    profile.theme = profile.theme === id ? undefined : id;
  }
  saveProfile(home, profile);
  reduceToFile(home);
  return readStateText(home);
};
```

- [ ] **Step 4: Run to verify it passes**

Run: `bun test app/extension/src/host-actions.test.ts 2>&1 | grep -E "pass|fail"` → PASS, 0 fail.
Run: `cd app/extension && bunx tsc --noEmit 2>&1 | grep -E "error TS" | head` → no output (the `../../../core` imports type-check under `--noEmit`).

- [ ] **Step 5: Commit**

```bash
git add app/extension/src/host-actions.ts app/extension/src/host-actions.test.ts
git commit -m "feat(ext): host applyAction — equip/unequip toggle via core (write seam)"
```

---

## Task 3: Wire the host message handler

**Files:**
- Modify: `app/extension/src/extension.ts`
- (No new unit test — integration glue; verified by build + the host-actions unit test + the panel.)

- [ ] **Step 1: Handle the `action` message in `extension.ts`**

Add the import near the other `./` imports:
```ts
import { applyAction } from "./host-actions";
```
Replace the existing `onDidReceiveMessage` callback with one that also handles actions (the current one only handles `ready`):

```ts
  const messageSub = webview.onDidReceiveMessage(
    (message: { type?: string; name?: string; kind?: string; id?: string }) => {
      if (message.type === "ready") {
        const text = readStateText(HOME);
        if (text) {
          webview.postMessage({ type: "state", json: text });
        }
        return;
      }
      if (message.type === "action") {
        const text = applyAction(HOME, message);
        if (text) {
          webview.postMessage({ type: "state", json: text });
        }
      }
    },
  );
```

(The existing `watchState` feed still fires on the `state.json` write `applyAction` performs — harmless, same idempotent payload. The immediate post above is just lower-latency.)

- [ ] **Step 2: Build the extension host (confirms esbuild bundles `core`)**

Run: `cd app/extension && npm run build 2>&1 | tail -3`
Expected: esbuild succeeds; `dist/extension.js` rebuilt (now larger — it bundles `core/*`).
Run: `cd app/extension && bunx tsc --noEmit 2>&1 | grep -E "error TS" | head` → no output.

- [ ] **Step 3: Commit**

```bash
git add app/extension/src/extension.ts
git commit -m "feat(ext): route action messages to applyAction, push fresh state"
```

---

## Task 4: Equip buttons in the Items panel (thread `dispatch`)

**Files:**
- Modify: `app/src/app.tsx`
- Modify: `app/src/components/scene-view.tsx`
- Modify: `app/src/components/panel-overlay.tsx`
- Modify: `app/src/components/items-panel.tsx`
- Modify: `app/src/styles.css`

- [ ] **Step 1: `app.tsx` — derive `dispatch` from the transport, pass to `SceneView`**

```tsx
import type { ITransport } from "./transport";
import { useGameState } from "./use-game-state";
import { useActivity } from "./use-activity";
import SceneView from "./components/scene-view";

interface IProps {
  transport: ITransport;
}

const App = (props: IProps) => {
  const { transport } = props;
  const state = useGameState(transport);
  const activity = useActivity(state);

  if (!state) {
    return <div className="loading">Connecting…</div>;
  }

  return <SceneView state={state} activity={activity} dispatch={transport.send} />;
};

export default App;
```

- [ ] **Step 2: `scene-view.tsx` — accept `dispatch`, forward to `PanelOverlay`**

Add to the imports:
```ts
import type { TClientAction } from "../actions";
```
Extend `IProps`:
```ts
interface IProps {
  state: IState;
  activity: ActivityState;
  dispatch: (action: TClientAction) => void;
}
```
Destructure it (`const { state, activity, dispatch } = props;`) and pass it to the overlay (change the existing `<PanelOverlay …>` line):
```tsx
        <PanelOverlay
          activePanel={panel}
          state={state}
          onClose={() => setPanel(null)}
          dispatch={dispatch}
        />
```

- [ ] **Step 3: `panel-overlay.tsx` — forward `dispatch` to `ItemsPanel`**

Add the import:
```ts
import type { TClientAction } from "../actions";
```
Extend `IProps`:
```ts
interface IProps {
  activePanel: PanelId | null;
  state: IState;
  onClose: () => void;
  dispatch: (action: TClientAction) => void;
}
```
Destructure `dispatch` (`const { activePanel, state, onClose, dispatch } = props;`) and pass it to the Items render branch (change that one line):
```tsx
        {activePanel === PanelId.Items ? <ItemsPanel state={state} dispatch={dispatch} /> : null}
```

- [ ] **Step 4: `items-panel.tsx` — render Equip/Equipped buttons for title/theme**

Replace the whole file:
```tsx
import type { IState } from "../../../core/state";
import { EquipKind, type TClientAction } from "../actions";

interface IProps {
  state: IState;
  dispatch: (action: TClientAction) => void;
}

const KIND_ICON: Record<string, string> = { title: "👑", theme: "🎨", skin: "👕" };

// Inventory title/theme items are equippable; skins have no equip path in core.
const equipKindOf = (kind: string | undefined): EquipKind | null => {
  if (kind === "title") {
    return EquipKind.Title;
  }
  if (kind === "theme") {
    return EquipKind.Theme;
  }
  return null;
};

const ItemsPanel = (props: IProps) => {
  const { state, dispatch } = props;
  const inv = state.inventory ?? [];

  return (
    <div className="panel-body items-panel">
      <div className="panel-head">Inventory · {inv.length} items</div>
      {inv.length === 0 ? (
        <div className="panel-empty">No loot yet…</div>
      ) : (
        <div className="item-grid">
          {inv.map(item => {
            const ek = equipKindOf(item.kind);
            return (
              <div
                key={item.id}
                className={`item-slot rarity-${item.rarity}${item.equipped ? " equipped" : ""}`}
              >
                <span className="item-icon">{KIND_ICON[item.kind ?? "title"] ?? "❔"}</span>
                <span className="item-count">×{item.count}</span>
                <span className="item-name">{item.name ?? item.id}</span>
                {ek ? (
                  <button
                    type="button"
                    className={`item-equip${item.equipped ? " is-equipped" : ""}`}
                    onClick={() =>
                      dispatch({ type: "action", name: "equip", kind: ek, id: item.id })
                    }
                  >
                    {item.equipped ? "Equipped" : "Equip"}
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ItemsPanel;
```

- [ ] **Step 5: `styles.css` — equip button (append near the items-panel rules; search `.item-slot` and add after that block)**

```css
.item-equip {
  margin-top: 4px;
  font-family: "Pixelify Sans", monospace;
  font-size: 10px;
  padding: 2px 8px;
  color: var(--ink);
  background: var(--gold-soft);
  border: 1px solid var(--ink);
  border-radius: 2px;
  cursor: pointer;
}
.item-equip:hover {
  background: var(--gold);
}
.item-equip.is-equipped {
  background: var(--panel-dark);
  color: var(--gold-soft);
  border-color: var(--gold);
}
```

- [ ] **Step 6: Type-check + full suite + grep**

Run: `cd app && bunx tsc --noEmit 2>&1 | grep -E "error TS" | head` → no output.
Run: `bun test 2>&1 | grep -E "pass|fail" | tail -2` → all pass, 0 fail.
Run: `grep -rn "dispatch" app/src/components/items-panel.tsx app/src/components/panel-overlay.tsx app/src/components/scene-view.tsx app/src/app.tsx` → a match in each.

- [ ] **Step 7: Commit**

```bash
git add app/src/app.tsx app/src/components/scene-view.tsx app/src/components/panel-overlay.tsx app/src/components/items-panel.tsx app/src/styles.css
git commit -m "feat(app): Equip/Equipped buttons in the Items panel (dispatch intent)"
```

- [ ] **Step 8: Visual verification (report, do not automate)**

Report for the human: `cd app/extension && npm run reinstall`, reload the window, open **Items** → each title/theme shows **Equip**; click one → its gold ring appears + the portrait title updates (host round-trip); click the equipped one → it unequips.

---

## Self-Review

**Spec coverage:**
- `actions.ts` contract + `transport.send` (postMessage / SSE no-op) → Task 1. ✅
- Host `applyAction` toggle + ownership validation (reuse `core`) → Task 2. ✅
- `extension.ts` routes `action` → applyAction → push state → Task 3. ✅
- `dispatch` threaded app→scene-view→panel-overlay→items-panel; Equip/Equipped buttons (title/theme only, skin none) → Task 4. ✅
- Seam intact (webview sends intent; host imports `core`; esbuild bundles it) → Tasks 2–3. ✅
- Toggle (click-equipped → clear; click-other → switch) → Task 2 `applyAction`. ✅
- Testing: transport.send (Task 1), applyAction temp-home (Task 2), visual (Task 4). ✅
- Scope: title+theme only; no optimistic UI/toast; browser-SSE no-op → all tasks. ✅

**Placeholder scan:** none — every step has full code.

**Type consistency:** `EquipKind` / `TClientAction` / `IEquipAction` defined in `actions.ts` (Task 1) and consumed identically in `transport.ts` (Task 1), `scene-view`/`panel-overlay`/`items-panel`/`app.tsx` (Task 4). `applyAction(home, IRawAction): string | null` defined in Task 2, consumed in Task 3 with a `{ type, name, kind, id }` message (extra `type` field ignored by `IRawAction`). The host validates `kind` via `LOOT_KIND` (string→`LootKind`); `EquipKind` values ("title"/"theme") equal `LootKind` values, so the wire is consistent. `dispatch: (action: TClientAction) => void` matches `transport.send`'s signature.

**Note:** Task 3 is integration glue (no unit test); Task 4 is presentational + prop-threading. The two pure/tested units are Task 1 (transport.send) and Task 2 (applyAction — the actual mutation), which is where the risk is.
