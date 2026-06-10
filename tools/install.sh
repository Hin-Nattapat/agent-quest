#!/usr/bin/env bash
# Deploy Commit Quest to $AGENTRPG_HOME. --link = symlink (dev), default = copy (prod).
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

# config: copy default only if absent — never overwrite the user's tuning.
[ -f "$RPG_HOME/config.json" ] || cp "$SRC/config/default.json" "$RPG_HOME/config.json"

# hook scripts must be executable (run via `command` in settings.json).
chmod +x "$SRC"/adapters/claude-code/hooks/*.sh 2>/dev/null || true
if [ "$MODE" = "copy" ]; then chmod +x "$RPG_HOME"/adapters/claude-code/hooks/*.sh 2>/dev/null || true; fi

echo "Installed to $RPG_HOME (mode: $MODE)"
echo "Merge this into ~/.claude/settings.json:"
cat "$SRC/adapters/claude-code/settings.snippet.json"
