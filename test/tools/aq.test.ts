import { test, expect } from "bun:test";
import { makeHome } from "../helpers";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "fs";
import { join } from "path";

const AQ = new URL("../../tools/aq.ts", import.meta.url).pathname;

function seedLevel(home: string, prompts: number) {
  const dir = join(home, "journal");
  mkdirSync(dir, { recursive: true });
  const line = `{"ts":"2026-06-11T12:00:00Z","source":"claude-code","session_id":"s","type":"prompt","repo":"cq"}`;
  writeFileSync(join(dir, "s.ndjson"), Array(prompts).fill(line).join("\n") + "\n");
}

async function aq(home: string, ...args: string[]) {
  const proc = Bun.spawn(["bun", AQ, ...args], {
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
  const r = await aq(home, "name", "Gandalf");
  expect(r.code).toBe(0);
  expect(profile(home).name).toBe("Gandalf");
});

test("class is rejected below level 5", async () => {
  const home = makeHome();
  seedLevel(home, 1); // ~5 xp -> level 1
  const r = await aq(home, "class", "mage");
  expect(r.code).toBe(1);
  expect(r.stderr).toContain("level 5");
});

test("class is accepted at level 5+ and resolves the form", async () => {
  const home = makeHome();
  seedLevel(home, 60); // 300 xp -> level 5
  const r = await aq(home, "class", "mage");
  expect(r.code).toBe(0);
  expect(profile(home).line).toBe("mage");
  const state = JSON.parse(readFileSync(join(home, "state.json"), "utf8"));
  expect(state.class.form).toBe("Backend Mage");
});

test("branch is rejected below level 50", async () => {
  const home = makeHome();
  seedLevel(home, 60);
  await aq(home, "class", "mage");
  const r = await aq(home, "branch", "a");
  expect(r.code).toBe(1);
  expect(r.stderr).toContain("level 50");
});

test("status prints a suggested line", async () => {
  const home = makeHome();
  seedLevel(home, 60);
  const r = await aq(home, "status");
  expect(r.code).toBe(0);
  expect(r.stdout).toContain("suggested line");
});

test("status shows the passive percentage once a class is set", async () => {
  const home = makeHome();
  seedLevel(home, 60); // Lv.5
  await aq(home, "class", "mage");
  const r = await aq(home, "status");
  expect(r.code).toBe(0);
  expect(r.stdout).toContain("passive: +20%");
});

import { rollDrop, LOOT_TABLE, LootKind } from "../../core/loot";

// a zero-weight config so a session_end is the only trigger (one deterministic clean drop)
function seedOneClean(home: string) {
  writeFileSync(
    join(home, "config.json"),
    JSON.stringify({
      xp: {
        weights: {
          prompt: 0,
          turn_end: 0,
          session_end: 0,
          actions: {
            edit: 0,
            write: 0,
            run: 0,
            read: 0,
            search: 0,
            delegate: 0,
            other: 0,
          },
        },
      },
    }),
  );
  const dir = join(home, "journal");
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "s.ndjson"),
    `{"ts":"2026-06-11T12:00:00Z","source":"claude-code","session_id":"s","type":"session_end","repo":"cq"}\n`,
  );
}

test("inventory lists owned items after a clean session", async () => {
  const home = makeHome();
  seedOneClean(home);
  const r = await aq(home, "inventory");
  expect(r.code).toBe(0);
  expect(r.stdout).not.toContain("empty");
});

test("equipping an owned item succeeds; an unowned one errors", async () => {
  const home = makeHome();
  seedOneClean(home);
  const droppedId = rollDrop({ trigger: { table: "clean", seed: "clean:s" } })!;
  const kind = LOOT_TABLE[droppedId].kind;
  if (kind !== LootKind.Skin) {
    const ok = await aq(home, kind, droppedId);
    expect(ok.code).toBe(0);
  }
  const unowned = Object.keys(LOOT_TABLE).find(
    id => id !== droppedId && LOOT_TABLE[id].kind === LootKind.Title,
  )!;
  const bad = await aq(home, "title", unowned);
  expect(bad.code).toBe(1);
});

test("a locked secret class is rejected; xyzzy unlocks the Trickster and lets you equip it", async () => {
  const home = makeHome();
  seedLevel(home, 60); // Lv.5+
  const locked = await aq(home, "class", "maestro");
  expect(locked.code).toBe(1); // not unlocked

  const egg = await aq(home, "xyzzy");
  expect(egg.code).toBe(0);
  expect(profile(home).xyzzy).toBe(true);

  const sec = await aq(home, "secrets");
  expect(sec.stdout).toContain("trickster");

  const equip = await aq(home, "class", "trickster");
  expect(equip.code).toBe(0);
  expect(profile(home).line).toBe("trickster");
});

function seedCmd(home: string, cmd: string) {
  const dir = join(home, "journal");
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "s.ndjson"),
    `{"ts":"2026-06-11T12:00:00Z","source":"claude-code","session_id":"s","type":"action","action":"run","repo":"cq","cmd":"${cmd}"}\n`,
  );
}

test("an earned deed title is listed and equippable; a locked one is rejected", async () => {
  const home = makeHome();
  const locked = await aq(home, "title", "undying");
  expect(locked.code).toBe(1); // not earned yet

  seedCmd(home, "reflog"); // earns `undying` -> "the Undying"
  const list = await aq(home, "titles");
  expect(list.stdout).toContain("undying");

  const equip = await aq(home, "title", "undying");
  expect(equip.code).toBe(0);
  expect(profile(home).title).toBe("undying");
});

test("aq setup runs the wiring engine (no-tty print fallback)", async () => {
  const home = makeHome();
  const proc = Bun.spawn(["bun", AQ, "setup"], {
    env: { ...process.env, AGENTRPG_HOME: home, HOME: home },
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
  });
  const stdout = await new Response(proc.stdout).text();
  const code = await proc.exited;
  expect(code).toBe(0);
  expect(stdout).toContain("no terminal"); // fell back to print-only
});

test("aq setup bootstraps the engine into AGENTRPG_HOME when it is missing", async () => {
  const home = makeHome();
  expect(existsSync(join(home, "adapters"))).toBe(false);
  const proc = Bun.spawn(["bun", AQ, "setup"], {
    env: { ...process.env, AGENTRPG_HOME: home, HOME: home },
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
  });
  const stdout = await new Response(proc.stdout).text();
  expect(await proc.exited).toBe(0);
  expect(existsSync(join(home, "adapters/claude-code/hooks/on-tool.sh"))).toBe(true); // deployed
  expect(stdout).toContain("no terminal"); // then reached the wiring step
});

test("aq setup does not re-deploy when the engine is already present", async () => {
  const home = makeHome();
  mkdirSync(join(home, "adapters"), { recursive: true });
  writeFileSync(join(home, "adapters/MARKER"), "keep");
  const proc = Bun.spawn(["bun", AQ, "setup"], {
    env: { ...process.env, AGENTRPG_HOME: home, HOME: home },
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
  });
  await proc.exited;
  expect(existsSync(join(home, "adapters/MARKER"))).toBe(true); // not clobbered → no re-deploy
});

test("aq --help prints grouped help and exits 0", async () => {
  const home = makeHome();
  const r = await aq(home, "--help");
  expect(r.code).toBe(0);
  expect(r.stdout).toContain("Usage:  aq <command>");
  expect(r.stdout).toContain("setup");
  expect(r.stdout).toContain("status");
  expect(r.stdout).not.toContain("xyzzy"); // easter egg stays hidden
});

test("aq -h is an alias for --help", async () => {
  const home = makeHome();
  const r = await aq(home, "-h");
  expect(r.code).toBe(0);
  expect(r.stdout).toContain("Usage:  aq <command>");
});

test("aq with no args shows help and exits 0", async () => {
  const home = makeHome();
  const r = await aq(home);
  expect(r.code).toBe(0);
  expect(r.stdout).toContain("Usage:  aq <command>");
});

test("aq with an unknown command errors and exits 1", async () => {
  const home = makeHome();
  const r = await aq(home, "bogus");
  expect(r.code).toBe(1);
  expect(r.stderr).toContain("unknown command: bogus");
});
