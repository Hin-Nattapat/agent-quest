import { test, expect } from "bun:test";
import { loadConfig } from "../../core/config";
import { DEFAULT_WEIGHTS } from "../../core/xp";
import { makeHome } from "../helpers";
import { writeFileSync } from "fs";
import { join } from "path";

test("missing config.json yields defaults", () => {
  const c = loadConfig(makeHome());
  expect(c.weights.prompt).toBe(5);
  expect(c.difficulty.level_cap).toBe(50);
});

test("config.json overrides merge over defaults", () => {
  const home = makeHome();
  writeFileSync(
    join(home, "config.json"),
    JSON.stringify({
      xp: { weights: { prompt: 9, actions: { edit: 99 } } },
      difficulty: { level_cap: 60 },
    }),
  );
  const c = loadConfig(home);
  expect(c.weights.prompt).toBe(9); // overridden
  expect(c.weights.actions.edit).toBe(99); // nested override
  expect(c.weights.actions.run).toBe(DEFAULT_WEIGHTS.actions.run); // untouched default kept
  expect(c.difficulty.level_cap).toBe(60);
  expect(c.difficulty.curve_k).toBe(7); // untouched default kept
});

test("invalid config.json falls back to defaults", () => {
  const home = makeHome();
  writeFileSync(join(home, "config.json"), "not json");
  expect(loadConfig(home).weights.prompt).toBe(5);
});

import { DEFAULT_ACHIEVEMENTS } from "../../core/achievements";

test("achievements default to the built-in registry", () => {
  const c = loadConfig(makeHome());
  expect(c.achievements?.first_blood?.points).toBe(5);
  expect(Object.keys(c.achievements ?? {}).length).toBe(
    Object.keys(DEFAULT_ACHIEVEMENTS).length,
  );
});

test("config.json can override/add achievements per id", () => {
  const home = makeHome();
  writeFileSync(
    join(home, "config.json"),
    JSON.stringify({
      achievements: {
        first_blood: { name: "X", desc: "", cond: { stat: "level", gte: 99 }, points: 1 },
      },
    }),
  );
  const c = loadConfig(home);
  expect(c.achievements?.first_blood?.points).toBe(1); // overridden
  expect(c.achievements?.tooling_up?.points).toBe(10); // other defaults kept
});

import { DEFAULT_PASSIVE } from "../../core/xp";

test("passive rates default to the built-in set", () => {
  const c = loadConfig(makeHome());
  expect(c.passive?.[1]).toBe(0.2);
  expect(c.passive?.[4]).toBe(0.5);
});

test("config.json overrides passive rates per tier", () => {
  const home = makeHome();
  writeFileSync(join(home, "config.json"), JSON.stringify({ passive: { 1: 0.9 } }));
  const c = loadConfig(home);
  expect(c.passive?.[1]).toBe(0.9); // overridden
  expect(c.passive?.[2]).toBe(DEFAULT_PASSIVE[2]); // default kept
});

import { LOOT_TABLE, DROP_TABLES } from "../../core/loot";

test("loot table and drop tables default to the built-in sets", () => {
  const c = loadConfig(makeHome());
  expect(c.loot?.rookie_title?.name).toBe("Rookie");
  expect(Object.keys(c.loot ?? {}).length).toBe(Object.keys(LOOT_TABLE).length);
  expect(c.drops?.streak100?.[0]?.rarity).toBe(DROP_TABLES.streak100[0].rarity);
});
