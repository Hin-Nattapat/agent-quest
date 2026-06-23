import { test, expect } from "bun:test";
import { runHookAt, journalLines, makeHome } from "../helpers";

test("SessionStart (snake_case) emits session_start with cwd + model", async () => {
  const home = makeHome();
  const sid = "s-snake";
  const { code, stdout } = await runHookAt(
    "copilot",
    "on-session-start.sh",
    {
      hook_event_name: "SessionStart",
      session_id: sid,
      cwd: "/tmp/cq-proj",
      source: "startup",
      model: "gpt-5",
    },
    home,
  );
  expect(code).toBe(0);
  expect(stdout).toBe("");
  const e = journalLines(home, sid).at(-1);
  expect(e.type).toBe("session_start");
  expect(e.source).toBe("copilot");
  expect(e.model).toBe("gpt-5");
});

test("SessionStart (camelCase) reads sessionId", async () => {
  const home = makeHome();
  const { code } = await runHookAt(
    "copilot",
    "on-session-start.sh",
    {
      hook_event_name: "SessionStart",
      sessionId: "s-camel",
      cwd: "/tmp/cq-proj",
      source: "new",
    },
    home,
  );
  expect(code).toBe(0);
  expect(journalLines(home, "s-camel").at(-1).type).toBe("session_start");
});

test("UserPromptSubmit emits prompt and never stores the text", async () => {
  const home = makeHome();
  const { code, stdout } = await runHookAt(
    "copilot",
    "on-prompt.sh",
    {
      hook_event_name: "UserPromptSubmit",
      session_id: "p1",
      cwd: "/x",
      prompt: "my secret prompt",
    },
    home,
  );
  expect(code).toBe(0);
  expect(stdout).toBe("");
  const e = journalLines(home, "p1").at(-1);
  expect(e.type).toBe("prompt");
  expect(JSON.stringify(e)).not.toContain("secret");
});

test("Stop emits turn_end", async () => {
  const home = makeHome();
  const { code, stdout } = await runHookAt(
    "copilot",
    "on-stop.sh",
    { hook_event_name: "Stop", session_id: "t1", cwd: "/x" },
    home,
  );
  expect(code).toBe(0);
  expect(stdout).toBe("");
  expect(journalLines(home, "t1").at(-1).type).toBe("turn_end");
});

test("SessionEnd emits session_end", async () => {
  const home = makeHome();
  const { code, stdout } = await runHookAt(
    "copilot",
    "on-session-end.sh",
    { hook_event_name: "SessionEnd", session_id: "e1", reason: "user_exit" },
    home,
  );
  expect(code).toBe(0);
  expect(stdout).toBe("");
  expect(journalLines(home, "e1").at(-1).type).toBe("session_end");
});
