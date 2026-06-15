# Commit Quest — `rpg` CLI ergonomics design

> **Status:** design approved 2026-06-15. Plan: `docs/superpowers/plans/`.
> Replace `bun ~/.agentrpg/tools/rpg.ts <cmd>` with a plain `rpg <cmd>` on PATH, plus zsh/bash
> tab-completion for the subcommands. `install.sh` deploys the wrapper + completions and prints
> two activation lines (it does NOT edit the user's shell rc).

## Goal

After `bash tools/install.sh`, the user adds two lines to their shell rc and then types `rpg status`
(no `bun`, no path) and gets tab-completion of the subcommands
(`name class branch respec status inventory title theme titles secrets xyzzy`).

## Constraints

- **Non-intrusive activation** (user-confirmed): `install.sh` writes the wrapper + completion files
  under `$RPG_HOME` and **prints** the PATH + `source` lines; it never edits `~/.zshrc`/`~/.bashrc`.
- **Both install modes:** the wrapper runs `$RPG_HOME/tools/rpg.ts`, which `install.sh` already
  deploys (copy *and* `--link`), so `rpg` works in dev and prod with one wrapper.
- **Runtime deps unchanged:** still `bun` + `jq`; the wrapper is a bash one-liner, completions are
  plain shell. No new dependency.
- **Bun-only execution** — the wrapper `exec bun …`; no transpile.

## Architecture

```
bash tools/install.sh              (existing deploy of adapters/tools/core/hud → $RPG_HOME)
  + write  $RPG_HOME/bin/rpg       (generated: exec bun $RPG_HOME/tools/rpg.ts "$@")   chmod +x
  + copy   tools/completions/_rpg      → $RPG_HOME/completions/_rpg       (zsh)
  + copy   tools/completions/rpg.bash  → $RPG_HOME/completions/rpg.bash   (bash)
  + print  "add to your rc: export PATH=…/bin; source …/completions/<shell>"

user rc (manual):  export PATH="$RPG_HOME/bin:$PATH"  +  source the completion for their shell
→ `rpg status`, `rpg <Tab>` → the subcommand list
```

The wrapper is **generated** by `install.sh` (it bakes in the resolved `$RPG_HOME`); the two
completion scripts are **static repo files** copied verbatim (so they're reviewable/testable).

## Components / files

| File | Responsibility | New/Mod |
|---|---|---|
| `tools/completions/_rpg` | zsh completion — `compadd` the subcommands, `compdef _rpg rpg` | Create |
| `tools/completions/rpg.bash` | bash completion — `complete -F` the subcommands at arg 1 | Create |
| `tools/install.sh` | generate `$RPG_HOME/bin/rpg`, copy completions, print activation | Modify |
| `test/tools/install.test.ts` | assert wrapper + completions deployed and the wrapper runs | Modify |
| `docs/reference/commands.md` | document `rpg` + the one-time activation | Modify |

### The wrapper (`install.sh` generates `$RPG_HOME/bin/rpg`)
```bash
#!/usr/bin/env bash
export AGENTRPG_HOME="${AGENTRPG_HOME:-<RPG_HOME>}"
exec bun "<RPG_HOME>/tools/rpg.ts" "$@"
```
`<RPG_HOME>` is the resolved install path. Exporting `AGENTRPG_HOME` (with override) keeps the CLI
reading the same home it was installed to, even if the user's default differs.

### `tools/completions/_rpg` (zsh)
```zsh
# Commit Quest `rpg` completion (zsh). Source after compinit, or drop in $fpath.
# Keep the subcommand list in sync with the usage line in tools/rpg.ts.
_rpg() {
  compadd name class branch respec status inventory title theme titles secrets xyzzy
}
compdef _rpg rpg
```

### `tools/completions/rpg.bash` (bash)
```bash
# Commit Quest `rpg` completion (bash). Source from ~/.bashrc.
# Keep the subcommand list in sync with the usage line in tools/rpg.ts.
_rpg_complete() {
  if [ "$COMP_CWORD" -eq 1 ]; then
    COMPREPLY=($(compgen -W "name class branch respec status inventory title theme titles secrets xyzzy" -- "${COMP_WORDS[1]}"))
  fi
}
complete -F _rpg_complete rpg
```

### `install.sh` additions (after the existing deploy + config block)
- `mkdir -p "$RPG_HOME/bin" "$RPG_HOME/completions"`
- generate the wrapper (heredoc with `$RPG_HOME` expanded, `$@`/`$AGENTRPG_HOME` escaped), `chmod +x`
- `cp "$SRC/tools/completions/_rpg" "$SRC/tools/completions/rpg.bash" "$RPG_HOME/completions/"`
- print the activation block:
  ```
  For the `rpg` command + tab-completion, add to your shell rc:
    export PATH="$RPG_HOME/bin:$PATH"
    # zsh:  source $RPG_HOME/completions/_rpg     (after compinit)
    # bash: source $RPG_HOME/completions/rpg.bash
  ```

## Error handling / edge cases

- **`bun` not on PATH at runtime** → the wrapper fails with bun's own "command not found"; acceptable
  (bun is a stated runtime dep). No extra guard.
- **Custom `AGENTRPG_HOME`** → the wrapper bakes the install path and respects an env override, so it
  always targets the deployed `tools/rpg.ts`.
- **Re-install** → `mkdir -p` + overwrite are idempotent; the wrapper/completions are regenerated.
- **`--link` mode** → `$RPG_HOME/tools` is a symlink to the repo, so the wrapper runs the live source.
- The completion list is hard-coded with a "keep in sync with rpg.ts" comment (the subcommands rarely
  change; a generated list would add a build step for no real gain — YAGNI).

## Testing

- **`install.test.ts`** (bun, temp `AGENTRPG_HOME`): after running `install.sh`, assert
  `$HOME/bin/rpg` exists and is executable, `$HOME/completions/_rpg` and `rpg.bash` exist, and
  **`$HOME/bin/rpg status` exits 0** (proves the wrapper resolves bun + tools/rpg.ts + the home).
- Completions are plain shell sourced interactively — **verified manually** (a `rpg <Tab>` smoke test
  is documented for the human; not automated, since it needs an interactive shell).

## Scope / non-goals

- **No rc editing** — printed instructions only.
- **No dynamic completion** (no value-completion for `class <line>` / `title <id>`) — just the
  subcommand list. Argument completion is a possible later enhancement, out of scope here.
- **No new runtime dependency**; no change to `rpg.ts` itself.
- **fish/other shells** out of scope (zsh + bash only).
