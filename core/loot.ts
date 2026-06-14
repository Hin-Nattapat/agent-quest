import { seededRng } from "./rng";

export enum Rarity {
  Common = "common",
  Rare = "rare",
  Epic = "epic",
  Legendary = "legendary",
}

export enum LootKind {
  Title = "title",
  Theme = "theme",
  Skin = "skin",
}

export interface ILootItem {
  id: string;
  name: string;
  rarity: Rarity;
  kind: LootKind;
  value?: string; // theme -> ANSI SGR code (skin equip/sprite path not yet built)
}

export interface IInventoryItem {
  id: string;
  rarity: Rarity;
  count: number;
  name?: string;
  kind?: LootKind;
  equipped?: boolean;
}

export interface ICosmetics {
  title: string | null;
  theme_color: string | null;
}

export const LOOT_TABLE: Record<string, ILootItem> = {
  rookie_title: {
    id: "rookie_title",
    name: "Rookie",
    rarity: Rarity.Common,
    kind: LootKind.Title,
  },
  tinkerer_title: {
    id: "tinkerer_title",
    name: "Tinkerer",
    rarity: Rarity.Common,
    kind: LootKind.Title,
  },
  forest_theme: {
    id: "forest_theme",
    name: "Forest",
    rarity: Rarity.Common,
    kind: LootKind.Theme,
    value: "32",
  },
  hoodie_skin: {
    id: "hoodie_skin",
    name: "Hoodie Dev",
    rarity: Rarity.Common,
    kind: LootKind.Skin,
  },
  codeweaver_title: {
    id: "codeweaver_title",
    name: "Codeweaver",
    rarity: Rarity.Rare,
    kind: LootKind.Title,
  },
  night_coder_title: {
    id: "night_coder_title",
    name: "Night Coder",
    rarity: Rarity.Rare,
    kind: LootKind.Title,
  },
  neon_theme: {
    id: "neon_theme",
    name: "Neon",
    rarity: Rarity.Rare,
    kind: LootKind.Theme,
    value: "36",
  },
  ocean_theme: {
    id: "ocean_theme",
    name: "Ocean",
    rarity: Rarity.Rare,
    kind: LootKind.Theme,
    value: "34",
  },
  cyber_ninja_skin: {
    id: "cyber_ninja_skin",
    name: "Cyber Ninja",
    rarity: Rarity.Rare,
    kind: LootKind.Skin,
  },
  archmage_title: {
    id: "archmage_title",
    name: "Archmage",
    rarity: Rarity.Epic,
    kind: LootKind.Title,
  },
  bug_whisperer_title: {
    id: "bug_whisperer_title",
    name: "Bug Whisperer",
    rarity: Rarity.Epic,
    kind: LootKind.Title,
  },
  sunset_theme: {
    id: "sunset_theme",
    name: "Sunset",
    rarity: Rarity.Epic,
    kind: LootKind.Theme,
    value: "33",
  },
  matrix_theme: {
    id: "matrix_theme",
    name: "Matrix",
    rarity: Rarity.Epic,
    kind: LootKind.Theme,
    value: "92",
  },
  wizard_robe_skin: {
    id: "wizard_robe_skin",
    name: "Wizard Robe",
    rarity: Rarity.Epic,
    kind: LootKind.Skin,
  },
  legendary_title: {
    id: "legendary_title",
    name: "The Legendary",
    rarity: Rarity.Legendary,
    kind: LootKind.Title,
  },
  tenx_title: {
    id: "tenx_title",
    name: "10x",
    rarity: Rarity.Legendary,
    kind: LootKind.Title,
  },
  golden_theme: {
    id: "golden_theme",
    name: "Golden",
    rarity: Rarity.Legendary,
    kind: LootKind.Theme,
    value: "33",
  },
  golden_armor_skin: {
    id: "golden_armor_skin",
    name: "Golden Armor",
    rarity: Rarity.Legendary,
    kind: LootKind.Skin,
  },
};

export type TDropTable = Array<{ rarity: Rarity; weight: number }>;

export const DROP_TABLES: Record<string, TDropTable> = {
  clean: [
    { rarity: Rarity.Common, weight: 0.7 },
    { rarity: Rarity.Rare, weight: 0.25 },
    { rarity: Rarity.Epic, weight: 0.05 },
  ],
  levelup: [
    { rarity: Rarity.Common, weight: 0.6 },
    { rarity: Rarity.Rare, weight: 0.3 },
    { rarity: Rarity.Epic, weight: 0.08 },
    { rarity: Rarity.Legendary, weight: 0.02 },
  ],
  streak7: [
    { rarity: Rarity.Rare, weight: 0.7 },
    { rarity: Rarity.Epic, weight: 0.25 },
    { rarity: Rarity.Legendary, weight: 0.05 },
  ],
  streak30: [
    { rarity: Rarity.Epic, weight: 0.8 },
    { rarity: Rarity.Legendary, weight: 0.2 },
  ],
  streak100: [{ rarity: Rarity.Legendary, weight: 1.0 }],
  boss: [
    { rarity: Rarity.Common, weight: 0.4 },
    { rarity: Rarity.Rare, weight: 0.35 },
    { rarity: Rarity.Epic, weight: 0.2 },
    { rarity: Rarity.Legendary, weight: 0.05 },
  ],
};

export const DEFAULT_BOSS_RATE = 0.02;
export const DEFAULT_BOSS_FLEE_RATE = 0.2;

export interface ITrigger {
  table: string;
  seed: string;
}

const rollRarity = (rng: () => number, table: TDropTable): Rarity => {
  const total = table.reduce((sum, e) => sum + e.weight, 0);
  let r = rng() * total;
  for (const entry of table) {
    r -= entry.weight;
    if (r < 0) {
      return entry.rarity;
    }
  }
  return table[table.length - 1].rarity;
};

const pickItem = (rng: () => number, items: ILootItem[]): ILootItem | null => {
  if (items.length === 0) {
    return null;
  }
  return items[Math.floor(rng() * items.length)];
};

interface IRollDropArgs {
  trigger: ITrigger;
  lootTable?: Record<string, ILootItem>;
  dropTables?: Record<string, TDropTable>;
}

export const rollDrop = (props: IRollDropArgs): string | null => {
  const { trigger, lootTable = LOOT_TABLE, dropTables = DROP_TABLES } = props;
  const dropTable = dropTables[trigger.table];
  if (!dropTable) {
    return null;
  }
  const rng = seededRng(trigger.seed);
  const rarity = rollRarity(rng, dropTable);
  const pool = Object.values(lootTable).filter(item => item.rarity === rarity);
  const item = pickItem(rng, pool);
  return item ? item.id : null;
};

interface IRollInventoryArgs {
  triggers: ITrigger[];
  lootTable?: Record<string, ILootItem>;
  dropTables?: Record<string, TDropTable>;
}

export const rollInventory = (props: IRollInventoryArgs): IInventoryItem[] => {
  const { triggers, lootTable = LOOT_TABLE, dropTables = DROP_TABLES } = props;
  const counts: Record<string, number> = {};
  for (const trigger of triggers) {
    const id = rollDrop({ trigger, lootTable, dropTables });
    if (id) {
      counts[id] = (counts[id] ?? 0) + 1;
    }
  }
  return Object.entries(counts)
    .map(([id, count]) => ({ id, rarity: lootTable[id].rarity, count }))
    .sort((a, b) => a.id.localeCompare(b.id));
};

interface IResolveCosmeticsArgs {
  profile: { title?: string; theme?: string };
  inventory: IInventoryItem[];
  earnedTitles?: Record<string, string>;
  lootTable?: Record<string, ILootItem>;
}

export const resolveCosmetics = (props: IResolveCosmeticsArgs): ICosmetics => {
  const { profile, inventory, earnedTitles = {}, lootTable = LOOT_TABLE } = props;
  const owned = new Set(inventory.map(i => i.id));
  const lootTitle =
    profile.title &&
    owned.has(profile.title) &&
    lootTable[profile.title]?.kind === LootKind.Title
      ? lootTable[profile.title].name
      : null;
  const earnedTitle =
    profile.title && earnedTitles[profile.title] ? earnedTitles[profile.title] : null;
  const themeItem =
    profile.theme && owned.has(profile.theme) ? lootTable[profile.theme] : null;
  return {
    title: lootTitle ?? earnedTitle,
    theme_color: themeItem?.kind === LootKind.Theme ? (themeItem.value ?? null) : null,
  };
};
