import { SceneTheme } from "./scene";

// Top-down overworld themes with a real /overworld/<theme>.png map (PixelLab create-map). Add a
// theme here after importing its map image; a theme not in the set falls back to the CSS-placeholder
// room (.guild-room props). Mirrors SCENE_BGS in scene-bg.ts, for the Overworld renderer.
export const OVERWORLD_BGS = new Set<SceneTheme>([SceneTheme.Guild]);

export const hasOverworldBg = (theme: SceneTheme): boolean => OVERWORLD_BGS.has(theme);

// Guild NPC ids with an imported south-facing idle loop at /overworld/npc/<id>/<N>.png (the importer
// prints the frame count). An id not here → emoji fallback.
const NPC_ART = new Set<string>(["elder", "smith", "ranger"]);
const NPC_IDLE_FRAMES = 9;

// Raw frame paths for an NPC idle loop ([] → no art). Cycle with useSpriteFrame at the call site.
export const npcFrames = (id: string): string[] =>
  NPC_ART.has(id)
    ? Array.from({ length: NPC_IDLE_FRAMES }, (_, i) => `/overworld/npc/${id}/${i}.png`)
    : [];
