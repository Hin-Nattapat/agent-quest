# Generic emit

`emit.sh` is the agent-agnostic emitter. Every adapter's hooks parse their own payload, then call it
to append one normalized event (`core/events.ts`) to `~/.agentrpg/journal/<session_id>.ndjson`. It
knows the contract only — never an agent's payload, event names, or tool names.

## Usage

    emit.sh --type <session_start|prompt|action|action_fail|turn_end|session_end> --session <sid> \
            [--source <id>] [--cwd <path>] [--repo <name>] [--start <s>] [--model <m>] \
            [--action <edit|write|run|read|search|delegate|other>] [--native <tool>] \
            [--cmd <CmdTag>] [--file <path>]

- `--source` defaults to `$RPG_SOURCE`, else `claude-code`.
- Repo: `--repo` wins; else the session cache; else one `git` call from `--cwd`, then cached.
- `cwd`/`start`/`model` are emitted only for `session_start`. Empty optionals are omitted.

Adding an agent = a new `adapters/<agent>/` parsing layer that calls this — no change here. Cursor and
Copilot CLI both use command hooks, so the same pattern applies (see the design spec appendix).
