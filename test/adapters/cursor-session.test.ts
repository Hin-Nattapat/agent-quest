import { test, expect } from "bun:test";
import { runHookAt, journalLines, makeHome } from "../helpers";

test("sessionStart -> session_start keyed on conversation_id; cwd from workspace_roots[0]; model emitted; own session_id ignored", async () => {
  const home = makeHome();
  const { code, stdout } = await runHookAt(
    "cursor",
    "on-session-start.sh",
    {
      conversation_id: "conv-1",
      session_id: "sess-ignored",
      workspace_roots: ["/tmp/cq-cursor-proj"],
      model: "claude-4",
      hook_event_name: "sessionStart",
    },
    home,
  );
  expect(code).toBe(0);
  expect(stdout).toBe("");
  expect(journalLines(home, "sess-ignored")).toHaveLength(0);
  const e = journalLines(home, "conv-1").at(-1);
  expect(e.type).toBe("session_start");
  expect(e.source).toBe("cursor");
  expect(e.model).toBe("claude-4");
  expect(e.cwd).toBe("/tmp/cq-cursor-proj");
  expect(e.repo).toBe("cq-cursor-proj");
});

test("beforeSubmitPrompt -> prompt; prompt text not stored", async () => {
  const home = makeHome();
  const { code, stdout } = await runHookAt(
    "cursor",
    "on-prompt.sh",
    {
      conversation_id: "c-p",
      prompt: "do the SECRET thing",
      hook_event_name: "beforeSubmitPrompt",
    },
    home,
  );
  expect(code).toBe(0);
  expect(stdout).toBe("");
  const e = journalLines(home, "c-p").at(-1);
  expect(e.type).toBe("prompt");
  expect(e.source).toBe("cursor");
  expect(JSON.stringify(e)).not.toContain("SECRET");
});

test("stop -> turn_end", async () => {
  const home = makeHome();
  const { code, stdout } = await runHookAt(
    "cursor",
    "on-stop.sh",
    { conversation_id: "c-s", status: "completed", hook_event_name: "stop" },
    home,
  );
  expect(code).toBe(0);
  expect(stdout).toBe("");
  expect(journalLines(home, "c-s").at(-1).type).toBe("turn_end");
});

test("sessionEnd -> session_end keyed on conversation_id", async () => {
  const home = makeHome();
  const { code, stdout } = await runHookAt(
    "cursor",
    "on-session-end.sh",
    {
      conversation_id: "c-e",
      session_id: "sess-ignored",
      reason: "closed",
      hook_event_name: "sessionEnd",
    },
    home,
  );
  expect(code).toBe(0);
  expect(stdout).toBe("");
  expect(journalLines(home, "sess-ignored")).toHaveLength(0);
  expect(journalLines(home, "c-e").at(-1).type).toBe("session_end");
});

test("subagentStart -> action/delegate keyed on parent_conversation_id when conversation_id absent", async () => {
  const home = makeHome();
  const { code, stdout } = await runHookAt(
    "cursor",
    "on-subagent.sh",
    {
      parent_conversation_id: "parent-1",
      subagent_type: "code-searcher",
      hook_event_name: "subagentStart",
    },
    home,
  );
  expect(code).toBe(0);
  expect(stdout).toBe("");
  const e = journalLines(home, "parent-1").at(-1);
  expect(e.type).toBe("action");
  expect(e.action).toBe("delegate");
  expect(e.native).toBe("code-searcher");
});
