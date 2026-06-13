import { test, expect } from "bun:test";
import {
  rollDrop,
  rollInventory,
  resolveCosmetics,
  LOOT_TABLE,
  Rarity,
} from "../../core/loot";

test("rollDrop is deterministic per seed and not null for a known table", () => {
  const a = rollDrop({ trigger: { table: "clean", seed: "s" } });
  expect(a).toBe(rollDrop({ trigger: { table: "clean", seed: "s" } }));
  expect(a).not.toBe(null);
});

test("streak100 always yields a legendary item", () => {
  for (const seed of ["a", "b", "c", "d", "e"]) {
    const id = rollDrop({ trigger: { table: "streak100", seed } })!;
    expect(LOOT_TABLE[id].rarity).toBe(Rarity.Legendary);
  }
});

test("rollInventory aggregates duplicate drops and sorts by id", () => {
  const inv = rollInventory({
    triggers: [
      { table: "clean", seed: "s" },
      { table: "clean", seed: "s" },
    ],
  });
  expect(inv.length).toBe(1);
  expect(inv[0].count).toBe(2);
});

test("resolveCosmetics maps owned equips, ignores unowned/wrong-kind", () => {
  const inv = [
    { id: "rookie_title", rarity: Rarity.Common, count: 1 },
    { id: "neon_theme", rarity: Rarity.Rare, count: 1 },
  ];
  const r = resolveCosmetics({
    profile: { title: "rookie_title", theme: "neon_theme" },
    inventory: inv,
  });
  expect(r.title).toBe("Rookie");
  expect(r.theme_color).toBe("36");
  expect(
    resolveCosmetics({ profile: { title: "archmage_title" }, inventory: inv }).title,
  ).toBe(null); // not owned
  expect(
    resolveCosmetics({ profile: { title: "neon_theme" }, inventory: inv }).title,
  ).toBe(null); // wrong kind
});

test("resolveCosmetics resolves an earned-achievement title; loot title still wins", () => {
  const inv = [{ id: "rookie_title", rarity: Rarity.Common, count: 1 }];
  const earned = { undying: "the Undying" };
  expect(
    resolveCosmetics({
      profile: { title: "undying" },
      inventory: [],
      earnedTitles: earned,
    }).title,
  ).toBe("the Undying");
  expect(
    resolveCosmetics({ profile: { title: "undying" }, inventory: [], earnedTitles: {} })
      .title,
  ).toBe(null);
  expect(
    resolveCosmetics({
      profile: { title: "rookie_title" },
      inventory: inv,
      earnedTitles: earned,
    }).title,
  ).toBe("Rookie");
});

import { DROP_TABLES, DEFAULT_BOSS_RATE, DEFAULT_BOSS_FLEE_RATE } from "../../core/loot";

test("the boss drop table exists and rolls a valid item", () => {
  expect(DROP_TABLES.boss).toBeDefined();
  const id = rollDrop({ trigger: { table: "boss", seed: "b1" } });
  expect(id).not.toBe(null);
  expect(LOOT_TABLE[id!]).toBeDefined();
});

test("boss rate defaults are sane fractions", () => {
  expect(DEFAULT_BOSS_RATE).toBeGreaterThan(0);
  expect(DEFAULT_BOSS_RATE).toBeLessThan(1);
  expect(DEFAULT_BOSS_FLEE_RATE).toBeGreaterThan(0);
  expect(DEFAULT_BOSS_FLEE_RATE).toBeLessThan(1);
});
