import { SceneTheme } from "./scene";
import { MonsterAnim } from "./combat";

export interface IMonsterSet {
  idle: string[]; // west-facing idle loop
  attack: string[]; // west-facing attack pose (one-shot per attack beat)
}

export const buildMonsterSet = (
  theme: string,
  idleFrames: number,
  attackFrames: number,
): IMonsterSet => ({
  idle: Array.from(
    { length: idleFrames },
    (_, i) => `/sprites/monsters/${theme}/idle/${i}.png`,
  ),
  attack: Array.from(
    { length: attackFrames },
    (_, i) => `/sprites/monsters/${theme}/attack/${i}.png`,
  ),
});

// Mob art (idle 9 + attack 9, west-facing) per realm. Add a theme here after importing its art
// (the importer prints the frame counts). A missing theme returns undefined → emoji placeholder.
export const MONSTER_SPRITES: Partial<Record<SceneTheme, IMonsterSet>> = {
  // Starter realms (T1-T3)
  [SceneTheme.Grassland]: buildMonsterSet("grassland", 9, 9),
  [SceneTheme.Forest]: buildMonsterSet("forest", 9, 9),
  [SceneTheme.Dungeon]: buildMonsterSet("dungeon", 9, 9),
  // T4 realm bosses
  [SceneTheme.SkyforgeAether]: buildMonsterSet("skyforge_aether", 9, 9),
  [SceneTheme.CircuitCatacombs]: buildMonsterSet("circuit_catacombs", 9, 9),
  [SceneTheme.AuroraFlux]: buildMonsterSet("aurora_flux", 9, 9),
  [SceneTheme.GeometricSanctum]: buildMonsterSet("geometric_sanctum", 9, 9),
  [SceneTheme.QuantumRift]: buildMonsterSet("quantum_rift", 9, 9),
  [SceneTheme.NoirCrimeScene]: buildMonsterSet("noir_crime_scene", 9, 9),
  [SceneTheme.OraclesAthenaeum]: buildMonsterSet("oracles_athenaeum", 9, 9),
  [SceneTheme.ConductorsNexus]: buildMonsterSet("conductors_nexus", 9, 9),
};

export const monsterSet = (theme: SceneTheme): IMonsterSet | undefined =>
  MONSTER_SPRITES[theme];

// Attack frames on the attack beat (if any), otherwise the idle loop. Hurt/die keep the idle frames
// while their CSS keyframes (flash / fade) play over the top.
export const monsterFrames = (
  set: IMonsterSet | undefined,
  anim: MonsterAnim,
): string[] => {
  if (!set) {
    return [];
  }
  if (anim === MonsterAnim.Attack && set.attack.length > 0) {
    return set.attack;
  }
  return set.idle;
};
