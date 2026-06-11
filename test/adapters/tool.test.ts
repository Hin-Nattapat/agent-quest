import { test, expect } from "bun:test";
import { runHook, journalLines, makeHome } from "../helpers";

const base = { cwd: "/tmp/cq-test-proj", hook_event_name: "PostToolUse" };

test.each([
  ["Edit", "edit"],
  ["MultiEdit", "edit"],
  ["Write", "write"],
  ["Bash", "run"],
  ["Read", "read"],
  ["Grep", "search"],
  ["Glob", "search"],
  ["Task", "delegate"],
  ["WebFetch", "other"],
])("maps tool %s -> action %s", async (tool, action) => {
  const home = makeHome();
  const { code, stdout } = await runHook(
    "on-tool.sh",
    { ...base, session_id: "t1", tool_name: tool },
    home,
  );
  expect(code).toBe(0);
  expect(stdout).toBe("");
  const e = journalLines(home, "t1").at(-1);
  expect(e.type).toBe("action");
  expect(e.action).toBe(action);
  expect(e.native).toBe(tool);
});

test("captures file_path when present", async () => {
  const home = makeHome();
  await runHook(
    "on-tool.sh",
    {
      ...base,
      session_id: "t2",
      tool_name: "Edit",
      tool_input: { file_path: "src/a.ts" },
    },
    home,
  );
  const e = journalLines(home, "t2").at(-1);
  expect(e.file).toBe("src/a.ts");
});

test("PostToolUseFailure -> action_fail", async () => {
  const home = makeHome();
  await runHook(
    "on-tool.sh",
    {
      cwd: base.cwd,
      session_id: "t3",
      tool_name: "Bash",
      hook_event_name: "PostToolUseFailure",
    },
    home,
  );
  const e = journalLines(home, "t3").at(-1);
  expect(e.type).toBe("action_fail");
  expect(e.action).toBe("run");
});

test("malformed stdin still exits 0 and writes no stdout", async () => {
  const home = makeHome();
  const proc = Bun.spawn(
    [
      "bash",
      new URL("../../adapters/claude-code/hooks/on-tool.sh", import.meta.url).pathname,
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
