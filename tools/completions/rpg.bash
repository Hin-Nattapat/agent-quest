# Agent Quest `rpg` completion (bash). Source from ~/.bashrc.
# Keep this subcommand list in sync with the usage line in tools/rpg.ts.
_rpg_complete() {
  if [ "$COMP_CWORD" -eq 1 ]; then
    COMPREPLY=($(compgen -W "name class branch respec status inventory title theme titles secrets xyzzy" -- "${COMP_WORDS[1]}"))
  fi
}
complete -F _rpg_complete rpg
