import { test, expect } from "bun:test";
import { makeHome } from "../helpers";
import { lstatSync, existsSync, readFileSync } from "fs";
import { join } from "path";

const INSTALL = new URL("../../tools/install.sh", import.meta.url).pathname;

async function runInstall(home: string, args: string[]) {
  const proc = Bun.spawn(["bash", INSTALL, ...args], {
    env: { ...process.env, AGENTRPG_HOME: home },
    stdout: "pipe",
    stderr: "pipe",
  });
  const stdout = await new Response(proc.stdout).text();
  const code = await proc.exited;
  return { stdout, code };
}

test("--link symlinks adapters/tools and sets up the home", async () => {
  const home = makeHome();
  const { code, stdout } = await runInstall(home, ["--link"]);
  expect(code).toBe(0);
  expect(lstatSync(join(home, "adapters")).isSymbolicLink()).toBe(true);
  expect(existsSync(join(home, "adapters/claude-code/hooks/on-tool.sh"))).toBe(true); // resolves through link
  expect(existsSync(join(home, "journal"))).toBe(true);
  expect(existsSync(join(home, "config.json"))).toBe(true);
  expect(stdout).toContain("Merge this");
});

test("copy mode copies real files (not symlinks)", async () => {
  const home = makeHome();
  const { code } = await runInstall(home, []);
  expect(code).toBe(0);
  expect(lstatSync(join(home, "adapters")).isSymbolicLink()).toBe(false);
  expect(existsSync(join(home, "tools/inspect.ts"))).toBe(true);
});

test("copy mode makes every adapter's hooks executable (codex included)", async () => {
  const home = makeHome();
  const { code } = await runInstall(home, []);
  expect(code).toBe(0);
  for (const hook of [
    "adapters/claude-code/hooks/on-tool.sh",
    "adapters/codex/hooks/on-tool.sh",
  ]) {
    const p = join(home, hook);
    expect(existsSync(p)).toBe(true);
    expect((lstatSync(p).mode & 0o111) !== 0).toBe(true); // executable
  }
});

test("does not overwrite an existing config.json", async () => {
  const home = makeHome();
  const cfg = join(home, "config.json");
  await Bun.write(cfg, `{"custom":true}`);
  await runInstall(home, ["--link"]);
  expect(JSON.parse(readFileSync(cfg, "utf8")).custom).toBe(true);
});

test("--link deploys hud/", async () => {
  const home = makeHome();
  await runInstall(home, ["--link"]);
  expect(existsSync(join(home, "hud/statusline.ts"))).toBe(true);
});

test("deploys the aq wrapper + completions, and the wrapper runs", async () => {
  const home = makeHome();
  const { code, stdout } = await runInstall(home, ["--link"]);
  expect(code).toBe(0);

  const aq = join(home, "bin/aq");
  expect(existsSync(aq)).toBe(true);
  expect((lstatSync(aq).mode & 0o111) !== 0).toBe(true); // executable
  expect(existsSync(join(home, "completions/_aq"))).toBe(true);
  expect(existsSync(join(home, "completions/aq.bash"))).toBe(true);
  expect(stdout).toContain("aq' command");

  const proc = Bun.spawn(["bash", aq, "status"], {
    env: { ...process.env, AGENTRPG_HOME: home },
    stdout: "pipe",
    stderr: "pipe",
  });
  expect(await proc.exited).toBe(0);
});

test("--agent claude-code --apply wires the settings file", async () => {
  const home = makeHome();
  const proc = Bun.spawn(
    ["bash", INSTALL, "--link", "--agent", "claude-code", "--apply"],
    {
      env: { ...process.env, AGENTRPG_HOME: home, HOME: home },
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  const code = await proc.exited;
  expect(code).toBe(0);
  expect(existsSync(join(home, ".claude/settings.json"))).toBe(true);
  const settings = JSON.parse(readFileSync(join(home, ".claude/settings.json"), "utf8"));
  expect(settings.hooks.SessionStart).toBeDefined();
  expect(settings.statusLine).toBeUndefined(); // HUD not requested
});

test("--link deploys scripts/wire.sh", async () => {
  const home = makeHome();
  await runInstall(home, ["--link"]);
  expect(existsSync(join(home, "scripts/wire.sh"))).toBe(true);
});

test("--agent claude-code --apply --hud also wires the statusline", async () => {
  const home = makeHome();
  const proc = Bun.spawn(
    ["bash", INSTALL, "--link", "--agent", "claude-code", "--apply", "--hud"],
    {
      env: { ...process.env, AGENTRPG_HOME: home, HOME: home },
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  await proc.exited;
  const settings = JSON.parse(readFileSync(join(home, ".claude/settings.json"), "utf8"));
  expect(settings.statusLine.command).toContain("hud/statusline.ts");
});
