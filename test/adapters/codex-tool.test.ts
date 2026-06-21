import { test, expect } from "bun:test";
import { runHookAt, journalLines, makeHome } from "../helpers";

const base = { cwd: "/tmp/cq-test-proj", hook_event_name: "PostToolUse" };

test.each([
  [
    "apply_patch",
    { patch: "*** Begin Patch\n*** Update File: src/a.ts\n@@\n-x\n+y\n*** End Patch" },
    "edit",
    "src/a.ts",
  ],
  [
    "apply_patch",
    {
      patch:
        "*** Begin Patch\n*** Add File: src/new.ts\n+export const x = 1;\n*** End Patch",
    },
    "write",
    "src/new.ts",
  ],
])("apply_patch maps to %s#%s", async (tool, tool_input, action, file) => {
  const home = makeHome();
  const sid = `p-${action}`;
  const { code, stdout } = await runHookAt(
    "codex",
    "on-tool.sh",
    { ...base, session_id: sid, tool_name: tool, tool_input },
    home,
  );
  expect(code).toBe(0);
  expect(stdout).toBe("");
  const e = journalLines(home, sid).at(-1);
  expect(e.type).toBe("action");
  expect(e.action).toBe(action);
  expect(e.native).toBe("apply_patch");
  expect(e.file).toBe(file);
});

test.each([
  ["shell", "run"],
  ["exec", "run"],
  ["read", "read"],
  ["WebSearch", "search"],
  ["mcp__github__list_issues", "other"],
  ["something_else", "other"],
])("maps tool %s -> action %s", async (tool, action) => {
  const home = makeHome();
  const { code } = await runHookAt(
    "codex",
    "on-tool.sh",
    { ...base, session_id: "m1", tool_name: tool },
    home,
  );
  expect(code).toBe(0);
  const e = journalLines(home, "m1").at(-1);
  expect(e.action).toBe(action);
  expect(e.native).toBe(tool);
});

test("shell command classifies cmd (force_push) and never stores the raw command", async () => {
  const home = makeHome();
  const command = "git push --force origin secret-branch";
  await runHookAt(
    "codex",
    "on-tool.sh",
    { ...base, session_id: "c1", tool_name: "shell", tool_input: { command } },
    home,
  );
  const e = journalLines(home, "c1").at(-1);
  expect(e.action).toBe("run");
  expect(e.cmd).toBe("force_push");
  // Raw command text must not appear in the journal
  expect(JSON.stringify(e)).not.toContain("secret-branch");
});

test("tool_response error -> action_fail", async () => {
  const home = makeHome();
  await runHookAt(
    "codex",
    "on-tool.sh",
    {
      ...base,
      session_id: "f1",
      tool_name: "shell",
      tool_input: { command: "ls" },
      tool_response: { error: "boom" },
    },
    home,
  );
  expect(journalLines(home, "f1").at(-1).type).toBe("action_fail");
});

test("tool_response success:false -> action_fail", async () => {
  const home = makeHome();
  await runHookAt(
    "codex",
    "on-tool.sh",
    {
      ...base,
      session_id: "f3",
      tool_name: "shell",
      tool_input: { command: "ls" },
      tool_response: { success: false },
    },
    home,
  );
  expect(journalLines(home, "f3").at(-1).type).toBe("action_fail");
});

test("tool_response non-zero exit_code -> action_fail", async () => {
  const home = makeHome();
  await runHookAt(
    "codex",
    "on-tool.sh",
    {
      ...base,
      session_id: "f2",
      tool_name: "shell",
      tool_input: { command: "false" },
      tool_response: { exit_code: 1 },
    },
    home,
  );
  expect(journalLines(home, "f2").at(-1).type).toBe("action_fail");
});

test("malformed stdin still exits 0 with no stdout", async () => {
  const home = makeHome();
  const proc = Bun.spawn(
    ["bash", new URL("../../adapters/codex/hooks/on-tool.sh", import.meta.url).pathname],
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
