import { SceneTheme } from "./scene";
import { CreatureKind, buildSpriteTable, type IMonsterSet } from "./monsters";

// The boss-encounter creature per realm (idle 9 + attack 9). A theme with no art → emoji fallback.
export const BOSS_SPRITES = buildSpriteTable(CreatureKind.Boss);

export const bossSet = (theme: SceneTheme): IMonsterSet | undefined =>
  BOSS_SPRITES[theme];

// The named boss per realm (shown on the encounter nameplate). Mirrors the per-realm art.
export const BOSS_NAMES: Partial<Record<SceneTheme, string>> = {
  [SceneTheme.Grassland]: "Thornback Behemoth",
  [SceneTheme.Forest]: "Elder Treant",
  [SceneTheme.Dungeon]: "Stone Wyrm",
  [SceneTheme.SkyforgeAether]: "Tempest Leviathan",
  [SceneTheme.CircuitCatacombs]: "Circuit Wyrmking",
  [SceneTheme.AuroraFlux]: "Aurora Leviathan",
  [SceneTheme.GeometricSanctum]: "Prism Colossus",
  [SceneTheme.QuantumRift]: "Rift Devourer",
  [SceneTheme.NoirCrimeScene]: "Shadow Behemoth",
  [SceneTheme.OraclesAthenaeum]: "Rune Colossus",
  [SceneTheme.ConductorsNexus]: "Clockwork Colossus",
};

export const bossName = (theme: SceneTheme): string => BOSS_NAMES[theme] ?? "Realm Boss";
