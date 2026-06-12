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

import { readFileSync } from "fs";
import { join } from "path";

test.each([
  ["git rebase feature --onto main", "git_rebase_onto"],
  ["git rebase -i HEAD~3", "git_rebase_i"],
  ["git cherry-pick abc123", "cherry_pick"],
  ["git push --force origin x", "force_push"],
  ["git bisect start", "bisect"],
  ["git reflog", "reflog"],
  ["git stash push -m wip", "stash"],
  ["gh pr merge 12 --merge", "pr_merge"],
  ["git push origin main", "cowboy"],
  ["bun test", "test_run"],
])("classifies Bash command %s -> cmd %s", async (command, cmd) => {
  const home = makeHome();
  await runHook(
    "on-tool.sh",
    { ...base, session_id: "c1", tool_name: "Bash", tool_input: { command } },
    home,
  );
  const e = journalLines(home, "c1").at(-1);
  expect(e.cmd).toBe(cmd);
});

test("a non-matching command adds no cmd and never stores the raw command", async () => {
  const home = makeHome();
  const command = "ls -la /secret/path";
  await runHook(
    "on-tool.sh",
    { ...base, session_id: "c2", tool_name: "Bash", tool_input: { command } },
    home,
  );
  const raw = readFileSync(join(home, "journal", "c2.ndjson"), "utf8");
  expect(raw).not.toContain("/secret/path");
  expect(journalLines(home, "c2").at(-1).cmd).toBeUndefined();
});

test("non-Bash tools never get a cmd", async () => {
  const home = makeHome();
  await runHook(
    "on-tool.sh",
    {
      ...base,
      session_id: "c3",
      tool_name: "Edit",
      tool_input: { command: "git reflog" },
    },
    home,
  );
  expect(journalLines(home, "c3").at(-1).cmd).toBeUndefined();
});
