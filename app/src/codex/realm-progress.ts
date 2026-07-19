import type { IBestiaryState, IRealmProgress } from "../../../core/bestiary";

export enum CodexTab {
  Deeds = "deeds",
  Realms = "realms",
}

export interface IRealmUi {
  theme: string;
  label: string;
  icon: string;
}

// App-side copy of the realm list: the app may not import core runtime code, and these wire keys
// are already the shared contract via state.json / scene themes.
export const REALM_UI: IRealmUi[] = [
  { theme: "grassland", label: "Grassland", icon: "🌿" },
  { theme: "forest", label: "Whispering Forest", icon: "🌲" },
  { theme: "dungeon", label: "Deep Dungeon", icon: "🏰" },
  { theme: "skyforge_aether", label: "Skyforge Aether", icon: "🌩️" },
  { theme: "circuit_catacombs", label: "Circuit Catacombs", icon: "💀" },
  { theme: "aurora_flux", label: "Aurora Flux", icon: "✨" },
  { theme: "geometric_sanctum", label: "Geometric Sanctum", icon: "🛡️" },
  { theme: "quantum_rift", label: "Quantum Rift", icon: "🌀" },
  { theme: "noir_crime_scene", label: "Noir Crime Scene", icon: "🕵️" },
  { theme: "oracles_athenaeum", label: "Oracle's Athenaeum", icon: "🦁" },
  { theme: "conductors_nexus", label: "Conductor's Nexus", icon: "🤖" },
  { theme: "grand_concert_vault", label: "Grand Concert Vault", icon: "🎼" },
  { theme: "midnight_roost", label: "Midnight Roost", icon: "🦉" },
  { theme: "silent_summit", label: "Silent Summit", icon: "🧘" },
  { theme: "glitch_pit", label: "The Glitch Pit", icon: "👺" },
  { theme: "fools_mirage", label: "Fool's Mirage", icon: "✦" },
];

export interface IRealmRow extends IRealmUi, IRealmProgress {}

export interface IRealmRows {
  discovered: IRealmRow[];
  undiscovered: number;
}

export const realmRows = (bestiary: IBestiaryState | undefined): IRealmRows => {
  const realms = bestiary?.realms ?? {};
  const discovered = REALM_UI.filter(u => realms[u.theme]).map(u => ({
    ...u,
    ...realms[u.theme],
  }));
  return { discovered, undiscovered: (bestiary?.total ?? 16) - discovered.length };
};
