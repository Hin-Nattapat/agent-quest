#!/usr/bin/env bash
# Shared helpers for the Codex adapter. Sourced by codex hook scripts — not executed directly.
RPG_HOME="${AGENTRPG_HOME:-$HOME/.agentrpg}"
SOURCE="codex"
EMIT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../generic" && pwd)/emit.sh"
