<p align="center">
  <img src="https://raw.githubusercontent.com/Hin-Nattapat/agent-quest/main/app/public/splash.png" alt="Agent Quest" width="600">
</p>

<h3 align="center">Your AI coding sessions, gamified into a retro pixel RPG — right inside VS Code.</h3>

<p align="center"><em>You were going to burn those tokens anyway. Might as well level up.</em></p>

---

**Agent Quest Companion** is a live pixel-RPG panel that turns your AI coding-agent sessions into
character progression. As you prompt, edit, run commands, and ship code, your hero earns XP and climbs
through classes, tiers, loot, boss fights, and achievements — shown over an animated AFK scene
(farming, a guild hall with loitering NPCs, per-tier realms). It's **ambient and read-only**: you
never operate it, you just glance at it between turns and it feels good.

Works with **Claude Code**, **Codex**, and **Cursor** — one shared hero across every agent.

<p align="center">
  <img src="https://raw.githubusercontent.com/Hin-Nattapat/agent-quest/main/docs/assets/screenshot.png" alt="The Agent Quest companion panel in VS Code" width="820">
</p>

> **🧩 Needs the Agent Quest engine (one line).** This panel renders `~/.agentrpg/state.json`, which
> the Agent Quest hooks write while you work. Install the engine first:
>
> ```bash
> curl -fsSL https://raw.githubusercontent.com/Hin-Nattapat/agent-quest/main/scripts/bootstrap.sh | bash
> ```
>
> Then wire your agent (merge the printed snippet into `~/.claude/settings.json` for Claude Code; see
> the adapters for Codex/Cursor). Full setup: <https://github.com/Hin-Nattapat/agent-quest#-install>

## Getting started

1. Install this extension and reload the window.
2. Install + wire the engine (see the box above) — without it the panel has no data to show.
3. Open the **Agent Quest** panel (next to Terminal / Output in the bottom panel).
4. Run your agent. The panel updates live as you prompt, edit, and ship.

## Features

- 🧙 **A character that levels with your work** — Mage · Ranger · Rogue · Sage (+ secret lines),
  advancing T1→T4 with branching forms. Earned from real session events, not a bar that goes up for
  opening the editor.
- 🪙 **Loot, boss fights & achievements** — rate-based encounters drop gear; medieval "deeds" unlock
  equippable titles. Every drop traces back to an event.
- 🏰 **An animated AFK scene** — your hero farms, rests in the guild hall, and battles through tier
  realms, with real pixel sprites for the main class lines.
- 🔌 **Multi-agent** — Claude Code, Codex, and Cursor all feed the same hero (read-only, via the engine).

## How it works

Agent Quest has two parts: a tiny **engine** (`bun` + `jq`, installed via the one-liner above) that
records your agent's activity to a local journal, and **this panel**, which reads the resulting
`~/.agentrpg/state.json` and renders it live. The panel is purely read-only — it never runs or changes
your agent; it just visualizes what you already did.

Local-first: no account, no telemetry, your data never leaves your machine. Open source — architecture,
adapters, and contributing: <https://github.com/Hin-Nattapat/agent-quest>.

## License

[MIT](https://github.com/Hin-Nattapat/agent-quest/blob/main/LICENSE) — built with leftover tokens,
between real tasks, by an otter who codes with Claude Code. 🦦
