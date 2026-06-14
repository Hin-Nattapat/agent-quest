export enum SceneTheme {
  Grassland = "grassland",
  Forest = "forest",
  Dungeon = "dungeon",
  // T4 main-line realms (key: `${line}_${branch}`)
  SkyforgeAether = "skyforge_aether",
  CircuitCatacombs = "circuit_catacombs",
  AuroraFlux = "aurora_flux",
  GeometricSanctum = "geometric_sanctum",
  QuantumRift = "quantum_rift",
  NoirCrimeScene = "noir_crime_scene",
  OraclesAthenaeum = "oracles_athenaeum",
  ConductorsNexus = "conductors_nexus",
  // T4 secret-class realms (key: line)
  GrandConcertVault = "grand_concert_vault",
  MidnightRoost = "midnight_roost",
  SilentSummit = "silent_summit",
  GlitchPit = "glitch_pit",
  FoolsMirage = "fools_mirage",
  // T4 main-line pre-branch fallback
  Ascendant = "ascendant",
}

export interface IScene {
  theme: SceneTheme;
  label: string;
  monster: string; // semantic name; the placeholder/sprite visual lives in styles.css
}

// Keyed by `${line}_${branch}` for main lines and by the bare line for secret classes.
// Secret-line keys (e.g. "night_owl") and main keys (e.g. "mage_a") never collide.
const REALMS: Record<string, IScene> = {
  mage_a: { theme: SceneTheme.SkyforgeAether, label: "Skyforge Aether", monster: "Storm Archon" },
  mage_b: { theme: SceneTheme.CircuitCatacombs, label: "Circuit Catacombs", monster: "The Kernel Lich" },
  ranger_a: { theme: SceneTheme.AuroraFlux, label: "Aurora Flux", monster: "Prism Wisp" },
  ranger_b: { theme: SceneTheme.GeometricSanctum, label: "Geometric Sanctum", monster: "The Grid Warden" },
  rogue_a: { theme: SceneTheme.QuantumRift, label: "Quantum Rift", monster: "The Heisenbug" },
  rogue_b: { theme: SceneTheme.NoirCrimeScene, label: "Noir Crime Scene", monster: "The Phantom Culprit" },
  sage_a: { theme: SceneTheme.OraclesAthenaeum, label: "Oracle's Athenaeum", monster: "The Domain Sphinx" },
  sage_b: { theme: SceneTheme.ConductorsNexus, label: "Conductor's Nexus", monster: "The Orchestration Construct" },
  maestro: { theme: SceneTheme.GrandConcertVault, label: "Grand Concert Vault", monster: "The Living Symphony" },
  night_owl: { theme: SceneTheme.MidnightRoost, label: "Midnight Roost", monster: "The Eclipse Owl" },
  ascetic: { theme: SceneTheme.SilentSummit, label: "Silent Summit", monster: "The Stone Guardian" },
  gremlin: { theme: SceneTheme.GlitchPit, label: "The Glitch Pit", monster: "The Chaos Gremlin King" },
  trickster: { theme: SceneTheme.FoolsMirage, label: "Fool's Mirage", monster: "The Jester Mirage" },
};

const ASCENDANT: IScene = {
  theme: SceneTheme.Ascendant,
  label: "Ascendant Realm",
  monster: "Realm Guardian",
};

export function realmFor(line: string | null, branch: string | null): IScene {
  if (!line) {
    return ASCENDANT;
  }
  const key = branch ? `${line}_${branch}` : line;
  return REALMS[key] ?? ASCENDANT;
}

export function sceneFor(tier: number, line?: string | null, branch?: string | null): IScene {
  if (tier >= 4) {
    return realmFor(line ?? null, branch ?? null);
  }
  if (tier === 3) {
    return {
      theme: SceneTheme.Dungeon,
      label: "The Deep Dungeon",
      monster: "Dungeon Brute",
    };
  }
  if (tier === 2) {
    return {
      theme: SceneTheme.Forest,
      label: "Whispering Forest",
      monster: "Error Wraith",
    };
  }
  return {
    theme: SceneTheme.Grassland,
    label: "Grassland outside town",
    monster: "Bug Slime",
  };
}
