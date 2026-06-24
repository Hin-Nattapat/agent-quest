# Agent Quest `aq` completion (bash). Source from ~/.bashrc.
# Keep this subcommand list in sync with the usage line in tools/aq.ts.
_aq_complete() {
  if [ "$COMP_CWORD" -eq 1 ]; then
    COMPREPLY=($(compgen -W "name class branch respec status inventory title theme titles secrets xyzzy setup" -- "${COMP_WORDS[1]}"))
  fi
}
complete -F _aq_complete aq
