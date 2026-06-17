import { SceneTheme } from "./scene";

// Themes with a real /scenes/<theme>.png background. Add a theme here after importing its scene
// image; a theme not in the set falls back to the .sky CSS gradient.
export const SCENE_BGS = new Set<SceneTheme>([SceneTheme.Grassland, SceneTheme.Forest]);

export const hasSceneBg = (theme: SceneTheme): boolean => SCENE_BGS.has(theme);
