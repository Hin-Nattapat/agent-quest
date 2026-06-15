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
  NameColor = "name_color",
}

export interface ILootItem {
  id: string;
  name: string;
  rarity: Rarity;
  kind: LootKind;
  value?: string; // theme/name-color -> ANSI SGR code (skin equip/sprite path not yet built)
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
  name_color: string | null;
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
    value: "38;2;46;204;78",
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
    value: "38;2;0;224;208",
  },
  ocean_theme: {
    id: "ocean_theme",
    name: "Ocean",
    rarity: Rarity.Rare,
    kind: LootKind.Theme,
    value: "38;2;40;130;255",
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
    value: "38;2;255;106;30",
  },
  matrix_theme: {
    id: "matrix_theme",
    name: "Matrix",
    rarity: Rarity.Epic,
    kind: LootKind.Theme,
    value: "38;2;180;255;26",
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
    value: "38;2;255;205;20",
  },
  golden_armor_skin: {
    id: "golden_armor_skin",
    name: "Golden Armor",
    rarity: Rarity.Legendary,
    kind: LootKind.Skin,
  },
  mist_ink: {
    id: "mist_ink",
    name: "Mist",
    rarity: Rarity.Common,
    kind: LootKind.NameColor,
    value: "38;2;159;180;201",
  },
  azure_ink: {
    id: "azure_ink",
    name: "Azure",
    rarity: Rarity.Rare,
    kind: LootKind.NameColor,
    value: "38;2;61;155;255",
  },
  jade_ink: {
    id: "jade_ink",
    name: "Jade",
    rarity: Rarity.Rare,
    kind: LootKind.NameColor,
    value: "38;2;47;194;138",
  },
  royal_ink: {
    id: "royal_ink",
    name: "Royal",
    rarity: Rarity.Epic,
    kind: LootKind.NameColor,
    value: "38;2;138;92;255",
  },
  ruby_ink: {
    id: "ruby_ink",
    name: "Ruby",
    rarity: Rarity.Epic,
    kind: LootKind.NameColor,
    value: "38;2;236;59;90",
  },
  plasma_ink: {
    id: "plasma_ink",
    name: "Plasma",
    rarity: Rarity.Legendary,
    kind: LootKind.NameColor,
    value: "1;38;2;255;54;255",
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
  // Skins have no equip path yet (see ILootItem), so they never drop — keep the pool to
  // title/theme until skin equipping exists, or they'd be dead, unusable loot.
  const pool = Object.values(lootTable).filter(
    item => item.rarity === rarity && item.kind !== LootKind.Skin,
  );
  const item = pickItem(rng, pool);
  return item ? item.id : null;
};

interface IRollInventoryArgs {
  triggers: ITrigger[];
  lootTable?: Record<string, ILootItem>;
  dropTables?: Record<string, TDropTable>;
}

// Cosmetics are equip-once, so a duplicate drop adds nothing — the inventory is a collection, not
// a stack. Count is capped at 1 for these kinds (all loot today); a future stackable kind keeps its
// real count.
const OWN_ONCE_KINDS: ReadonlySet<LootKind> = new Set([
  LootKind.Title,
  LootKind.Theme,
  LootKind.Skin,
  LootKind.NameColor,
]);

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
    .map(([id, count]) => {
      const item = lootTable[id];
      const ownOnce = OWN_ONCE_KINDS.has(item.kind);
      return { id, rarity: item.rarity, count: ownOnce ? 1 : count };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
};

interface IResolveCosmeticsArgs {
  profile: { title?: string; theme?: string; name_color?: string };
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
  const nameItem =
    profile.name_color && owned.has(profile.name_color)
      ? lootTable[profile.name_color]
      : null;
  return {
    title: lootTitle ?? earnedTitle,
    theme_color: themeItem?.kind === LootKind.Theme ? (themeItem.value ?? null) : null,
    name_color: nameItem?.kind === LootKind.NameColor ? (nameItem.value ?? null) : null,
  };
};
