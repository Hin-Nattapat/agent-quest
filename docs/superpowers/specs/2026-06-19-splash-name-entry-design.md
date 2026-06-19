# Splash / Start screen + Name entry — Design

**Status:** approved
**Date:** 2026-06-19
**Scope:** `app/` companion (a new-game overlay + a `setName` webview action). One core-adjacent touch: the extension host action handler. No reducer change (the `name` already flows from `profile.json`).

## Goal

A pixel-art **title screen** shows each time the companion panel opens: a full-panel background image, the game title, and a **Start Game** button. If the player has no name yet, Start leads to a **name-entry** step that persists the name; otherwise Start drops straight into the game. After Start, the panel shows the normal game for the rest of that session (reopening shows the splash again).

## Why

The panel currently boots straight into the battle/guild view, and there is no way to set the adventurer's name from the UI (it defaults to "Adventurer"; only the `rpg name` CLI sets it). A title screen makes opening the panel feel like starting a game, and the name-entry closes the gap so a new player actually names their character.

## Decisions (settled during brainstorming)

- **Splash every open** (option ข), not just first-run. A session-scoped `started` flag (React state, not persisted) gates it: each webview mount shows the splash until Start is clicked.
- **Name entry is conditional**: Start → if `state.name` is set, go straight to the game; if not, show the name step first.
- **Background image is 400×128** (the scene size, user-generated in PixelLab), at `app/public/splash.png`; rendered `cover` over the full panel with a themed gradient fallback until the art lands. The title text is HTML overlay, not baked into the image.
- **`setName` mirrors the rpg CLI**: `profile.name = value.trim().slice(0, 24)`. Empty (after trim) is rejected (the Begin button stays disabled).
- **Persistence path**: the VS Code extension applies the action (`host-actions.applyAction` → write profile → re-reduce). The browser/SSE dev transport's `send` is a no-op, so name persistence is verified by a host-actions unit test; the overlay *flow* is verified in the browser.

## Flow

```
panel opens (webview mounts)
   started = false  →  ┌─ Splash: BG image + "Commit Quest" + [▶ Start Game]
                       │     Start →  state.name set?  ── yes ──►  onStart()  ─┐
                       │                     │ no                               │
                       │                     ▼                                  │
                       └─ Name entry: [input ≤24] + [Begin Quest]              │
                              Begin → dispatch setName(value); onStart() ──────┤
                                                                                ▼
                                                            started = true → game (SceneView)
```

## Components

### 1. Action — `app/src/actions.ts`

```ts
export interface ISetNameAction {
  type: "action";
  name: "setName";
  value: string;
}
export type TClientAction = IEquipAction | ISetClassAction | ISetBranchAction | ISetNameAction;
```

### 2. Host handler — `app/extension/src/host-actions.ts`

In `applyAction`, before the equip branch:
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
`IRawAction` gains an optional `value?: string`. Unit-tested in `host-actions.test.ts`.

### 3. Overlay — `app/src/components/new-game-overlay.tsx` (new)

Props: `{ state, dispatch, onStart }`. Internal `stage: "splash" | "name"` + a controlled `value`.
- **splash**: BG + `<h1>Commit Quest</h1>` + a tagline + a **Start Game** button. Click → if `state.name` then `onStart()`, else `setStage("name")`.
- **name**: a label, an `<input maxLength={24}>`, and a **Begin Quest** button (disabled while `value.trim()` is empty). Submit → `dispatch({ type: "action", name: "setName", value })` then `onStart()`.

### 4. Gate — `app/src/app.tsx`

```ts
const [started, setStarted] = useState(false);
// …after the !state loading guard…
if (!started) {
  return <NewGameOverlay state={state} dispatch={transport.send} onStart={() => setStarted(true)} />;
}
return <SceneView … />;
```

### 5. Styling + asset — `app/src/styles.css`, `app/public/splash.png`

`.new-game` full-panel layer (`position: absolute; inset: 0`), BG `url(/splash.png) center/cover` with a dusk-purple→gold gradient fallback, dark scrim for text legibility (AA), centered column: `.ng-title` (display font), `.ng-tagline` (dim), `.ng-btn` (gold, hover/active/focus states), `.ng-input` (pixel field). Honor `prefers-reduced-motion` for any entrance.

### BG prompt (PixelLab create-image-flux, 400×128, no-text)

```
a pixel-art title-screen vista for a fantasy coding RPG: a lone hooded adventurer seen from behind standing on a grassy cliff at golden dawn, gazing toward a distant brass-trimmed wizard's guild tower and misty mountains, warm gold light breaking over a dusk-purple sky, a few glowing embers drifting, epic and inviting, muted aged retro-MMORPG palette of dusk purple, brass gold and teal, clean pixel art, no text, no UI
```

## Data flow

overlay `Begin` → `dispatch(setName)` → (extension) `host-actions.applyAction` → `profile.name` → `reduceToFile` → new state with `name` → SSE/postMessage → `displayName` resolves to it. `onStart()` flips the local `started` flag so the panel shows the game regardless of the transport round-trip.

## Fallbacks / edge cases

- No `splash.png` yet → the gradient fallback shows; the title + button still work.
- Browser/SSE dev → `send` is a no-op, so the name won't persist there; the overlay still advances via `onStart()`. (Extension persists for real.)
- Whitespace-only name → Begin disabled; never dispatched.
- `prefers-reduced-motion` → no entrance animation.

## Testing

- **host-actions unit test**: `applyAction(home, { name: "setName", value: "  Gandalf  " })` writes `profile.name === "Gandalf"`; an over-long value is capped to 24; an empty/whitespace value returns `null` and leaves the profile unchanged.
- **Browser**: panel mount shows `.new-game` splash; Start with no name → name step; typing + Begin dispatches setName and reveals the game; a fixture **with** a name → Start skips straight to the game.

## Out of scope

Persisting "already started" across panel reopens (intentionally re-shows the splash), name editing after onboarding (the rpg CLI / a future settings field), class selection on the splash (kept at its existing Lv.5 flow), and animated splash art.
