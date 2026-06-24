import { test, expect } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";

const REPO = new URL("../..", import.meta.url).pathname;
const adapter = (p: string) => join(REPO, "adapters", p);
const readJson = (p: string) => JSON.parse(readFileSync(p, "utf8"));

const MANIFESTS = ["claude-code", "codex", "cursor", "copilot"];

test("every adapter manifest has the required fields", () => {
  for (const id of MANIFESTS) {
    const m = readJson(adapter(`${id}/wire.json`));
    expect(m.id).toBe(id);
    expect(Array.isArray(m.detect)).toBe(true);
    expect(m.detect.length).toBeGreaterThan(0);
    expect(typeof m.target).toBe("string");
    expect(["json-merge", "toml-append", "json-drop"]).toContain(m.format);
    expect(typeof m.snippet).toBe("string");
  }
});

test("only claude-code declares HUD support, with a statusline snippet", () => {
  const cc = readJson(adapter("claude-code/wire.json"));
  expect(cc.hud).toBe(true);
  expect(cc.hud_snippet).toBe("statusline.snippet.json");
  for (const id of ["codex", "cursor", "copilot"]) {
    const m = readJson(adapter(`${id}/wire.json`));
    expect(m.hud ?? false).toBe(false);
  }
});

test("statusLine lives only in statusline.snippet.json, not in settings.snippet.json", () => {
  const hooks = readJson(adapter("claude-code/settings.snippet.json"));
  const hud = readJson(adapter("claude-code/statusline.snippet.json"));
  expect(hooks.statusLine).toBeUndefined();
  expect(hooks.hooks).toBeDefined();
  expect(hud.statusLine.command).toContain("hud/statusline.ts");
});

import { mkdtempSync, mkdirSync } from "fs";
import { tmpdir } from "os";

const WIRE = join(REPO, "scripts/wire.sh");

async function runWire(args: string[], home: string) {
  const proc = Bun.spawn(["bash", WIRE, ...args], {
    env: { ...process.env, HOME: home, PATH: process.env.PATH ?? "" },
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
  });
  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const code = await proc.exited;
  return { stdout, stderr, code };
}

function fakeHome(dirs: string[] = []): string {
  const home = mkdtempSync(join(tmpdir(), "wire-test-"));
  for (const d of dirs) {
    mkdirSync(join(home, d), { recursive: true });
  }
  return home;
}

test("detect lists an agent whose config dir exists", async () => {
  const home = fakeHome([".cursor"]);
  const { stdout, code } = await runWire(["detect"], home);
  expect(code).toBe(0);
  expect(stdout.split("\n")).toContain("cursor");
});

test("detect omits an agent whose config dir is absent", async () => {
  const home = fakeHome([]); // no .cursor
  const { stdout } = await runWire(["detect"], home);
  expect(stdout.split("\n")).not.toContain("cursor");
});

test("print emits the target path and the hook snippet body", async () => {
  const home = fakeHome();
  const { stdout, code } = await runWire(["print", "claude-code"], home);
  expect(code).toBe(0);
  expect(stdout).toContain("Merge this into");
  expect(stdout).toContain(".claude/settings.json");
  expect(stdout).toContain("on-session-start.sh"); // a hook from the snippet
});

import { existsSync, writeFileSync } from "fs";

test("apply json-merge writes hooks into a fresh target", async () => {
  const home = fakeHome();
  const { code } = await runWire(["apply", "claude-code"], home);
  expect(code).toBe(0);
  const settings = readJson(join(home, ".claude/settings.json"));
  expect(settings.hooks.SessionStart).toBeDefined();
});

test("apply json-merge backs up an existing target and is idempotent", async () => {
  const home = fakeHome([".claude"]);
  const target = join(home, ".claude/settings.json");
  writeFileSync(target, JSON.stringify({ editor: { tabSize: 2 } }));
  await runWire(["apply", "claude-code"], home);
  expect(existsSync(target + ".bak")).toBe(true);
  const first = readFileSync(target, "utf8");
  const merged = JSON.parse(first);
  expect(merged.editor.tabSize).toBe(2); // user key preserved
  expect(merged.hooks.SessionStart).toBeDefined();
  await runWire(["apply", "claude-code"], home); // second run
  expect(JSON.parse(readFileSync(target, "utf8"))).toEqual(merged); // no change
});

test("apply leaves a malformed JSON target untouched and prints instead", async () => {
  const home = fakeHome([".claude"]);
  const target = join(home, ".claude/settings.json");
  writeFileSync(target, "{ not json");
  const { stdout, code } = await runWire(["apply", "claude-code"], home);
  expect(code).toBe(0);
  expect(readFileSync(target, "utf8")).toBe("{ not json"); // unchanged
  expect(stdout).toContain("Merge this into");
});

test("apply toml-append adds the block once, guarded by a sentinel", async () => {
  const home = fakeHome([".codex"]);
  const target = join(home, ".codex/config.toml");
  writeFileSync(target, 'model = "gpt-x"\n');
  await runWire(["apply", "codex"], home);
  const after = readFileSync(target, "utf8");
  expect(after).toContain('model = "gpt-x"'); // user content kept
  expect(after).toContain(">>> agent-quest >>>");
  await runWire(["apply", "codex"], home); // second run
  const sentinels = readFileSync(target, "utf8").match(/>>> agent-quest >>>/g) ?? [];
  expect(sentinels.length).toBe(1); // not re-appended
});

test("apply json-drop writes copilot's own hook file", async () => {
  const home = fakeHome([".copilot"]);
  await runWire(["apply", "copilot"], home);
  const dropped = join(home, ".copilot/hooks/agent-quest.json");
  expect(existsSync(dropped)).toBe(true);
  expect(readJson(dropped)).toBeDefined();
});

test("apply-hud merges the statusLine for claude-code", async () => {
  const home = fakeHome();
  await runWire(["apply", "claude-code"], home);
  await runWire(["apply-hud", "claude-code"], home);
  const settings = readJson(join(home, ".claude/settings.json"));
  expect(settings.statusLine.command).toContain("hud/statusline.ts");
  expect(settings.hooks.SessionStart).toBeDefined(); // hooks still present
});

test("apply-hud is a silent no-op for a non-HUD agent", async () => {
  const home = fakeHome([".cursor"]);
  const { stdout, code } = await runWire(["apply-hud", "cursor"], home);
  expect(code).toBe(0);
  expect(stdout.trim()).toBe("");
  expect(existsSync(join(home, ".cursor/hooks.json"))).toBe(false);
});

test("interactive with no TTY prints a notice and the detected agent's wiring", async () => {
  const home = fakeHome([".cursor"]);
  const { stdout, code } = await runWire(["interactive"], home);
  expect(code).toBe(0);
  expect(stdout).toContain("no terminal");
  expect(stdout).toContain(".cursor/hooks.json"); // cursor detected -> printed
});

test("interactive with no TTY and nothing detected falls back to claude-code", async () => {
  const home = fakeHome([]); // detect finds nothing
  const { stdout } = await runWire(["interactive"], home);
  expect(stdout).toContain(".claude/settings.json");
});
