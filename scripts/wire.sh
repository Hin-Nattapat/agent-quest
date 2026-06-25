#!/usr/bin/env bash
# Generic agent-wiring engine. Reads adapters/<agent>/wire.json manifests (agent-specific data)
# and detects / prints / applies each agent's hook wiring. Agent-agnostic — every agent specific
# fact is data in a manifest. `apply` backs up before writing and is idempotent.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$SCRIPT_DIR/.." && pwd)"
ADAPTERS="$REPO/adapters"

expand() {  # "~/x" -> "$HOME/x"
  case "$1" in
    "~/"*) printf '%s/%s' "$HOME" "${1#\~/}" ;;
    *) printf '%s' "$1" ;;
  esac
}

manifest() { printf '%s/%s/wire.json' "$ADAPTERS" "$1"; }

list_agents() {
  local m
  for m in "$ADAPTERS"/*/wire.json; do
    [ -f "$m" ] || continue
    jq -r .id "$m"
  done
}

is_present() {  # $1 = agent id; 0 if any detect entry matches
  local m count i entry
  m="$(manifest "$1")"
  count="$(jq -r '.detect | length' "$m")"
  for (( i = 0; i < count; i++ )); do
    entry="$(jq -r ".detect[$i]" "$m")"
    case "$entry" in
      "~/"* | /*)
        if [ -e "$(expand "$entry")" ]; then
          return 0
        fi
        ;;
      *)
        if command -v "$entry" >/dev/null 2>&1; then
          return 0
        fi
        ;;
    esac
  done
  return 1
}

cmd_detect() {
  local id
  for id in $(list_agents); do
    if is_present "$id"; then
      echo "$id"
    fi
  done
}

snippet_path() { printf '%s/%s/%s' "$ADAPTERS" "$1" "$(jq -r .snippet "$(manifest "$1")")"; }

cmd_print() {  # $1 = agent
  local target
  target="$(jq -r .target "$(manifest "$1")")"
  echo "Merge this into $target:"
  cat "$(snippet_path "$1")"
}

SENTINEL_START="# >>> agent-quest >>>"
SENTINEL_END="# <<< agent-quest <<<"

apply_toml_append() {  # $1 target  $2 snippet
  local target="$1" snippet="$2"
  mkdir -p "$(dirname "$target")"
  if [ -f "$target" ] && grep -qF "$SENTINEL_START" "$target"; then
    return 0
  fi
  if [ -f "$target" ]; then
    cp "$target" "$target.bak"
    printf '\n' >> "$target"
  fi
  {
    echo "$SENTINEL_START"
    cat "$snippet"
    echo "$SENTINEL_END"
  } >> "$target"
}

apply_json_drop() {  # $1 target(file)  $2 snippet
  local target="$1" snippet="$2"
  mkdir -p "$(dirname "$target")"
  cp "$snippet" "$target"
}

apply_json_merge() {  # $1 target  $2 snippet
  local target="$1" snippet="$2"
  mkdir -p "$(dirname "$target")"
  if [ -f "$target" ]; then
    cp "$target" "$target.bak"
    jq -s '.[0] * .[1]' "$target" "$snippet" > "$target.tmp"
    mv "$target.tmp" "$target"
  else
    cp "$snippet" "$target"
  fi
}

cmd_apply() {  # $1 = agent
  local m fmt target snippet
  m="$(manifest "$1")"
  fmt="$(jq -r .format "$m")"
  target="$(expand "$(jq -r .target "$m")")"
  snippet="$(snippet_path "$1")"
  case "$fmt" in
    json-merge)
      if [ -f "$target" ] && ! jq -e . "$target" >/dev/null 2>&1; then
        echo "⚠ $target is not valid JSON — not modifying it." >&2
        cmd_print "$1"
        return 0
      fi
      apply_json_merge "$target" "$snippet"
      ;;
    toml-append) apply_toml_append "$target" "$snippet" ;;
    json-drop) apply_json_drop "$target" "$snippet" ;;
    *)
      echo "unknown format $fmt" >&2
      return 1
      ;;
  esac
  echo "✓ wired $1 → $target"
}

hud_enabled() { [ "$(jq -r '.hud // false' "$(manifest "$1")")" = "true" ]; }

hud_snippet_path() {
  printf '%s/%s/%s' "$ADAPTERS" "$1" "$(jq -r .hud_snippet "$(manifest "$1")")"
}

cmd_print_hud() {  # $1 = agent
  hud_enabled "$1" || return 0
  cat "$(hud_snippet_path "$1")"
}

cmd_apply_hud() {  # $1 = agent
  hud_enabled "$1" || return 0
  local target
  target="$(expand "$(jq -r .target "$(manifest "$1")")")"
  apply_json_merge "$target" "$(hud_snippet_path "$1")"
  echo "✓ HUD statusline wired for $1"
}

ACTION=""
TUI_AGENTS=()
TUI_CHECKED=()
TUI_N=0
TUI_CURSOR=0
TUI_INJECT=0
TUI_KEYS=""
TUI_POS=0
TUI_LINES=0

classify_key() {  # $1 = char → sets ACTION
  case "$1" in
    j | J) ACTION=DOWN ;;
    k | K) ACTION=UP ;;
    ' ') ACTION=TOGGLE ;;
    '' | $'\n' | $'\r') ACTION=CONFIRM ;;
    q | Q | $'\e') ACTION=CANCEL ;;
    *) ACTION=NOP ;;
  esac
}

read_action() {  # sets ACTION from /dev/tty, or from TUI_KEYS when injecting
  if [ "$TUI_INJECT" -eq 1 ]; then
    if [ "$TUI_POS" -ge "${#TUI_KEYS}" ]; then
      ACTION=EOF
      return
    fi
    local c="${TUI_KEYS:$TUI_POS:1}"
    TUI_POS=$((TUI_POS + 1))
    classify_key "$c"
    return
  fi
  local c rest
  IFS= read -rsn1 c < /dev/tty || c=''
  if [ "$c" = $'\e' ]; then
    # Integer timeout only — macOS ships bash 3.2, which rejects fractional -t (e.g. 0.05).
    # An arrow's "[A"/"[B" is already buffered so this returns instantly; a bare ESC waits 1s.
    IFS= read -rsn2 -t 1 rest < /dev/tty || rest=''
    case "$rest" in
      '[A') ACTION=UP ;;
      '[B') ACTION=DOWN ;;
      *) ACTION=CANCEL ;;
    esac
    return
  fi
  classify_key "$c"
}

render_select() {  # redraw the checkbox list in place on /dev/tty
  if [ "$TUI_LINES" -gt 0 ]; then
    printf '\e[%dA' "$TUI_LINES" > /dev/tty
  fi
  {
    printf '\e[2K%s\n' "Select agents to wire  (↑/↓ move · space toggle · enter confirm · q cancel)"
    local i mark ptr
    for (( i = 0; i < TUI_N; i++ )); do
      if [ "${TUI_CHECKED[i]}" -eq 1 ]; then mark="x"; else mark=" "; fi
      if [ "$i" -eq "$TUI_CURSOR" ]; then ptr=">"; else ptr=" "; fi
      printf '\e[2K%s [%s] %s\n' "$ptr" "$mark" "${TUI_AGENTS[i]}"
    done
  } > /dev/tty
  TUI_LINES=$((TUI_N + 1))
}

cmd_select_agents() {  # $@ = candidate ids; prints chosen ids (one per line)
  TUI_AGENTS=("$@")
  TUI_N=${#TUI_AGENTS[@]}
  if [ "$TUI_N" -eq 0 ]; then
    return 0
  fi
  TUI_CHECKED=()
  local i
  for (( i = 0; i < TUI_N; i++ )); do TUI_CHECKED[i]=1; done
  TUI_CURSOR=0
  TUI_POS=0
  TUI_LINES=0
  if [ -n "${WIRE_TUI_KEYS+x}" ]; then
    TUI_INJECT=1
    TUI_KEYS="$WIRE_TUI_KEYS"
  else
    TUI_INJECT=0
  fi

  local saved=""
  if [ "$TUI_INJECT" -eq 0 ]; then
    saved="$(stty -g < /dev/tty)"
    trap 'stty "$saved" < /dev/tty 2>/dev/null' EXIT INT TERM
    stty -echo -icanon < /dev/tty
  fi

  local cancelled=0
  while true; do
    if [ "$TUI_INJECT" -eq 0 ]; then render_select; fi
    read_action
    case "$ACTION" in
      UP) TUI_CURSOR=$(( (TUI_CURSOR - 1 + TUI_N) % TUI_N )) ;;
      DOWN) TUI_CURSOR=$(( (TUI_CURSOR + 1) % TUI_N )) ;;
      TOGGLE) TUI_CHECKED[TUI_CURSOR]=$(( 1 - TUI_CHECKED[TUI_CURSOR] )) ;;
      CONFIRM) break ;;
      CANCEL | EOF) cancelled=1; break ;;
      *) : ;;
    esac
  done

  if [ "$TUI_INJECT" -eq 0 ]; then
    stty "$saved" < /dev/tty 2>/dev/null || true
    trap - EXIT INT TERM
    printf '\n' > /dev/tty
  fi

  if [ "$cancelled" -eq 1 ]; then
    return 0
  fi
  for (( i = 0; i < TUI_N; i++ )); do
    if [ "${TUI_CHECKED[i]}" -eq 1 ]; then
      echo "${TUI_AGENTS[i]}"
    fi
  done
}

# macOS: /dev/tty has rw permission bits even with no controlling terminal, so we
# must attempt to open it rather than relying on [ -r/-w ] permission checks.
has_tty() { ( exec 3>/dev/tty ) 2>/dev/null; }

cmd_interactive() {
  local detected id
  detected="$(cmd_detect)"
  if ! has_tty; then
    echo "(no terminal detected — printing wiring; re-run with --agent <id> --apply to write)"
    if [ -z "$detected" ]; then
      detected="claude-code"
    fi
    for id in $detected; do
      cmd_print "$id"
      cmd_print_hud "$id"
    done
    return 0
  fi

  local candidates="$detected"
  if [ -z "$candidates" ]; then
    candidates="$(list_agents)"
  fi

  local chosen
  chosen="$(cmd_select_agents $candidates)"
  if [ -z "$chosen" ]; then
    return 0
  fi

  local doit
  printf 'Merge into their configs now (a .bak backup is written)? [y/N] ' > /dev/tty
  read -r doit < /dev/tty || doit=""
  for id in $chosen; do
    case "$doit" in
      y | Y) cmd_apply "$id" ;;
      *) cmd_print "$id" ;;
    esac
  done

  for id in $chosen; do
    if hud_enabled "$id"; then
      printf 'Enable HUD statusline for %s? [y/N] ' "$id" > /dev/tty
      local hud
      read -r hud < /dev/tty || hud=""
      case "$hud" in
        y | Y) cmd_apply_hud "$id" ;;
        *) : ;;
      esac
    fi
  done
}

main() {
  local sub="${1:-}"
  shift || true
  case "$sub" in
    detect) cmd_detect ;;
    print) cmd_print "$1" ;;
    apply) cmd_apply "$1" ;;
    print-hud) cmd_print_hud "$1" ;;
    apply-hud) cmd_apply_hud "$1" ;;
    interactive) cmd_interactive ;;
    select) cmd_select_agents "$@" ;;
    *) echo "usage: wire.sh detect|print|apply|print-hud|apply-hud|interactive|select [agent...]" >&2; exit 2 ;;
  esac
}

main "$@"
