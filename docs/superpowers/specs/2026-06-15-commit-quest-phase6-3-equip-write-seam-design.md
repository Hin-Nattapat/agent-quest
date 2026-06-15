# Phase 6.3 — Equip from UI (the write seam) design

> **Status:** design approved 2026-06-15. Plan: `docs/superpowers/plans/`.
> The first time the companion **writes game state**: equip/unequip a title or theme from the Items
> panel. The webview only emits intent; the extension host performs the mutation through the same
> `core` functions the `rpg` CLI uses. Foundation for 6.4 (up-class/branch from UI).

## Goal

In the Items panel, each owned **title**/**theme** loot gets an **Equip** button. Click it → that
cosmetic equips (the gold ring moves, the portrait title updates) live. Click the currently-equipped
one → it unequips. No CLI needed.

## Architecture — "webview emits intent, the host writes"

```
Items panel button → transport.send({ type:"action", name:"equip", kind, id })   [postMessage → host]
host (extension.ts) receives → host-actions.applyAction(HOME, action):
   loadProfile → validate ownership → toggle the slot → saveProfile → reduceToFile(HOME)
   → reads the fresh state.json and postMessages it back immediately (state-feed watcher is a backup)
→ webview re-renders from the new state: equipped ring + portrait title update
```

Why this keeps the seam intact:
- **`app/src` (the webview) still never imports `core` or writes files** — it sends a message. The
  seam rule in `app/CLAUDE.md` governs the webview bundle, and it is unbroken.
- **The extension host is a Node process** (like `hud/` and the `rpg` CLI), not the sandboxed
  webview. It already reads `state.json`; importing `core` *runtime* there is the same as the CLI
  doing it. The host **reuses `loadProfile`/`saveProfile`/`reduceToFile`** — zero logic duplication —
  and esbuild bundles `core/*` into `dist/extension.js`, so the packaged `.vsix` works standalone
  (no `bun tools/rpg.ts` shell-out, which only exists in a dev checkout).

## The toggle (one action, no separate unequip)

The action always carries `{ kind, id }`. The host toggles the matching profile slot:

```ts
const slot = kind === EquipKind.Title ? "title" : "theme";
profile[slot] = profile[slot] === id ? undefined : id; // click-equipped → clear; click-other → switch
```

So clicking the equipped item clears it (unequip); clicking a different one switches. The webview
sends the same message either way; the button label reflects state (`Equipped` vs `Equip`).
Clearing a slot is `profile.title = undefined` — `saveProfile` omits it, the reducer resolves no
title. (Mirrors what `rpg title <id>` does, plus the clear path.)

## Components / files

| File | Responsibility | New/Mod |
|---|---|---|
| `app/src/actions.ts` | `EquipKind` enum + `TClientAction` (the webview↔host contract) | Create |
| `app/src/transport.ts` | add `send(action: TClientAction)` to `ITransport`; postMessage→host; SSE→no-op | Modify |
| `app/src/app.tsx` | derive `dispatch = transport.send`, pass to `SceneView` | Modify |
| `app/src/components/scene-view.tsx` | accept `dispatch`, forward to `PanelOverlay` | Modify |
| `app/src/components/panel-overlay.tsx` | forward `dispatch` to `ItemsPanel` | Modify |
| `app/src/components/items-panel.tsx` | per-item Equip/Equipped button for title/theme → `dispatch` | Modify |
| `app/extension/src/host-actions.ts` | `applyAction(home, action)` — validate + toggle + save + reduce; returns the new state text or an error | Create |
| `app/extension/src/extension.ts` | handle `message.type === "action"` → `applyAction` → post the new state | Modify |
| `app/src/styles.css` | equip button styling | Modify |

### `app/src/actions.ts`
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

### `transport.ts`
`ITransport` gains `send(action: TClientAction): void`. `postMessageTransport.send` →
`api.postMessage(action)`. `sseTransport.send` → no-op (browser-dev has no host to mutate; a future
6.x could add a bridge endpoint, out of scope). `selectTransport` is unchanged.

### `items-panel.tsx`
Threaded a `dispatch: (a: TClientAction) => void`. A loot item shows a button only when
`item.kind === "title" || item.kind === "theme"`:
- not equipped → **Equip** → `dispatch({ type:"action", name:"equip", kind, id })`
- equipped → **Equipped** (still clickable; the same dispatch toggles it off)

`skin` items get no button (no equip path in core). Prop-drill `dispatch`:
`app.tsx → SceneView → PanelOverlay → ItemsPanel` (Sidebar/NavBar don't need it).

### `host-actions.ts` (Node, imports `core` at runtime — allowed in the host)
```ts
export const applyAction = (home: string, action: TClientAction): string | null => { … }
```
For `equip`: `loadProfile(home)`; resolve the loot row from `LOOT_TABLE[id]`, require it exists and
its `kind` matches the action `kind`; require `id` is in the current `reduceToFile(home).inventory`
(ownership, like the CLI); toggle the slot; `saveProfile(home, profile)`; `reduceToFile(home)`;
return the fresh `state.json` text (for an immediate push). On any validation failure: return `null`
(host logs, no state change). Title items resolve their loot row by id from `LOOT_TABLE` the same as
themes — both are owned inventory entries.

### `extension.ts`
In `onDidReceiveMessage`, add: if `message.type === "action"`, call `applyAction(HOME, message)`; if
it returns text, `webview.postMessage({ type:"state", json: text })` (immediate). The existing
`watchState` feed also fires on the `state.json` write — harmless (idempotent, same payload).

## Data flow & error handling

- **Validation lives in the host** (ownership + kind match), mirroring `rpg equip`; the UI only
  renders buttons for owned title/theme items, so failures are rare.
- **Invalid/failed action** → `applyAction` returns `null`, host logs to its output channel, no state
  change. No webview error UI in 6.3 (no toast).
- **Browser-dev (SSE) mode** → `send` is a no-op (no host). Buttons render but do nothing; the real
  surface is the VS Code extension. (Acceptable; documented.)
- **Concurrency** with the statusline's `reduceThrottled`: the host `saveProfile`s **before**
  `reduceToFile`, so any concurrent reduce reads the new profile; `state.json` writes are atomic
  (tmp+rename) and the reduce is idempotent → the two converge on the same output.
- **Old/missing profile fields** → `loadProfile` already defaults; clearing a slot via `undefined` is
  safe.

## Testing

- **`transport.ts`** (bun): `postMessageTransport.send(action)` calls `api.postMessage` with the
  action (extends the existing `transport.test.ts` postMessage coverage); `sseTransport.send` is a
  no-op (no throw).
- **`host-actions.applyAction`** (bun, temp HOME like `test/tools/rpg.test.ts`): seed a journal +
  profile + an owned title in inventory; `applyAction(home, {equip title})` → `profile.json` gets the
  title and the reduced `state.inventory` marks it `equipped`; a second identical call **clears** it
  (toggle); an unowned id → returns `null` and leaves the profile unchanged.
- **Items panel / overlay**: presentational + interaction — verified visually in the VS Code panel
  (Equip a title → ring moves + portrait title updates; click again → unequips).

## Scope / non-goals

- **Title + theme only** (the two `LootKind`s core can equip). **Up-class / branch pick = 6.4** (same
  seam, next checkpoint). `skin` has no equip path.
- **No optimistic UI** — the button dispatches and waits for the host's state push (round-trip is
  local + fast). No error toast.
- **No browser-SSE write path** — `send` no-ops there.
- **No new game logic** — the host reuses `core` equip/reduce verbatim; only the transport + a host
  dispatcher + the Items buttons are new.
