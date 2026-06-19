import { SceneTheme } from "./scene";
import type { IMonsterSet } from "./monsters";

// Boss art shares the mob shape (idle + attack, west-facing) but lives under sprites/boss/<theme>.
export const buildBossSet = (
  theme: string,
  idleFrames: number,
  attackFrames: number,
): IMonsterSet => ({
  idle: Array.from(
    { length: idleFrames },
    (_, i) => `/sprites/boss/${theme}/idle/${i}.png`,
  ),
  attack: Array.from(
    { length: attackFrames },
    (_, i) => `/sprites/boss/${theme}/attack/${i}.png`,
  ),
});

// The boss-encounter creature per realm (idle 9 + attack 9). A theme with no art → emoji fallback.
export const BOSS_SPRITES: Partial<Record<SceneTheme, IMonsterSet>> = {
  [SceneTheme.Grassland]: buildBossSet("grassland", 9, 9),
  [SceneTheme.Forest]: buildBossSet("forest", 9, 9),
  [SceneTheme.Dungeon]: buildBossSet("dungeon", 9, 9),
  [SceneTheme.SkyforgeAether]: buildBossSet("skyforge_aether", 9, 9),
  [SceneTheme.CircuitCatacombs]: buildBossSet("circuit_catacombs", 9, 9),
  [SceneTheme.AuroraFlux]: buildBossSet("aurora_flux", 9, 9),
  [SceneTheme.GeometricSanctum]: buildBossSet("geometric_sanctum", 9, 9),
  [SceneTheme.QuantumRift]: buildBossSet("quantum_rift", 9, 9),
  [SceneTheme.NoirCrimeScene]: buildBossSet("noir_crime_scene", 9, 9),
  [SceneTheme.OraclesAthenaeum]: buildBossSet("oracles_athenaeum", 9, 9),
  [SceneTheme.ConductorsNexus]: buildBossSet("conductors_nexus", 9, 9),
};

export const bossSet = (theme: SceneTheme): IMonsterSet | undefined =>
  BOSS_SPRITES[theme];
