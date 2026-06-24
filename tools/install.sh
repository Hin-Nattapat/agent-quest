#!/usr/bin/env bash
# Deploy Agent Quest to $AGENTRPG_HOME. --link = symlink (dev), default = copy (prod).
set -euo pipefail
RPG_HOME="${AGENTRPG_HOME:-$HOME/.agentrpg}"
SRC="$(cd "$(dirname "$0")/.." && pwd)"   # repo root (tools/ is one level down)
MODE="copy"
AGENTS=""
APPLY=""
HUD="ask"   # ask | yes | no
DEPLOY_ONLY=""
while [ $# -gt 0 ]; do
  case "$1" in
    --link) MODE="link" ;;
    --agent) shift; AGENTS="$1" ;;
    --apply) APPLY="yes" ;;
    --hud) HUD="yes" ;;
    --no-hud) HUD="no" ;;
    --deploy-only) DEPLOY_ONLY="yes" ;;
    *) ;;
  esac
  shift
done

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
deploy scripts

# config: copy default only if absent — never overwrite the user's tuning.
[ -f "$RPG_HOME/config.json" ] || cp "$SRC/config/default.json" "$RPG_HOME/config.json"

# Every adapter's hook scripts must be executable (run via `command` from the agent's config).
# git already tracks them 100755 and cp -R preserves that; this is the belt-and-suspenders for a
# source that lost the bit. Glob all adapters so a new one (codex, …) is covered without edits.
chmod +x "$SRC"/adapters/*/hooks/*.sh 2>/dev/null || true
if [ "$MODE" = "copy" ]; then chmod +x "$RPG_HOME"/adapters/*/hooks/*.sh 2>/dev/null || true; fi

if [ "$DEPLOY_ONLY" = "yes" ]; then
  echo "Deployed engine to $RPG_HOME"
  exit 0
fi

# CLI ergonomics: an `aq` wrapper on PATH + shell completions (activation is printed, not auto-wired).
mkdir -p "$RPG_HOME/bin" "$RPG_HOME/completions"
cat > "$RPG_HOME/bin/aq" <<EOF
#!/usr/bin/env bash
export AGENTRPG_HOME="\${AGENTRPG_HOME:-$RPG_HOME}"
exec bun "$RPG_HOME/tools/aq.ts" "\$@"
EOF
chmod +x "$RPG_HOME/bin/aq"
cp "$SRC/tools/completions/_aq" "$SRC/tools/completions/aq.bash" "$RPG_HOME/completions/"

echo "Installed to $RPG_HOME (mode: $MODE)"
echo ""
echo "For the 'aq' command + tab-completion, add to your shell rc:"
echo "  export PATH=\"$RPG_HOME/bin:\$PATH\""
echo "  # zsh:  source $RPG_HOME/completions/_aq     (after compinit)"
echo "  # bash: source $RPG_HOME/completions/aq.bash"
WIRE="$SRC/scripts/wire.sh"
echo ""
if [ -n "$AGENTS" ]; then
  IFS=',' read -ra _agents <<< "$AGENTS"
  for a in "${_agents[@]}"; do
    if [ "$APPLY" = "yes" ]; then
      bash "$WIRE" apply "$a"
      if [ "$HUD" = "yes" ]; then
        bash "$WIRE" apply-hud "$a"
      fi
    else
      bash "$WIRE" print "$a"
      if [ "$HUD" = "yes" ]; then
        bash "$WIRE" print-hud "$a"
      fi
    fi
  done
else
  bash "$WIRE" interactive
fi
