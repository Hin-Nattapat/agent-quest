#!/usr/bin/env bash
DIR="$(cd "$(dirname "$0")" && pwd)"; . "$DIR/_common.sh"
IFS= read -rd '' input || true
emit_simple session_end
exit 0
