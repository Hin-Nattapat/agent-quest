import { SceneMode } from "./scene-mode";
import type { ITransitionInput } from "./use-transition";

// Feeds useTransition a {theme,label}: a key that changes on mode (and battle's tier theme) so the
// banner fires, plus the label to show. Overworld is one room → one stable key, no inner banners.
export const bannerScene = (mode: SceneMode, sceneTheme: string): ITransitionInput => {
  if (mode === SceneMode.Battle) {
    return { theme: `battle:${sceneTheme}`, label: "Entering Battle" };
  }
  return { theme: "overworld", label: "Returning to Guild" };
};
