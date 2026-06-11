import { test, expect } from "bun:test";
import { makeHome } from "../helpers";
import { mkdirSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";

const RPG = new URL("../../tools/rpg.ts", import.meta.url).pathname;

function seedLevel(home: string, prompts: number) {
  const dir = join(home, "journal");
  mkdirSync(dir, { recursive: true });
  const line = `{"ts":"2026-06-11T12:00:00Z","source":"claude-code","session_id":"s","type":"prompt","repo":"cq"}`;
  writeFileSync(join(dir, "s.ndjson"), Array(prompts).fill(line).join("\n") + "\n");
}

async function rpg(home: string, ...args: string[]) {
  const proc = Bun.spawn(["bun", RPG, ...args], {
    env: { ...process.env, AGENTRPG_HOME: home },
    stdout: "pipe",
    stderr: "pipe",
  });
  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  return { stdout, stderr, code: await proc.exited };
}

const profile = (home: string) =>
  JSON.parse(readFileSync(join(home, "profile.json"), "utf8"));

test("name writes profile.json and exits 0", async () => {
  const home = makeHome();
  seedLevel(home, 1);
  const r = await rpg(home, "name", "Gandalf");
  expect(r.code).toBe(0);
  expect(profile(home).name).toBe("Gandalf");
});

test("class is rejected below level 5", async () => {
  const home = makeHome();
  seedLevel(home, 1); // ~5 xp -> level 1
  const r = await rpg(home, "class", "mage");
  expect(r.code).toBe(1);
  expect(r.stderr).toContain("level 5");
});

test("class is accepted at level 5+ and resolves the form", async () => {
  const home = makeHome();
  seedLevel(home, 60); // 300 xp -> level 5
  const r = await rpg(home, "class", "mage");
  expect(r.code).toBe(0);
  expect(profile(home).line).toBe("mage");
  const state = JSON.parse(readFileSync(join(home, "state.json"), "utf8"));
  expect(state.class.form).toBe("Backend Mage");
});

test("branch is rejected below level 50", async () => {
  const home = makeHome();
  seedLevel(home, 60);
  await rpg(home, "class", "mage");
  const r = await rpg(home, "branch", "a");
  expect(r.code).toBe(1);
  expect(r.stderr).toContain("level 50");
});

test("status prints a suggested line", async () => {
  const home = makeHome();
  seedLevel(home, 60);
  const r = await rpg(home, "status");
  expect(r.code).toBe(0);
  expect(r.stdout).toContain("suggested line");
});
