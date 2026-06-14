import { EventType } from "../../core/events";
import type { IState } from "../../core/state";
import { ActivityState } from "./activity";
import { type IScene, sceneFor, GUILD_SCENE } from "./scene";

export enum ScenePlace {
  Guild = "guild",
  Field = "field",
}

// Guild when resting (session ended) or freshly opened (session_start, nothing done yet).
export const placeFor = (
  activity: ActivityState,
  lastEvent: IState["last_event"],
): ScenePlace => {
  if (activity === ActivityState.Rest) {
    return ScenePlace.Guild;
  }
  if (activity === ActivityState.Idle && lastEvent?.type === EventType.SessionStart) {
    return ScenePlace.Guild;
  }
  return ScenePlace.Field;
};

export interface ISceneNowArgs {
  activity: ActivityState;
  lastEvent: IState["last_event"];
  tier: number;
  line?: string | null;
  branch?: string | null;
}

export const sceneNow = (args: ISceneNowArgs): IScene => {
  const { activity, lastEvent, tier, line, branch } = args;
  if (placeFor(activity, lastEvent) === ScenePlace.Guild) {
    return GUILD_SCENE;
  }
  return sceneFor(tier, line, branch);
};
