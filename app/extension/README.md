<p align="center">
  <img src="https://raw.githubusercontent.com/Hin-Nattapat/commit-quest/main/app/public/splash.png" alt="Commit Quest" width="600">
</p>

# Commit Quest Companion

A live pixel-RPG companion panel for **Claude Code**, right inside VS Code. It shows your coding
session gamified as a character — class, level, XP, streak, loot, boss fights, achievements — over an
animated AFK scene (farming, guild hall with NPCs, tier realms). Ambient and read-only: glance at it
between turns.

> **Needs the Commit Quest engine.** This panel renders `~/.agentrpg/state.json`, which the Commit
> Quest hooks write while you use Claude Code. Install the engine first (one line):
>
> ```bash
> curl -fsSL https://raw.githubusercontent.com/Hin-Nattapat/commit-quest/main/scripts/bootstrap.sh | bash
> ```
>
> Then merge the printed snippet into `~/.claude/settings.json`. Full setup:
> <https://github.com/Hin-Nattapat/commit-quest#install>

## Usage

1. Install this extension (Marketplace) and reload the window.
2. Open the **Commit Quest** panel — it sits next to Terminal / Output in the bottom panel.
3. Run a Claude Code session. The panel updates live as you prompt, edit, and ship.

## Features

- Live character HUD: class, tier, level, animated XP bar, streak, equipped title.
- Animated AFK scene: farming, in-place battles, guild hall with NPCs, per-tier realms.
- Boss encounters, loot, and an achievements / talents / items overlay.
- Real PixelLab sprites for the four main class lines.

## How it works

- `src/state-feed.ts` watches `~/.agentrpg/state.json` and pushes it to the webview via `postMessage`.
- The webview is the `app/` React build (Vite), copied into `webview/` by `scripts/copy-webview.mjs`.
- The extension host bundles with esbuild; the webview HTML is generated with a CSP nonce.

## Develop & publish

```bash
npm run build:all   # build app → copy webview → bundle extension (run before F5)
npm run reinstall   # package + force-install the freshest .vsix locally
```

Press **F5** for the Extension Development Host (close it before testing an installed copy). Publishing
to the Marketplace / Open VSX: see
[`docs/reference/publishing.md`](https://github.com/Hin-Nattapat/commit-quest/blob/main/docs/reference/publishing.md).

## License

[MIT](https://github.com/Hin-Nattapat/commit-quest/blob/main/LICENSE)
