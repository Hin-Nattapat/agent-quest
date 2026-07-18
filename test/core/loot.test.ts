import { test, expect } from "bun:test";
import {
  rollDrop,
  rollInventory,
  resolveCosmetics,
  LOOT_TABLE,
  LootKind,
  Rarity,
  TDropTable,
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

test("rollInventory caps own-once cosmetics at count 1", () => {
  const inv = rollInventory({
    triggers: [
      { table: "clean", seed: "s" },
      { table: "clean", seed: "s" },
    ],
  });
  expect(inv.length).toBe(1);
  expect(inv[0].count).toBe(1); // cosmetics are equip-once — duplicate drops don't stack
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
  expect(r.theme_color).toBe("38;2;0;224;208");
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

test("rollDrop never yields a skin (no equip path yet)", () => {
  for (const table of Object.keys(DROP_TABLES)) {
    for (let i = 0; i < 40; i++) {
      const id = rollDrop({ trigger: { table, seed: `${table}-${i}` } });
      if (id) {
        expect(LOOT_TABLE[id].kind).not.toBe(LootKind.Skin);
      }
    }
  }
});

test("boss rate defaults are sane fractions", () => {
  expect(DEFAULT_BOSS_RATE).toBeGreaterThan(0);
  expect(DEFAULT_BOSS_RATE).toBeLessThan(1);
  expect(DEFAULT_BOSS_FLEE_RATE).toBeGreaterThan(0);
  expect(DEFAULT_BOSS_FLEE_RATE).toBeLessThan(1);
});

test("resolveCosmetics resolves an owned name-color via its value; null otherwise", () => {
  const table = {
    azure_ink: {
      id: "azure_ink",
      name: "Azure",
      rarity: Rarity.Rare,
      kind: LootKind.NameColor,
      value: "38;2;61;155;255",
    },
    rookie_title: {
      id: "rookie_title",
      name: "Rookie",
      rarity: Rarity.Common,
      kind: LootKind.Title,
    },
  } as Record<string, import("../../core/loot").ILootItem>;

  const inv = [{ id: "azure_ink", rarity: Rarity.Rare, count: 1 }];
  expect(
    resolveCosmetics({
      profile: { name_color: "azure_ink" },
      inventory: inv,
      lootTable: table,
    }).name_color,
  ).toBe("38;2;61;155;255");
  expect(
    resolveCosmetics({
      profile: { name_color: "plasma_ink" },
      inventory: inv,
      lootTable: table,
    }).name_color,
  ).toBe(null); // not owned

  const inv2 = [{ id: "rookie_title", rarity: Rarity.Common, count: 1 }];
  expect(
    resolveCosmetics({
      profile: { name_color: "rookie_title" },
      inventory: inv2,
      lootTable: table,
    }).name_color,
  ).toBe(null); // wrong kind
});

test("name-inks exist as own-once NameColor items with truecolor values", () => {
  expect(LOOT_TABLE.plasma_ink.kind).toBe(LootKind.NameColor);
  expect(LOOT_TABLE.plasma_ink.rarity).toBe(Rarity.Legendary);
  expect(LOOT_TABLE.azure_ink.value).toBe("38;2;61;155;255");

  // a repeated name-color drop caps at count 1 (own-once), proved via a single-item table
  const oneInk = { azure_ink: LOOT_TABLE.azure_ink };
  const drops = { clean: [{ rarity: Rarity.Rare, weight: 1 }] };
  const inv = rollInventory({
    triggers: [
      { table: "clean", seed: "x" },
      { table: "clean", seed: "x" },
    ],
    lootTable: oneInk,
    dropTables: drops,
  });
  expect(inv).toEqual([{ id: "azure_ink", rarity: Rarity.Rare, count: 1 }]);
});

test("themes use refreshed truecolor values (no two the same)", () => {
  const themeVals = Object.values(LOOT_TABLE)
    .filter(i => i.kind === LootKind.Theme)
    .map(i => i.value);
  expect(LOOT_TABLE.golden_theme.value).toBe("38;2;255;205;20");
  expect(LOOT_TABLE.sunset_theme.value).toBe("38;2;255;106;30");
  expect(new Set(themeVals).size).toBe(themeVals.length); // all distinct
});

test("resolveCosmetics carries the companion id only when owned and equipped", () => {
  const inv = [{ id: "sir_quacks", rarity: Rarity.Legendary, count: 1 }];
  const on = resolveCosmetics({ profile: { companion: "sir_quacks" }, inventory: inv });
  expect(on.companion).toBe("sir_quacks");
  const unowned = resolveCosmetics({
    profile: { companion: "sir_quacks" },
    inventory: [],
  });
  expect(unowned.companion).toBeNull();
  const unequipped = resolveCosmetics({ profile: {}, inventory: inv });
  expect(unequipped.companion).toBeNull();
  const wrongKind = resolveCosmetics({
    profile: { companion: "rookie_title" },
    inventory: [{ id: "rookie_title", rarity: Rarity.Common, count: 1 }],
  });
  expect(wrongKind.companion).toBeNull();
});

test("sir_quacks is a legendary companion and never random-drops", () => {
  const item = LOOT_TABLE["sir_quacks"];
  expect(item.kind).toBe(LootKind.Companion);
  expect(item.rarity).toBe(Rarity.Legendary);
  // Force legendary rarity every roll: a table with only legendary entries.
  const always: TDropTable = [{ rarity: Rarity.Legendary, weight: 1 }];
  for (let i = 0; i < 50; i++) {
    const id = rollDrop({
      trigger: { table: "t", seed: `s${i}` },
      dropTables: { t: always },
    });
    expect(id).not.toBe("sir_quacks");
  }
});
