import { test, expect } from "bun:test";
import { runHookAt, journalLines, repoCache, makeHome, basename } from "../helpers";
import { EventType } from "../../core/events";
import { mkdtempSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

test("codex SessionStart: repo resolved + cached, start/model/cwd present, source=codex", async () => {
  const home = makeHome();
  const gitdir = mkdtempSync(join(tmpdir(), "cq-gitrepo-"));
  Bun.spawnSync(["git", "init", gitdir]);
  const { code, stdout } = await runHookAt(
    "codex",
    "on-session-start.sh",
    {
      session_id: "x1",
      cwd: gitdir,
      hook_event_name: "SessionStart",
      source: "startup",
      model: "gpt-5-codex",
    },
    home,
  );
  expect(code).toBe(0);
  expect(stdout).toBe("");
  const e = journalLines(home, "x1").at(-1);
  expect(e.type).toBe(EventType.SessionStart);
  expect(e.source).toBe("codex");
  expect(e.repo).toBe(basename(gitdir));
  expect(e.start).toBe("startup");
  expect(e.model).toBe("gpt-5-codex");
  expect(repoCache(home, "x1")).toBe(basename(gitdir));
});

test("codex UserPromptSubmit -> prompt (source=codex)", async () => {
  const home = makeHome();
  const { code, stdout } = await runHookAt(
    "codex",
    "on-prompt.sh",
    {
      session_id: "x2",
      cwd: "/tmp/cq-not-a-repo",
      hook_event_name: "UserPromptSubmit",
      prompt: "hi",
    },
    home,
  );
  expect(code).toBe(0);
  expect(stdout).toBe("");
  const e = journalLines(home, "x2").at(-1);
  expect(e.type).toBe(EventType.Prompt);
  expect(e.source).toBe("codex");
});

test("codex Stop -> turn_end", async () => {
  const home = makeHome();
  await runHookAt(
    "codex",
    "on-stop.sh",
    { session_id: "x3", cwd: "/tmp/cq-not-a-repo", hook_event_name: "Stop" },
    home,
  );
  expect(journalLines(home, "x3").at(-1).type).toBe(EventType.TurnEnd);
});

test("codex prompt: malformed stdin still exits 0 with no stdout", async () => {
  const home = makeHome();
  const proc = Bun.spawn(
    [
      "bash",
      new URL("../../adapters/codex/hooks/on-prompt.sh", import.meta.url).pathname,
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
