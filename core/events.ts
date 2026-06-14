// Normalized event schema — the single contract shared across the seam.
// Adapters MAY import these types; they must not import game logic.
//
// Enum string values ARE the on-the-wire strings emitted by the bash hooks
// (jq writes "session_start", "action", ... verbatim). Keep them in sync.

export enum EventType {
  SessionStart = "session_start",
  Prompt = "prompt",
  Action = "action",
  ActionFail = "action_fail",
  TurnEnd = "turn_end",
  SessionEnd = "session_end",
}

export enum AgentAction {
  Edit = "edit",
  Write = "write",
  Run = "run",
  Read = "read",
  Search = "search",
  Delegate = "delegate",
  Other = "other",
}

export enum CmdTag {
  GitRebaseOnto = "git_rebase_onto",
  GitRebaseI = "git_rebase_i",
  CherryPick = "cherry_pick",
  ForcePush = "force_push",
  Bisect = "bisect",
  Reflog = "reflog",
  Stash = "stash",
  PrMerge = "pr_merge",
  Cowboy = "cowboy",
  TestRun = "test_run",
}

// Derived (not a wire enum): timeline milestone kinds. Lives here — the events-contract module —
// because it is part of the read-side display contract the app MAY import at runtime (app/CLAUDE.md
// whitelists this module), while the timeline LOGIC stays in core/timeline.ts.
export enum TimelineKind {
  LevelUp = "level_up",
  Advance = "advance", // tier/form evolution (also a new area)
  BossDefeated = "boss_defeated",
  BossFled = "boss_fled",
  Loot = "loot", // boss drops (rolled at the boss event, so time-anchored)
}

export interface INormalizedEvent {
  ts: string; // UTC ISO8601, second precision
  source: string; // adapter id, e.g. "claude-code"
  session_id: string;
  type: EventType;
  repo?: string; // present on every line when determinable
  action?: AgentAction; // type=action/action_fail only
  native?: string; // raw tool name, type=action/action_fail only
  cmd?: CmdTag; // type=action/action_fail Bash only — a safe classification, never the raw command
  file?: string; // optional
  cwd?: string; // session_start only
  start?: string; // session_start only: startup|resume|clear|compact
  model?: string; // session_start only
}

export const isNormalizedEvent = (o: unknown): o is INormalizedEvent => {
  if (typeof o !== "object" || o === null) {
    return false;
  }
  const e = o as Record<string, unknown>;
  return (
    typeof e.ts === "string" &&
    typeof e.source === "string" &&
    typeof e.session_id === "string" &&
    typeof e.type === "string" &&
    (Object.values(EventType) as string[]).includes(e.type)
  );
};
