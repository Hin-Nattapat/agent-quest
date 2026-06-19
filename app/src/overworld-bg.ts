import { SceneTheme } from "./scene";

// Top-down overworld themes with a real /overworld/<theme>.png map (PixelLab create-map). Add a
// theme here after importing its map image; a theme not in the set falls back to the CSS-placeholder
// room (.guild-room props). Mirrors SCENE_BGS in scene-bg.ts, for the Overworld renderer.
export const OVERWORLD_BGS = new Set<SceneTheme>([SceneTheme.Guild]);

export const hasOverworldBg = (theme: SceneTheme): boolean => OVERWORLD_BGS.has(theme);
