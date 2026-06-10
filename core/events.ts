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

export interface INormalizedEvent {
  ts: string;              // UTC ISO8601, second precision
  source: string;          // adapter id, e.g. "claude-code"
  session_id: string;
  type: EventType;
  repo?: string;           // present on every line when determinable
  action?: AgentAction;    // type=action/action_fail only
  native?: string;         // raw tool name, type=action/action_fail only
  file?: string;           // optional
  cwd?: string;            // session_start only
  start?: string;          // session_start only: startup|resume|clear|compact
  model?: string;          // session_start only
}

export function isNormalizedEvent(o: unknown): o is INormalizedEvent {
  if (typeof o !== "object" || o === null) return false;
  const e = o as Record<string, unknown>;
  return (
    typeof e.ts === "string" &&
    typeof e.source === "string" &&
    typeof e.session_id === "string" &&
    typeof e.type === "string" &&
    (Object.values(EventType) as string[]).includes(e.type)
  );
}
