import { test, expect } from "bun:test";
import { makeHome } from "../helpers";
import { writeFileSync } from "fs";
import { join } from "path";

const SCRIPT = new URL("../../hud/statusline.ts", import.meta.url).pathname;

test("statusline prints a HUD line from a seeded state, exit 0", async () => {
  const home = makeHome();
  // seed a fresh state.json so the throttle skips re-reduce and uses this state
  writeFileSync(
    join(home, "state.json"),
    JSON.stringify({
      version: 1,
      updated_at: "t",
      xp_total: 224,
      level: 5,
      xp_in_level: 0,
      xp_to_next: 167,
      stats: { prompts: 0, actions: {}, sessions: 0, by_source: {}, by_repo: {} },
    }),
  );
  const stdin = JSON.stringify({
    model: { display_name: "Opus 4.8" },
    cost: { total_cost_usd: 0.42 },
    context_window: { used_percentage: 8 },
  });
  const proc = Bun.spawn(["bun", SCRIPT], {
    stdin: Buffer.from(stdin),
    env: { ...process.env, AGENTRPG_HOME: home },
    stdout: "pipe",
    stderr: "pipe",
  });
  const out = await new Response(proc.stdout).text();
  expect(await proc.exited).toBe(0);
  expect(out).toContain("Lv.5");
  expect(out).toContain("Opus 4.8");
  expect(out).toContain("$0.42");
  expect(out).toContain("ctx 8%");
});

test("statusline never throws on empty stdin / empty home", async () => {
  const home = makeHome();
  const proc = Bun.spawn(["bun", SCRIPT], {
    stdin: Buffer.from(""),
    env: { ...process.env, AGENTRPG_HOME: home },
    stdout: "pipe",
    stderr: "pipe",
  });
  const out = await new Response(proc.stdout).text();
  expect(await proc.exited).toBe(0);
  expect(out).toContain("Lv.1");
});

test("statusline shows the active source only when >= 2 sources", async () => {
  const seed = (home: string, bySource: object, lastSource: string | null) => {
    writeFileSync(
      join(home, "state.json"),
      JSON.stringify({
        version: 1,
        updated_at: "t",
        xp_total: 224,
        level: 5,
        xp_in_level: 0,
        xp_to_next: 167,
        stats: { prompts: 0, actions: {}, sessions: 0, by_source: bySource, by_repo: {} },
        ...(lastSource
          ? { last_event: { ts: "t", type: "prompt", source: lastSource } }
          : {}),
      }),
    );
  };
  const run = async (home: string) => {
    const proc = Bun.spawn(["bun", SCRIPT], {
      stdin: Buffer.from(JSON.stringify({ model: { display_name: "M" } })),
      env: { ...process.env, AGENTRPG_HOME: home },
      stdout: "pipe",
      stderr: "pipe",
    });
    const out = await new Response(proc.stdout).text();
    expect(await proc.exited).toBe(0);
    return out;
  };

  const multi = makeHome();
  seed(
    multi,
    { "claude-code": { xp: 100, sessions: 1 }, codex: { xp: 50, sessions: 1 } },
    "codex",
  );
  expect(await run(multi)).toContain("via Codex");

  const solo = makeHome();
  seed(solo, { "claude-code": { xp: 100, sessions: 1 } }, "claude-code");
  expect(await run(solo)).not.toContain("via");
});
