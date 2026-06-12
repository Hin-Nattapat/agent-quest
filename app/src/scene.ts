export enum SceneTheme {
  Grassland = "grassland",
  Forest = "forest",
  Dungeon = "dungeon",
  SecretRealm = "secret_realm",
}

export interface IScene {
  theme: SceneTheme;
  label: string;
  monster: string; // semantic name; the placeholder/sprite visual lives in styles.css
}

export function sceneFor(tier: number): IScene {
  if (tier >= 4) {
    return {
      theme: SceneTheme.SecretRealm,
      label: "Secret Realm",
      monster: "Realm King",
    };
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
