import { ActivityState } from "./activity";

export enum SceneMode {
  Battle = "battle",
  Overworld = "overworld",
}

// Only active coding (Farming) drops into the side-view battle; idle/rest stay in the guild.
export const sceneModeFor = (activity: ActivityState): SceneMode => {
  if (activity === ActivityState.Farming) {
    return SceneMode.Battle;
  }
  return SceneMode.Overworld;
};
