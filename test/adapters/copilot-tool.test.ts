import { test, expect } from "bun:test";
import { runHookAt, journalLines, makeHome } from "../helpers";

const base = { cwd: "/tmp/cq-test-proj", hook_event_name: "PostToolUse" };

test.each([
  ["bash", "run"],
  ["shell", "run"],
  ["create_file", "write"],
  ["str_replace", "edit"],
  ["view", "read"],
  ["read_file", "read"],
  ["web_search", "search"],
  ["mcp__github__read_issue", "other"],
  ["whatever", "other"],
])("maps tool %s -> action %s", async (tool, action) => {
  const home = makeHome();
  const { code, stdout } = await runHookAt(
    "copilot",
    "on-tool.sh",
    { ...base, session_id: `m-${tool}`, tool_name: tool },
    home,
  );
  expect(code).toBe(0);
  expect(stdout).toBe("");
  const e = journalLines(home, `m-${tool}`).at(-1);
  expect(e.type).toBe("action");
  expect(e.action).toBe(action);
  expect(e.native).toBe(tool);
});

test("camelCase toolName + toolArgs are read", async () => {
  const home = makeHome();
  await runHookAt(
    "copilot",
    "on-tool.sh",
    {
      cwd: "/x",
      hook_event_name: "PostToolUse",
      sessionId: "cc1",
      toolName: "create_file",
      toolArgs: { path: "src/x.ts" },
    },
    home,
  );
  const e = journalLines(home, "cc1").at(-1);
  expect(e.action).toBe("write");
  expect(e.file).toBe("src/x.ts");
});

test("shell command classifies cmd (force_push) and never stores the raw command", async () => {
  const home = makeHome();
  await runHookAt(
    "copilot",
    "on-tool.sh",
    {
      ...base,
      session_id: "c1",
      tool_name: "shell",
      tool_input: { command: "git push --force origin secret-branch" },
    },
    home,
  );
  const e = journalLines(home, "c1").at(-1);
  expect(e.action).toBe("run");
  expect(e.cmd).toBe("force_push");
  expect(JSON.stringify(e)).not.toContain("secret-branch");
});

test("file path comes from tool_input.file_path", async () => {
  const home = makeHome();
  await runHookAt(
    "copilot",
    "on-tool.sh",
    {
      ...base,
      session_id: "fp1",
      tool_name: "str_replace",
      tool_input: { file_path: "src/a.ts" },
    },
    home,
  );
  const e = journalLines(home, "fp1").at(-1);
  expect(e.action).toBe("edit");
  expect(e.file).toBe("src/a.ts");
});

test("PostToolUseFailure emits action_fail", async () => {
  const home = makeHome();
  await runHookAt(
    "copilot",
    "on-tool-fail.sh",
    {
      cwd: "/x",
      hook_event_name: "PostToolUseFailure",
      session_id: "f1",
      tool_name: "shell",
      tool_input: { command: "ls" },
      error: { message: "boom" },
    },
    home,
  );
  const e = journalLines(home, "f1").at(-1);
  expect(e.type).toBe("action_fail");
  expect(e.action).toBe("run");
});

test("malformed stdin still exits 0 with no stdout", async () => {
  const home = makeHome();
  const proc = Bun.spawn(
    [
      "bash",
      new URL("../../adapters/copilot/hooks/on-tool.sh", import.meta.url).pathname,
    ],
    {
      stdin: Buffer.from("not json"),
      env: { ...process.env, AGENTRPG_HOME: home },
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  const stdout = await new Response(proc.stdout).text();
  expect(await proc.exited).toBe(0);
  expect(stdout).toBe("");
});
