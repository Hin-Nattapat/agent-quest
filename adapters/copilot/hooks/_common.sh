#!/usr/bin/env bash
# Shared helpers for the Copilot adapter. Sourced by copilot hook scripts — not executed directly.
RPG_HOME="${AGENTRPG_HOME:-$HOME/.agentrpg}"
SOURCE="copilot"
GENERIC="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../generic" && pwd)"
EMIT="$GENERIC/emit.sh"
