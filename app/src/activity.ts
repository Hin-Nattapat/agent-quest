import { EventType } from "../../core/events";
import type { IState } from "../../core/state";

export enum ActivityState {
  Farming = "farming",
  Idle = "idle",
  Rest = "rest",
}

export const ACTIVE_WINDOW_MS = 60_000;

// `now` is wall-clock ms — kept in the app so the reducer stays time-free/idempotent.
export const activityState = (
  lastEvent: IState["last_event"],
  now: number,
  windowMs = ACTIVE_WINDOW_MS,
): ActivityState => {
  if (!lastEvent) {
    return ActivityState.Idle;
  }
  if (lastEvent.type === EventType.SessionEnd) {
    return ActivityState.Rest;
  }
  if (lastEvent.type === EventType.SessionStart) {
    return ActivityState.Idle; // opened the agent, not working yet
  }
  return now - Date.parse(lastEvent.ts) < windowMs
    ? ActivityState.Farming
    : ActivityState.Idle;
};
