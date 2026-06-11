import { test, expect } from "bun:test";
import { runHook, journalLines, makeHome } from "../helpers";
import { summarize } from "../../tools/inspect";

test("a simulated session produces a coherent journal", async () => {
  const home = makeHome();
  const sid = "sess";
  const cwd = "/tmp/cq-test-proj";

  await runHook(
    "on-session-start.sh",
    { session_id: sid, cwd, hook_event_name: "SessionStart", source: "startup" },
    home,
  );
  await runHook(
    "on-prompt.sh",
    { session_id: sid, cwd, hook_event_name: "UserPromptSubmit", prompt: "build x" },
    home,
  );
  await runHook(
    "on-tool.sh",
    { session_id: sid, cwd, tool_name: "Read", hook_event_name: "PostToolUse" },
    home,
  );
  await runHook(
    "on-tool.sh",
    {
      session_id: sid,
      cwd,
      tool_name: "Edit",
      tool_input: { file_path: "a.ts" },
      hook_event_name: "PostToolUse",
    },
    home,
  );
  await runHook(
    "on-tool.sh",
    { session_id: sid, cwd, tool_name: "Bash", hook_event_name: "PostToolUseFailure" },
    home,
  );
  await runHook("on-stop.sh", { session_id: sid, cwd, hook_event_name: "Stop" }, home);
  await runHook(
    "on-session-end.sh",
    { session_id: sid, cwd, hook_event_name: "SessionEnd" },
    home,
  );

  const types = journalLines(home, sid).map(e => e.type);
  expect(types).toEqual([
    "session_start",
    "prompt",
    "action",
    "action",
    "action_fail",
    "turn_end",
    "session_end",
  ]);

  const out = summarize(home);
  expect(out).toContain("events: 7");
  expect(out).toContain("sessions: 1");
});
