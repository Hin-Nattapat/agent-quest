# Commit Quest — `rpg` CLI Ergonomics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user run `rpg <cmd>` (not `bun ~/.agentrpg/tools/rpg.ts <cmd>`) with zsh/bash tab-completion, by having `install.sh` deploy a wrapper + completions and print the activation lines.

**Architecture:** `install.sh` (which already deploys `tools/`+`core/` to `$RPG_HOME` in both copy and `--link` modes) additionally generates a `$RPG_HOME/bin/rpg` wrapper (`exec bun $RPG_HOME/tools/rpg.ts "$@"`) and copies two static completion scripts; it prints the PATH + `source` lines (no rc editing).

**Tech Stack:** bash (install.sh + wrapper), zsh/bash completion, Bun (`bun test` spawns the real `install.sh`).

**Spec:** `docs/superpowers/specs/2026-06-15-commit-quest-rpg-cli-ergonomics-design.md`

---

## Context for the implementer

- `tools/install.sh` resolves `RPG_HOME="${AGENTRPG_HOME:-$HOME/.agentrpg}"` and `SRC` = repo root; it `deploy`s `adapters tools core hud` to `$RPG_HOME` (symlink for `--link`, copy otherwise), ensures `journal/` + `config.json`, chmods hooks, then echoes `Installed to …` and `cat`s the settings snippet.
- The `rpg` CLI is `tools/rpg.ts` (run with Bun). Its subcommands (from the usage line): `name class branch respec status inventory title theme titles secrets xyzzy`.
- `test/tools/install.test.ts` spawns the real `install.sh` against a temp `AGENTRPG_HOME` (`makeHome()`) and asserts deployed files. Read results with `bun test 2>&1 | grep -E "pass|fail"` — never `tail`.

---

## Task 1: Wrapper + completions + install.sh

**Files:**
- Create: `tools/completions/_rpg`
- Create: `tools/completions/rpg.bash`
- Modify: `tools/install.sh`
- Test: `test/tools/install.test.ts`

- [ ] **Step 1: Write the failing test — append to `test/tools/install.test.ts`** (it already imports `makeHome`, `lstatSync`, `existsSync`, `join`, and defines `runInstall`):

```ts
test("deploys the rpg wrapper + completions, and the wrapper runs", async () => {
  const home = makeHome();
  const { code, stdout } = await runInstall(home, ["--link"]);
  expect(code).toBe(0);

  const rpg = join(home, "bin/rpg");
  expect(existsSync(rpg)).toBe(true);
  expect((lstatSync(rpg).mode & 0o111) !== 0).toBe(true); // executable
  expect(existsSync(join(home, "completions/_rpg"))).toBe(true);
  expect(existsSync(join(home, "completions/rpg.bash"))).toBe(true);
  expect(stdout).toContain("rpg' command"); // the activation hint was printed

  // the wrapper resolves bun + tools/rpg.ts + the home → `rpg status` exits 0
  const proc = Bun.spawn(["bash", rpg, "status"], {
    env: { ...process.env, AGENTRPG_HOME: home },
    stdout: "pipe",
    stderr: "pipe",
  });
  expect(await proc.exited).toBe(0);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun test test/tools/install.test.ts 2>&1 | grep -E "pass|fail"`
Expected: FAIL — `bin/rpg`/completions not created (and the wrapper-run subprocess errors).

- [ ] **Step 3: Create `tools/completions/_rpg` (zsh)**

```zsh
# Commit Quest `rpg` completion (zsh). Source after compinit, or drop in $fpath.
# Keep this subcommand list in sync with the usage line in tools/rpg.ts.
_rpg() {
  compadd name class branch respec status inventory title theme titles secrets xyzzy
}
compdef _rpg rpg
```

- [ ] **Step 4: Create `tools/completions/rpg.bash` (bash)**

```bash
# Commit Quest `rpg` completion (bash). Source from ~/.bashrc.
# Keep this subcommand list in sync with the usage line in tools/rpg.ts.
_rpg_complete() {
  if [ "$COMP_CWORD" -eq 1 ]; then
    COMPREPLY=($(compgen -W "name class branch respec status inventory title theme titles secrets xyzzy" -- "${COMP_WORDS[1]}"))
  fi
}
complete -F _rpg_complete rpg
```

- [ ] **Step 5: Extend `tools/install.sh`**

(a) After the hook-chmod block (the two `chmod +x …hooks…` lines) and BEFORE the `echo "Installed to …"` line, add:

```bash
# CLI ergonomics: an `rpg` wrapper on PATH + shell completions (activation is printed, not auto-wired).
mkdir -p "$RPG_HOME/bin" "$RPG_HOME/completions"
cat > "$RPG_HOME/bin/rpg" <<EOF
#!/usr/bin/env bash
export AGENTRPG_HOME="\${AGENTRPG_HOME:-$RPG_HOME}"
exec bun "$RPG_HOME/tools/rpg.ts" "\$@"
EOF
chmod +x "$RPG_HOME/bin/rpg"
cp "$SRC/tools/completions/_rpg" "$SRC/tools/completions/rpg.bash" "$RPG_HOME/completions/"
```

(b) After the existing `echo "Installed to $RPG_HOME (mode: $MODE)"` line, add:

```bash
echo ""
echo "For the 'rpg' command + tab-completion, add to your shell rc:"
echo "  export PATH=\"$RPG_HOME/bin:\$PATH\""
echo "  # zsh:  source $RPG_HOME/completions/_rpg     (after compinit)"
echo "  # bash: source $RPG_HOME/completions/rpg.bash"
```

(The heredoc escaping matters: `\${AGENTRPG_HOME...}` and `\$@` stay literal in the generated wrapper; `$RPG_HOME` expands to the install path at generation time.)

- [ ] **Step 6: Run to verify it passes**

Run: `bun test test/tools/install.test.ts 2>&1 | grep -E "pass|fail"`
Expected: PASS, 0 fail (the new test + the 4 existing ones).

Also sanity-check the generated wrapper content:
Run: `bash -c 'H=$(mktemp -d); AGENTRPG_HOME="$H" bash tools/install.sh --link >/dev/null 2>&1; cat "$H/bin/rpg"; rm -rf "$H"'`
Expected: prints the wrapper with the temp path baked into the `bun "…/tools/rpg.ts"` line and `export AGENTRPG_HOME`.

- [ ] **Step 7: Commit**

```bash
git add tools/completions/_rpg tools/completions/rpg.bash tools/install.sh test/tools/install.test.ts
git commit -m "feat(tools): rpg PATH wrapper + zsh/bash completion via install.sh"
```

---

## Task 2: Document the `rpg` command + activation

**Files:**
- Modify: `docs/reference/commands.md`

- [ ] **Step 1: Update the rpg section in `docs/reference/commands.md`**

Find the "## rpg CLI" section (it currently says to run with `bun tools/rpg.ts <cmd>`). Add an activation note immediately under that heading, before the command list:

```markdown
After `bash tools/install.sh`, enable the short `rpg` command + tab-completion by adding to your
shell rc (the installer prints these):

- `export PATH="$HOME/.agentrpg/bin:$PATH"`
- zsh: `source $HOME/.agentrpg/completions/_rpg` (after `compinit`)
- bash: `source $HOME/.agentrpg/completions/rpg.bash`

Then `rpg <cmd>` works from anywhere (and `rpg <Tab>` lists the subcommands). In a repo checkout you
can still run `bun tools/rpg.ts <cmd>` directly.
```

- [ ] **Step 2: Commit**

```bash
git add docs/reference/commands.md
git commit -m "docs: rpg PATH wrapper + completion activation in the cheat sheet"
```

---

## Self-Review

**Spec coverage:**
- `rpg` wrapper generated by install.sh (bakes `$RPG_HOME`, respects `AGENTRPG_HOME` override) → Task 1 step 5a. ✅
- zsh + bash completion files (subcommand list + sync comment) → Task 1 steps 3–4. ✅
- install.sh copies completions + prints activation (no rc edit) → Task 1 step 5. ✅
- Works in both copy + `--link` (wrapper targets `$RPG_HOME/tools/rpg.ts`, deployed in both) → covered; test uses `--link`. ✅
- Test: wrapper + completions deployed, executable, `rpg status` exits 0 → Task 1 step 1. ✅
- Docs → Task 2. ✅
- Scope: no rc editing, no dynamic arg-completion, no `rpg.ts` change → honored. ✅

**Placeholder scan:** none — every step has full content; `$RPG_HOME` in the wrapper is an install-time expansion (documented), not a plan placeholder.

**Consistency:** the subcommand list (`name class branch respec status inventory title theme titles secrets xyzzy`) is identical in `_rpg`, `rpg.bash`, and matches `tools/rpg.ts`'s usage line. The wrapper path `$RPG_HOME/bin/rpg` and `$RPG_HOME/completions/{_rpg,rpg.bash}` are consistent across the install.sh writes, the test assertions, and the printed activation lines. The test runs the wrapper via `bash "$home/bin/rpg" status` with `AGENTRPG_HOME` set, matching the wrapper's `exec bun "$RPG_HOME/tools/rpg.ts"`.
