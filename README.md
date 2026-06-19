<p align="center">
  <img src="app/public/splash.png" alt="Commit Quest" width="640">
</p>

<h1 align="center">Commit Quest</h1>

<p align="center">
  <em>Your AI coding sessions, gamified into a retro pixel RPG.</em>
</p>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=natpat.commit-quest-companion"><img alt="VS Code Marketplace" src="https://img.shields.io/visual-studio-marketplace/v/natpat.commit-quest-companion?label=VS%20Code%20Marketplace&color=6b2a7a"></a>
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-cdae57"></a>
  <img alt="Runtime" src="https://img.shields.io/badge/runtime-bun%20%2B%20jq-2a2118">
  <img alt="For Claude Code" src="https://img.shields.io/badge/for-Claude%20Code-d4a017">
</p>

---

Commit Quest turns every Claude Code session into character progression. As you prompt, edit, run
commands and ship code, a hook pipeline records the session as an append-only event journal, folds it
into an RPG character — class, level, XP, streak, loot, boss fights, achievements — and shows it in a
**live pixel-art companion panel** inside VS Code (plus a one-line status bar HUD).

It is **ambient and read-only**: you never operate it as a task. You glance at it between turns and it
feels good. Think a beloved old 2D-MMO HUD (Tibia / RuneScape era), sitting quietly next to your code.

## Features

- 🧙 **A character that levels with your work** — classes (Mage · Ranger · Rogue · Sage + secret
  lines) that advance through tiers T1→T4 with branching forms, earned from real session events.
- 🪙 **Loot, boss fights & achievements** — rate-based encounters drop gear; medieval "deeds" unlock
  equippable titles. All derived from events, never random theater.
- 🏰 **Animated AFK scene** — your hero farms, rests in the **guild hall** (with NPCs), and battles
  through tier realms. Real PixelLab sprites for the four main lines.
- 📊 **Status-bar HUD** — `Lv.N ███░░ %  ·  model  ·  $cost  ·  ctx %` in the Claude Code status line.
- 🔌 **Clean architecture** — agent-awareness lives only in adapters; the engine is a pure reducer
  over a normalized event contract. No runtime npm dependencies (just `bun` + `jq`).

## Requirements

- [Claude Code](https://claude.com/claude-code)
- [Bun](https://bun.sh) and [`jq`](https://jqlang.github.io/jq/) on your `PATH`
- [VS Code](https://code.visualstudio.com/) (for the companion panel)

## Install

**1 — Install the engine** (the hooks + reducer + CLI):

```bash
curl -fsSL https://raw.githubusercontent.com/Hin-Nattapat/commit-quest/main/scripts/bootstrap.sh | bash
```

This clones the repo, deploys into `~/.agentrpg`, and prints a Claude Code settings snippet.

**2 — Wire Claude Code:** merge the printed `hooks` + `statusLine` snippet into
`~/.claude/settings.json`.

**3 — Install the companion panel:** search **“Commit Quest”** in the VS Code Extensions view, or:

```bash
code --install-extension natpat.commit-quest-companion
```

Reload the window, start a Claude Code session, and open the **Commit Quest** panel (next to Terminal /
Output). That's it — the panel updates live as you work.

<details>
<summary>Prefer to install from source / build the extension yourself?</summary>

```bash
git clone https://github.com/Hin-Nattapat/commit-quest && cd commit-quest
bash tools/install.sh            # deploy engine to ~/.agentrpg (then merge the printed snippet)
cd app/extension && npm install && npm run reinstall   # build + install the .vsix locally
```

</details>

## How it works

```
agents ──(adapters)──► append-only journal (NDJSON) ──(reducer)──► state.json ──► HUD / companion
```

- **Adapters** (`adapters/claude-code/hooks/*.sh`) are the only agent-aware code. They run on Claude
  Code's hot path, stay tiny, and append one normalized event per line to a per-session journal.
- The **reducer** (`core/`) folds the journal into `state.json` — a pure function over the event
  contract in `core/events.ts`. It knows nothing about Claude Code.
- The **companion** (`app/`, React + Vite) and the **status-bar HUD** (`hud/`) are read-only consumers
  of `state.json`. The companion ships as a VS Code webview extension (`app/extension/`).

Swap in another agent by writing a new adapter — the engine and UI never change.

## Tech stack

Bun + TypeScript (engine, run directly — no transpile) · `jq` (hook JSON) · React 19 + Vite
(companion) · esbuild + `@vscode/vsce` (extension). Runtime dependencies: **`bun` and `jq` only.**

## Known limitations

- Single developer, single machine — progression is local and meant to be _grinded_, not backfilled.
- Currently emits from Claude Code; other agents need an adapter (the seam is built for it).
- `--continue` / `--resume` replay recorded hook output and don't re-run hooks, so resumed spans can be
  sparse.

## Development

See [`docs/reference/commands.md`](docs/reference/commands.md) for the full command cheat sheet, and
[`CLAUDE.md`](CLAUDE.md) for architecture rules. Run the suite with `bun test`.

To publish the companion to the Marketplace, see
[`docs/reference/publishing.md`](docs/reference/publishing.md).

## License

[MIT](LICENSE)
