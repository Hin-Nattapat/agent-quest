#!/usr/bin/env bash
# Agent Quest one-line installer. Clones the repo and deploys the game engine (hooks + reducer +
# CLI) into $AGENTRPG_HOME, then prints the Claude Code wiring. The VS Code companion is installed
# separately from the Marketplace (see the printed next steps).
#
#   curl -fsSL https://raw.githubusercontent.com/Hin-Nattapat/agent-quest/main/scripts/bootstrap.sh | bash
#
# Env overrides: REPO_URL, SRC_DIR (clone target, default ~/.agent-quest), AGENTRPG_HOME.
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/Hin-Nattapat/agent-quest.git}"
SRC_DIR="${SRC_DIR:-$HOME/.agent-quest}"

need() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "✖ missing '$1' — $2" >&2
    exit 1
  }
}

echo "▸ Agent Quest installer"
need git "install git, then re-run"
need bun "install Bun from https://bun.sh, then re-run"
need jq "install jq (brew install jq / apt install jq), then re-run"

if [ -d "$SRC_DIR/.git" ]; then
  echo "▸ updating existing clone at $SRC_DIR"
  git -C "$SRC_DIR" pull --ff-only
else
  echo "▸ cloning into $SRC_DIR"
  git clone --depth 1 "$REPO_URL" "$SRC_DIR"
fi

echo "▸ deploying the engine"
bash "$SRC_DIR/tools/install.sh"

echo ""
echo "✓ Engine installed. Next:"
echo "  1. Merge the hooks/statusLine snippet above into ~/.claude/settings.json"
echo "  2. Install the companion panel — search \"Agent Quest\" in the VS Code"
echo "     Extensions view, or: code --install-extension NattaP.agent-quest"
echo "  3. Start a Claude Code session and open the Agent Quest panel."
