import { test, expect } from "bun:test";
import { runHookAt, journalLines, makeHome } from "../helpers";

const base = { cwd: "/tmp/cq-cursor-tool", hook_event_name: "postToolUse" };

test.each([
  ["edit_file", "edit"],
  ["search_replace", "edit"],
  ["apply_patch", "edit"],
  ["write", "write"],
  ["create_file", "write"],
  ["run_terminal_cmd", "run"],
  ["shell", "run"],
  ["bash", "run"],
  ["exec", "run"],
  ["read_file", "read"],
  ["list_dir", "read"],
  ["codebase_search", "search"],
  ["grep_search", "search"],
  ["file_search", "search"],
  ["web_search", "search"],
  ["mcp__github__list_issues", "other"],
  ["totally_unknown", "other"],
])("maps tool %s -> action %s (native preserved)", async (tool, action) => {
  const home = makeHome();
  const sid = `t-${tool}`;
  const { code } = await runHookAt(
    "cursor",
    "on-tool.sh",
    { ...base, conversation_id: sid, tool_name: tool },
    home,
  );
  expect(code).toBe(0);
  const e = journalLines(home, sid).at(-1);
  expect(e.type).toBe("action");
  expect(e.action).toBe(action);
  expect(e.native).toBe(tool);
});

test("edit captures file_path", async () => {
  const home = makeHome();
  await runHookAt(
    "cursor",
    "on-tool.sh",
    {
      ...base,
      conversation_id: "t-file",
      tool_name: "edit_file",
      tool_input: { file_path: "src/a.ts" },
    },
    home,
  );
  expect(journalLines(home, "t-file").at(-1).file).toBe("src/a.ts");
});

test("run_terminal_cmd classifies cmd (force_push) and never stores the raw command", async () => {
  const home = makeHome();
  await runHookAt(
    "cursor",
    "on-tool.sh",
    {
      ...base,
      conversation_id: "t-cmd",
      tool_name: "run_terminal_cmd",
      tool_input: { command: "git push --force origin secret-branch" },
    },
    home,
  );
  const e = journalLines(home, "t-cmd").at(-1);
  expect(e.action).toBe("run");
  expect(e.cmd).toBe("force_push");
  expect(JSON.stringify(e)).not.toContain("secret-branch");
});

test("postToolUseFailure -> action_fail (action still derived)", async () => {
  const home = makeHome();
  await runHookAt(
    "cursor",
    "on-tool.sh",
    {
      conversation_id: "t-fail",
      cwd: "/tmp/cq-cursor-tool",
      hook_event_name: "postToolUseFailure",
      tool_name: "edit_file",
      tool_input: { file_path: "src/b.ts" },
      error_message: "boom",
    },
    home,
  );
  const e = journalLines(home, "t-fail").at(-1);
  expect(e.type).toBe("action_fail");
  expect(e.action).toBe("edit");
});

test("malformed stdin still exits 0 with no stdout", async () => {
  const home = makeHome();
  const proc = Bun.spawn(
    ["bash", new URL("../../adapters/cursor/hooks/on-tool.sh", import.meta.url).pathname],
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
