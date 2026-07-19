import { type TLine } from "./classes";

// Bestiary & Realm Conquest (spec 2026-07-19): per-realm discovery/encounter/boss tallies folded
// from the journal, with conquest decided the moment both thresholds are crossed so the order of
// `conquered` is the order trophies appear in the guild.

export interface IRealmProgress {
  discovered: boolean;
  encounters: number;
  boss_defeated: number;
  boss_fled: number;
  conquered: boolean;
}

export interface IBestiaryState {
  realms: Record<string, IRealmProgress>;
  conquered: string[];
  total: number;
}

export interface IConquestThreshold {
  encounters: number;
  bosses: number;
}

// Starter realms are shared across lines; T4 main realms key off line+branch; secret realms are
// branchless. These wire strings are the SceneTheme values the app already renders.
const STARTER_REALMS: Record<number, string> = {
  1: "grassland",
  2: "forest",
  3: "dungeon",
};

const T4_MAIN_REALMS: Record<string, string> = {
  mage_a: "skyforge_aether",
  mage_b: "circuit_catacombs",
  ranger_a: "aurora_flux",
  ranger_b: "geometric_sanctum",
  rogue_a: "quantum_rift",
  rogue_b: "noir_crime_scene",
  sage_a: "oracles_athenaeum",
  sage_b: "conductors_nexus",
};

const SECRET_REALMS: Record<string, string> = {
  maestro: "grand_concert_vault",
  night_owl: "midnight_roost",
  ascetic: "silent_summit",
  gremlin: "glitch_pit",
  trickster: "fools_mirage",
};

export const REALM_LABELS: Record<string, string> = {
  grassland: "Grassland",
  forest: "Whispering Forest",
  dungeon: "Deep Dungeon",
  skyforge_aether: "Skyforge Aether",
  circuit_catacombs: "Circuit Catacombs",
  aurora_flux: "Aurora Flux",
  geometric_sanctum: "Geometric Sanctum",
  quantum_rift: "Quantum Rift",
  noir_crime_scene: "Noir Crime Scene",
  oracles_athenaeum: "Oracle's Athenaeum",
  conductors_nexus: "Conductor's Nexus",
  grand_concert_vault: "Grand Concert Vault",
  midnight_roost: "Midnight Roost",
  silent_summit: "Silent Summit",
  glitch_pit: "The Glitch Pit",
  fools_mirage: "Fool's Mirage",
};

export const REALM_TOTAL = 16;

const T4_THRESHOLD: IConquestThreshold = { encounters: 300, bosses: 5 };

export const CONQUEST_THRESHOLDS: Record<string, IConquestThreshold> = {
  grassland: { encounters: 50, bosses: 1 },
  forest: { encounters: 100, bosses: 2 },
  dungeon: { encounters: 200, bosses: 3 },
  skyforge_aether: T4_THRESHOLD,
  circuit_catacombs: T4_THRESHOLD,
  aurora_flux: T4_THRESHOLD,
  geometric_sanctum: T4_THRESHOLD,
  quantum_rift: T4_THRESHOLD,
  noir_crime_scene: T4_THRESHOLD,
  oracles_athenaeum: T4_THRESHOLD,
  conductors_nexus: T4_THRESHOLD,
  grand_concert_vault: T4_THRESHOLD,
  midnight_roost: T4_THRESHOLD,
  silent_summit: T4_THRESHOLD,
  glitch_pit: T4_THRESHOLD,
  fools_mirage: T4_THRESHOLD,
};

interface IRealmForArgs {
  line: TLine | null;
  tier: number;
  branch: "a" | "b" | null;
}

export const realmFor = (props: IRealmForArgs): string | null => {
  const { line, tier, branch } = props;
  if (line == null || tier < 1) {
    return null;
  }
  if (tier <= 3) {
    return STARTER_REALMS[tier];
  }
  const secret = SECRET_REALMS[line];
  if (secret) {
    return secret;
  }
  if (branch == null) {
    return null; // T4 main line before the branch is chosen has no realm yet
  }
  return T4_MAIN_REALMS[`${line}_${branch}`] ?? null;
};

export interface IBestiaryScan {
  realms: Record<string, IRealmProgress>;
  conqueredOrder: string[];
}

export const createBestiaryScan = (): IBestiaryScan => {
  return { realms: {}, conqueredOrder: [] };
};

const emptyProgress = (): IRealmProgress => {
  return {
    discovered: true,
    encounters: 0,
    boss_defeated: 0,
    boss_fled: 0,
    conquered: false,
  };
};

interface IRecordBestiaryArgs {
  scan: IBestiaryScan;
  realm: string | null;
  isAction: boolean;
  bossDefeated: number;
  bossFled: number;
}

export const recordBestiaryEvent = (props: IRecordBestiaryArgs): void => {
  const { scan, realm, isAction, bossDefeated, bossFled } = props;
  if (realm == null) {
    return;
  }
  if (!scan.realms[realm]) {
    scan.realms[realm] = emptyProgress();
  }
  const progress = scan.realms[realm];
  if (isAction) {
    progress.encounters++;
  }
  progress.boss_defeated += bossDefeated;
  progress.boss_fled += bossFled;
  const threshold = CONQUEST_THRESHOLDS[realm];
  if (
    threshold &&
    !progress.conquered &&
    progress.encounters >= threshold.encounters &&
    progress.boss_defeated >= threshold.bosses
  ) {
    progress.conquered = true;
    scan.conqueredOrder.push(realm);
  }
};

export const buildBestiary = (scan: IBestiaryScan): IBestiaryState => {
  return { realms: scan.realms, conquered: scan.conqueredOrder, total: REALM_TOTAL };
};
