import { test, expect } from "bun:test";
import { runHook, journalLines, repoCache, makeHome, basename } from "../helpers";
import { mkdtempSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

test("session_start: git repo resolved, cached, fields present", async () => {
  const home = makeHome();
  const gitdir = mkdtempSync(join(tmpdir(), "cq-gitrepo-"));
  Bun.spawnSync(["git", "init", gitdir]);

  const { code, stdout } = await runHook(
    "on-session-start.sh",
    {
      session_id: "s1",
      cwd: gitdir,
      hook_event_name: "SessionStart",
      source: "startup",
      model: "claude-sonnet-4-6",
    },
    home,
  );

  expect(code).toBe(0);
  expect(stdout).toBe("");

  const e = journalLines(home, "s1").at(-1);
  expect(e.type).toBe("session_start");
  expect(e.repo).toBe(basename(gitdir));
  expect(e.start).toBe("startup");
  expect(e.model).toBe("claude-sonnet-4-6");
  expect(e.cwd).toBe(gitdir);

  expect(repoCache(home, "s1")).toBe(basename(gitdir)); // cache written
});

test("session_start: non-git cwd falls back to basename", async () => {
  const home = makeHome();
  const { code } = await runHook(
    "on-session-start.sh",
    {
      session_id: "s2",
      cwd: "/tmp/cq-not-a-repo",
      hook_event_name: "SessionStart",
      source: "resume",
    },
    home,
  );
  expect(code).toBe(0);
  const e = journalLines(home, "s2").at(-1);
  expect(e.repo).toBe("cq-not-a-repo");
  expect(e.start).toBe("resume");
});

test("session_start: omitted cwd does not shift model into cwd (empty-cwd regression)", async () => {
  const home = makeHome();
  const { code, stdout } = await runHook(
    "on-session-start.sh",
    {
      session_id: "s3",
      hook_event_name: "SessionStart",
      source: "startup",
      model: "claude-opus-4-5",
    },
    home,
  );
  expect(code).toBe(0);
  expect(stdout).toBe("");
  const e = journalLines(home, "s3").at(-1);
  // model must not be shifted into another field
  expect(e.model).toBe("claude-opus-4-5");
  // repo must not be derived from the model slug (may be absent when cwd is omitted)
  if (typeof e.repo === "string") {
    expect(e.repo).not.toContain("claude");
  }
  expect(e.start).toBe("startup");
});
