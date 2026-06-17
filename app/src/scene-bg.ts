import { SceneTheme } from "./scene";

// Themes with a real /scenes/<theme>.png background. Empty until art lands; add a theme here after
// importing its scene image. A theme not in the set falls back to the .sky CSS gradient.
export const SCENE_BGS = new Set<SceneTheme>();

export const hasSceneBg = (theme: SceneTheme): boolean => SCENE_BGS.has(theme);
