# Commands cheat sheet

Quick reference for the commands you'll actually run. Paths are relative to the repo root unless a
`cd` is shown.

## Tests · format · types

```bash
bun test                              # run the whole suite (core + hud + tools + app + extension)
bun test test/core/reduce.test.ts     # run one file
bun test 2>&1 | grep -E "pass|fail"   # read the result (NEVER tail — it hides the fail line)
bun run format                        # Prettier write across the repo
bun run format:check                  # Prettier check (CI)
cd app && bun run typecheck           # tsc --noEmit for the app workspace
cd app/extension && bun run typecheck # tsc --noEmit for the extension
```

## App (React companion · `app/`)

```bash
cd app
npm run dev      # Vite dev server + HMR (browser); proxies /events to the Bun SSE bridge
npm run serve    # Bun SSE bridge (server.ts): watches ~/.agentrpg/state.json, serves the built app
npm run build    # Vite production build → app/dist/assets/{app.js,app.css}
```

Browser dev = `npm run serve` (one terminal) + `npm run dev` (another), open the Vite URL.

## VS Code extension (`app/extension/`)

```bash
cd app/extension
npm run build:all   # app build → copy webview → bundle extension (run this BEFORE pressing F5)
npm run package     # build:all + vsce package → agent-quest-<version>.vsix
npm run reinstall   # package + (re)install the freshest vsix into VS Code, in one shot
npm run build       # just the extension host (esbuild → dist/extension.js)
npm run copy-webview # just copy app/dist/assets → app/extension/webview/assets
```

Install / run the packaged extension:

```bash
npm run reinstall                                  # repackage + force-install the latest vsix (then reload window)
code --install-extension app/extension/agent-quest-0.0.1.vsix
code --uninstall-extension NattaP.agent-quest
code --list-extensions | grep agent-quest        # confirm it's installed
```

After `reinstall`, reload the VS Code window (`Developer: Reload Window`) for the new build to load.

Then reload VS Code (`Developer: Reload Window`) and open the **Agent Quest** panel. Close any F5
Extension Development Host first so the panel doesn't collide with the installed copy.

## rpg CLI (character identity · `tools/rpg.ts`)

Run with Bun from the repo (`bun tools/rpg.ts <cmd>`). Writes `~/.agentrpg/profile.json` and
refreshes `state.json`.

After `bash tools/install.sh`, enable the short `rpg` command + tab-completion by adding to your
shell rc (the installer prints these):

- `export PATH="$HOME/.agentrpg/bin:$PATH"`
- zsh: `source $HOME/.agentrpg/completions/_rpg` (after `compinit`)
- bash: `source $HOME/.agentrpg/completions/rpg.bash`

Then `rpg <cmd>` works from anywhere (and `rpg <Tab>` lists the subcommands); a repo checkout can
still use `bun tools/rpg.ts <cmd>` directly.

```bash
bun tools/rpg.ts status              # show the character sheet
bun tools/rpg.ts name "Calypso"      # set the display name
bun tools/rpg.ts class mage          # pick a class line (at Lv.5+)
bun tools/rpg.ts branch a            # pick a T4 branch (a|b, at Lv.50)
bun tools/rpg.ts respec              # reset class choice
bun tools/rpg.ts inventory           # list owned loot
bun tools/rpg.ts title <id>          # equip a title  ·  rpg titles = list owned
bun tools/rpg.ts theme <id>          # equip an HUD theme color
bun tools/rpg.ts secrets             # list unlocked secret classes
```

Full usage: `bun tools/rpg.ts` (no args) prints
`name|class|branch|respec|status|inventory|title|theme|titles|secrets`.

## Deploy the agent hooks (`tools/install.sh`)

```bash
bash tools/install.sh           # copy hooks + config into $AGENTRPG_HOME (~/.agentrpg) — prod
bash tools/install.sh --link    # symlink instead of copy — dev (edits take effect live)
```

## Git grouping (this repo's convention)

Regroup messy WIP into clean commits, gated so the tree is byte-identical before any push:

```bash
TARGET=$(git rev-parse 'HEAD^{tree}')
git reset --soft main && git reset -q
# ... git add <group> && git commit -m "..."  per logical group ...
git diff --stat "$TARGET" HEAD   # MUST be empty before pushing
```
