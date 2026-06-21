#!/usr/bin/env bash
# Deploy Agent Quest to $AGENTRPG_HOME. --link = symlink (dev), default = copy (prod).
set -euo pipefail
RPG_HOME="${AGENTRPG_HOME:-$HOME/.agentrpg}"
SRC="$(cd "$(dirname "$0")/.." && pwd)"   # repo root (tools/ is one level down)
MODE="copy"; [ "${1:-}" = "--link" ] && MODE="link"

mkdir -p "$RPG_HOME/journal"

deploy() {  # $1 = dir name under repo root
  local src="$SRC/$1" dst="$RPG_HOME/$1"
  rm -rf "$dst"; mkdir -p "$(dirname "$dst")"
  if [ "$MODE" = "link" ]; then ln -s "$src" "$dst"; else cp -R "$src" "$dst"; fi
}

deploy adapters
deploy tools
deploy core
deploy hud

# config: copy default only if absent — never overwrite the user's tuning.
[ -f "$RPG_HOME/config.json" ] || cp "$SRC/config/default.json" "$RPG_HOME/config.json"

# Every adapter's hook scripts must be executable (run via `command` from the agent's config).
# git already tracks them 100755 and cp -R preserves that; this is the belt-and-suspenders for a
# source that lost the bit. Glob all adapters so a new one (codex, …) is covered without edits.
chmod +x "$SRC"/adapters/*/hooks/*.sh 2>/dev/null || true
if [ "$MODE" = "copy" ]; then chmod +x "$RPG_HOME"/adapters/*/hooks/*.sh 2>/dev/null || true; fi

# CLI ergonomics: an `rpg` wrapper on PATH + shell completions (activation is printed, not auto-wired).
mkdir -p "$RPG_HOME/bin" "$RPG_HOME/completions"
cat > "$RPG_HOME/bin/rpg" <<EOF
#!/usr/bin/env bash
export AGENTRPG_HOME="\${AGENTRPG_HOME:-$RPG_HOME}"
exec bun "$RPG_HOME/tools/rpg.ts" "\$@"
EOF
chmod +x "$RPG_HOME/bin/rpg"
cp "$SRC/tools/completions/_rpg" "$SRC/tools/completions/rpg.bash" "$RPG_HOME/completions/"

echo "Installed to $RPG_HOME (mode: $MODE)"
echo ""
echo "For the 'rpg' command + tab-completion, add to your shell rc:"
echo "  export PATH=\"$RPG_HOME/bin:\$PATH\""
echo "  # zsh:  source $RPG_HOME/completions/_rpg     (after compinit)"
echo "  # bash: source $RPG_HOME/completions/rpg.bash"
echo "Merge this into ~/.claude/settings.json:"
cat "$SRC/adapters/claude-code/settings.snippet.json"
