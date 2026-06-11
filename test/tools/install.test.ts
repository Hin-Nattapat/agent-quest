import { test, expect } from "bun:test";
import { makeHome } from "../helpers";
import { lstatSync, existsSync, readFileSync } from "fs";
import { join } from "path";

const INSTALL = new URL("../../tools/install.sh", import.meta.url).pathname;

async function runInstall(home: string, args: string[]) {
  const proc = Bun.spawn(["bash", INSTALL, ...args], {
    env: { ...process.env, AGENTRPG_HOME: home },
    stdout: "pipe", stderr: "pipe",
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
