# Backlog — Command-Aware Achievements (deferred)

> Captured during Phase 2a brainstorm (2026-06-11). These achievements are **not buildable
> yet** — they need a data signal the journal doesn't carry. Park here; build in a dedicated
> "command-aware" checkpoint (tentatively after 2c). Do not bloat 2a (a pure fold) with this.

## Why deferred — the missing signal

Phase 0 journal records Bash tool use as `action:"run"`, `native:"Bash"` **with no command
text** (deliberate: keep lines < 4 KB and avoid storing secrets). So the reducer cannot tell
a `git rebase --onto` from an `ls`. Design decision #4 (detect `test`/PR from the command)
was deferred for the same reason.

**Prerequisite for this whole batch:** the Claude Code adapter (`on-tool.sh`) must classify
the Bash command into a **safe tag** and emit it on the `action` event — e.g. a `cmd` field
like `git_rebase_onto`, `git_merge_main`, `cherry_pick`, `force_push`, `bisect`, `pr_merge`,
`test_run`. Constraints:

- **Classification only, never the raw command** — privacy/secret safety; keep the line small.
- Parsing runs in the hook hot path → keep the matcher cheap (a few `jq`/regex checks).
- This same signal also unlocks the other decision-#4 deferrals: `test` passed XP (+25),
  `failure_recovered`, and the "PR merged" loot trigger (§7.2).

Once `cmd` tags exist, add per-tag facts (e.g. `git_rebase_onto_count`) and these become
ordinary monotonic-stat / `event`-flag achievements.

## Achievement ideas (git / command flex)

| id | name | trigger | note |
|---|---|---|---|
| `git_ninja` | Git Ninja 🥷 | used `git rebase --onto` | the rare-command flex the idea started from |
| `cowboy_coder` | Cowboy Coder 🤠 | merged into `main`/`prod` directly, no PR | merge-to-protected-branch without `gh pr` |
| `cherry_picker` | Cherry Picker 🍒 | used `git cherry-pick` | |
| `force_of_nature` | Force of Nature 💥 | `git push --force` ≥ N | |
| `bisect_detective` | Bisect Detective 🕵️ | used `git bisect` | |
| `reflog_archaeologist` | Reflog Archaeologist 🏺 | used `git reflog` | digging out lost commits |
| `stash_hoarder` | Stash Hoarder 🧺 | `git stash` ≥ N | |
| `pr_machine` | PR Machine 🤖 | `gh pr merge` ≥ N | the disciplined opposite of Cowboy Coder |
| `rebase_wizard` | Rebase Wizard 🧙 | interactive rebases ≥ N | |

## Related deferrals that share this signal

- `test` passed → +25 XP (boss kill), and a "Boss Slayer" achievement (tests run ≥ N).
- `failure_recovered` → +15 XP and Rogue/Gremlin flavour (needs `action_fail` → success seq).
- "PR merged" loot trigger (§7.2).

Secret-class gags that also need *other* new signals (not command tags) stay with **2c**:
Night Owl 🦉 (time-of-day facts), The Ascetic 🧘 (action-ratio), `/rpg xyzzy` easter egg.
