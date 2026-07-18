import { SceneTheme } from "./scene";
import { MonsterAnim } from "./combat";

export interface IMonsterSet {
  idle: string[]; // west-facing idle loop
  attack: string[]; // west-facing attack pose (one-shot per attack beat)
}

// Mobs and bosses share the same art shape (idle + attack, west-facing); they differ only in the
// sprites/<kind>/ folder they live under.
export enum CreatureKind {
  Monster = "monsters",
  Boss = "boss",
}

const framesFor = (
  kind: CreatureKind,
  theme: string,
  anim: string,
  count: number,
): string[] =>
  Array.from({ length: count }, (_, i) => `/sprites/${kind}/${theme}/${anim}/${i}.png`);

export const buildCreatureSet = (
  kind: CreatureKind,
  theme: string,
  idleFrames: number,
  attackFrames: number,
): IMonsterSet => ({
  idle: framesFor(kind, theme, "idle", idleFrames),
  attack: framesFor(kind, theme, "attack", attackFrames),
});

// Realms with imported art (each idle 9 + attack 9). Add a theme here after importing its frames
// (the importer prints the counts). Both the mob and boss tables are built from this one list.
const ART_THEMES: SceneTheme[] = [
  SceneTheme.Grassland,
  SceneTheme.Forest,
  SceneTheme.Dungeon,
  SceneTheme.SkyforgeAether,
  SceneTheme.CircuitCatacombs,
  SceneTheme.AuroraFlux,
  SceneTheme.GeometricSanctum,
  SceneTheme.QuantumRift,
  SceneTheme.NoirCrimeScene,
  SceneTheme.OraclesAthenaeum,
  SceneTheme.ConductorsNexus,
  SceneTheme.GrandConcertVault,
  SceneTheme.MidnightRoost,
  SceneTheme.SilentSummit,
  SceneTheme.GlitchPit,
  SceneTheme.FoolsMirage,
];
const ART_FRAMES = 9;

// A per-theme sprite table for one creature kind. A theme with no art → undefined → emoji fallback.
export const buildSpriteTable = (
  kind: CreatureKind,
): Partial<Record<SceneTheme, IMonsterSet>> => {
  const table: Partial<Record<SceneTheme, IMonsterSet>> = {};
  for (const theme of ART_THEMES) {
    table[theme] = buildCreatureSet(kind, theme, ART_FRAMES, ART_FRAMES);
  }
  return table;
};

export const MONSTER_SPRITES = buildSpriteTable(CreatureKind.Monster);

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
