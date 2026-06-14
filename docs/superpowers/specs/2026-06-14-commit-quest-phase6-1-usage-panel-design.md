# Phase 6.1 — Usage / Stats panel design

> **Status:** design approved 2026-06-14. Plan: `docs/superpowers/plans/`.
> A fifth nav panel — a **read-only usage dashboard** rendered from `state.stats` (by-repo,
> tool mix, command tally, totals). No core change; realtime for free via the existing state feed.
> First checkpoint of "Phase 6 — Interactive Companion" (the rest add a UI write path; this one
> stays a pure consumer).

## Goal

Click the **📊 Usage** nav button → an overlay panel (same chrome as Hero/Items/Codex) shows where
and how the player has been working, live: repos conquered, tool mix, notable git deeds, and lifetime
totals — all from the stats the reducer already aggregates into `state.json`.

## Constraints

- **Read-only, app-only.** Reads `state.stats` (already fully typed on `IState`); **no `core`/reducer
  change**. Same seam as the other panels.
- **Realtime is inherited, not built.** `state.json` is re-reduced by the Claude Code statusline
  (`hud/statusline.ts` → `reduceThrottled`), the extension's `state-feed` watches it and
  postMessages, and an open panel re-renders on each push. The Usage panel needs nothing extra to be
  live. (Caveat, out of scope: under a non-Claude-Code agent nothing triggers the reduce, so the HUD
  is static there — that is Phase 5 adapter territory, unrelated to this panel.)
- **Match the panel pattern** from 3.6 (`PanelId` + `panel-overlay` routing + `nav-bar` button +
  presentational component reading `IState`).
- **No cost/tokens** — not captured into `state.json` today; deferred to a separate 6.1b. No
  per-session/task timeline — the journal isn't retained in state.

## Architecture

```
state.stats { by_repo, actions, cmds, prompts, sessions, action_fails, boss_defeated, boss_fled }
state.streak.best_days
        │  (already on IState — type-only import; no reducer change)
        ▼
UsagePanel (presentational)  ── 4 sections ──►  overlay window
   Realms Conquered (by_repo, sorted by xp)
   Tool Mix          (actions, bars scaled to the max)
   Command Tally     (cmds, sorted desc, cmdLabel() for readable names)
   Totals            (prompts / sessions / actions / fails / bosses / best streak)

nav button 📊 Usage → scene-view's panel state (existing) → <PanelOverlay> routes to <UsagePanel>
```

## Pure helpers (`view.ts`, unit-tested)

```ts
// Readable label for a CmdTag value (core/events CmdTag). Falls back to Title Case for unknown tags.
export const cmdLabel = (tag: string): string => { … };

// Entries of a Record<string, number> sorted by value desc (stable), for repo/cmd/tool lists.
export const byCountDesc = (rec: Record<string, number>): [string, number][] => { … };
```

`cmdLabel` map (the 10 known `CmdTag` values; unknown → Title-Cased from the snake_case key):
| tag | label |
|---|---|
| `git_rebase_onto` | Rebase Onto |
| `git_rebase_i` | Interactive Rebase |
| `cherry_pick` | Cherry-Picks |
| `force_push` | Force Pushes |
| `bisect` | Bisects |
| `reflog` | Reflog Dives |
| `stash` | Stashes |
| `pr_merge` | PR Merges |
| `cowboy` | Cowboy Commits |
| `test_run` | Test Runs |

`by_repo` is `Record<string, IGroupStat>` (`{ xp, sessions }`), so the panel sorts its entries by
`xp` inline (not via `byCountDesc`, which is for `Record<string, number>` — used by Tool Mix and
Command Tally).

## The panel (`usage-panel.tsx`)

Presentational, props `{ state: IState }`. Four labelled sections:

- **⚔ Realms Conquered** — `Object.entries(state.stats.by_repo)` sorted by `xp` desc: each row =
  repo name · `{xp} xp` · `{sessions} sessions`. Empty → "No realms yet…".
- **🛠 Tool Mix** — `byCountDesc(state.stats.actions)`: each row = tool name + a bar whose width =
  `count / max * 100%` + the count. (`max` = largest action count; guard divide-by-zero.)
- **📜 Command Tally** — `byCountDesc(state.stats.cmds ?? {})`: each row = `cmdLabel(tag)` + count.
  Empty → "No notable deeds logged…". (Distinct from Codex, which lists *earned achievements*; this
  is the raw tagged-command activity.)
- **📊 Totals** — a stat grid: prompts, sessions, total actions (`sum(actions)`), action_fails,
  🐉 `boss_defeated` / `boss_fled`, 🔥 `streak.best_days`.

## Components / files

| File | Responsibility | New/Mod |
|---|---|---|
| `app/src/panels.ts` | add `PanelId.Usage = "usage"` | Modify |
| `app/src/view.ts` | add `cmdLabel` + `byCountDesc` (pure) | Modify |
| `app/src/view.test.ts` | tests for `cmdLabel` + `byCountDesc` | Modify |
| `app/src/components/usage-panel.tsx` | the 4-section dashboard | Create |
| `app/src/components/nav-bar.tsx` | add 5th button `{ id: Usage, label: "Usage" }` | Modify |
| `app/src/components/panel-overlay.tsx` | `TITLES[Usage] = "Usage"` + route `activePanel === Usage ? <UsagePanel/>` | Modify |
| `app/src/styles.css` | usage-panel sections: repo list, tool bars, cmd tally, totals grid | Modify |

The nav grid currently holds 4 buttons (2×2); a 5th makes it 2×3 with one cell trailing — acceptable
(the grid auto-flows; an impeccable polish pass can balance it later if desired).

## Data flow & edge cases

- Old `state.json` without `cmds` / `boss_*` / `streak`: every read is guarded
  (`?? {}` / `?? 0`), so missing fields render zeros / empty states, never crash.
- Empty `by_repo` / `cmds`: teaching empty states.
- Tool Mix with all-zero actions: bars render at 0 width (no divide-by-zero — guard `max || 1`).
- Realtime: the panel reads `state` (the prop); when the feed pushes a new state the app re-renders
  and the open panel updates — no panel-specific wiring.

## Testing

- **`cmdLabel`** (bun): known tags → their mapped labels; an unknown tag (`"foo_bar"`) →
  `"Foo Bar"` (Title Case).
- **`byCountDesc`** (bun): sorts entries by value descending; stable for ties; empty record → `[]`.
- **Panel / nav / overlay**: presentational + interaction — verified visually in the VS Code panel
  (open Usage, see the four sections populate from the live state, Esc/X/backdrop close).

## Scope / non-goals

- **No core/reducer change** — `state.stats` already carries everything.
- **No cost/tokens** (not in state; separate 6.1b) and **no per-session/task timeline** (not retained).
- **No write actions** — read-only; equip/settings are later 6.x checkpoints.
- **Not the CLI-ergonomics work** (`rpg` PATH wrapper + shell completion) — a separate small task,
  unrelated to this panel.
