import { test, expect } from "bun:test";
import {
  rollDrop,
  rollInventory,
  resolveCosmetics,
  LOOT_TABLE,
  Rarity,
} from "../../core/loot";

test("rollDrop is deterministic per seed and not null for a known table", () => {
  const a = rollDrop({ table: "clean", seed: "s" });
  expect(a).toBe(rollDrop({ table: "clean", seed: "s" }));
  expect(a).not.toBe(null);
});

test("streak100 always yields a legendary item", () => {
  for (const seed of ["a", "b", "c", "d", "e"]) {
    const id = rollDrop({ table: "streak100", seed })!;
    expect(LOOT_TABLE[id].rarity).toBe(Rarity.Legendary);
  }
});

test("rollInventory aggregates duplicate drops and sorts by id", () => {
  const inv = rollInventory([
    { table: "clean", seed: "s" },
    { table: "clean", seed: "s" },
  ]);
  expect(inv.length).toBe(1);
  expect(inv[0].count).toBe(2);
});

test("resolveCosmetics maps owned equips, ignores unowned/wrong-kind", () => {
  const inv = [
    { id: "rookie_title", rarity: Rarity.Common, count: 1 },
    { id: "neon_theme", rarity: Rarity.Rare, count: 1 },
  ];
  const r = resolveCosmetics({ title: "rookie_title", theme: "neon_theme" }, inv);
  expect(r.title).toBe("Rookie");
  expect(r.theme_color).toBe("36");
  expect(resolveCosmetics({ title: "archmage_title" }, inv).title).toBe(null); // not owned
  expect(resolveCosmetics({ title: "neon_theme" }, inv).title).toBe(null); // wrong kind
});
