import { test, expect } from "bun:test";
import { runEmit, journalLines, repoCache, makeHome, basename } from "../helpers";
import { isNormalizedEvent, EventType, AgentAction } from "../../core/events";
import { mkdtempSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

test("emits a valid prompt event with default source", async () => {
  const home = makeHome();
  const { code, stdout } = await runEmit(
    ["--type", "prompt", "--session", "e1", "--cwd", "/tmp/cq-not-a-repo"],
    home,
  );
  expect(code).toBe(0);
  expect(stdout).toBe("");
  const e = journalLines(home, "e1").at(-1);
  expect(isNormalizedEvent(e)).toBe(true);
  expect(e.type).toBe(EventType.Prompt);
  expect(e.source).toBe("claude-code"); // default
  expect(e.repo).toBe("cq-not-a-repo"); // basename fallback
});

test("--source overrides the adapter id", async () => {
  const home = makeHome();
  await runEmit(["--type", "prompt", "--session", "e2", "--source", "codex"], home);
  expect(journalLines(home, "e2").at(-1).source).toBe("codex");
});

test("session_start resolves + caches a git repo and carries cwd/start/model", async () => {
  const home = makeHome();
  const gitdir = mkdtempSync(join(tmpdir(), "cq-gitrepo-"));
  Bun.spawnSync(["git", "init", gitdir]);
  await runEmit(
    [
      "--type",
      "session_start",
      "--session",
      "e3",
      "--cwd",
      gitdir,
      "--start",
      "startup",
      "--model",
      "claude-opus-4-8",
    ],
    home,
  );
  const e = journalLines(home, "e3").at(-1);
  expect(e.type).toBe(EventType.SessionStart);
  expect(e.repo).toBe(basename(gitdir));
  expect(e.cwd).toBe(gitdir);
  expect(e.start).toBe("startup");
  expect(e.model).toBe("claude-opus-4-8");
  expect(repoCache(home, "e3")).toBe(basename(gitdir));
});

test("action carries action/native/cmd/file; omits empty optionals", async () => {
  const home = makeHome();
  await runEmit(
    [
      "--type",
      "action",
      "--session",
      "e4",
      "--repo",
      "demo",
      "--action",
      "run",
      "--native",
      "Bash",
      "--cmd",
      "force_push",
    ],
    home,
  );
  const e = journalLines(home, "e4").at(-1);
  expect(e.type).toBe(EventType.Action);
  expect(e.action).toBe(AgentAction.Run);
  expect(e.native).toBe("Bash");
  expect(e.cmd).toBe("force_push");
  expect(e.file).toBeUndefined();
  expect(e.cwd).toBeUndefined(); // cwd only on session_start
});

test("a cached repo is reused without --cwd", async () => {
  const home = makeHome();
  await runEmit(
    ["--type", "session_start", "--session", "e5", "--repo", "cached-repo"],
    home,
  );
  await runEmit(["--type", "prompt", "--session", "e5"], home);
  expect(journalLines(home, "e5").at(-1).repo).toBe("cached-repo");
});

test("missing --type writes nothing and exits 0", async () => {
  const home = makeHome();
  const { code, stdout } = await runEmit(["--session", "e6"], home);
  expect(code).toBe(0);
  expect(stdout).toBe("");
  expect(journalLines(home, "e6").length).toBe(0);
});

test("cmd-tag.jq classifies a command, else empty", () => {
  const lib = join(import.meta.dir, "../../adapters/generic");
  const run = (c: string) =>
    Bun.spawnSync([
      "jq",
      "-L",
      lib,
      "-rn",
      'include "cmd-tag"; cmd_tag($c)',
      "--arg",
      "c",
      c,
    ])
      .stdout.toString()
      .trim();
  expect(run("git push --force origin x")).toBe("force_push");
  expect(run("bun test")).toBe("test_run");
  expect(run("ls -la")).toBe("");
});
