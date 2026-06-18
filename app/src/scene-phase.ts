import { ActivityState } from "./activity";
import { packSize, makePack, firstAlive, strike, packCleared } from "./combat";

export enum ScenePhase {
  Wander = "wander",
  Engage = "engage",
}

export const REST_GAP_MS = 4500; // calm wander between waves
export const STRIKE_THROTTLE_MS = 2600; // gap between hero strikes — a hero-then-mob exchange, then
// a clear idle beat before the next, so the fight reads as semi-turn-based rather than a continuous spar

export interface IDirectorState {
  phase: ScenePhase;
  pack: number[]; // remaining hits per mob; [] in Wander (a just-cleared pack lingers at 0 hits so
  // its die animation can play, then the next engage replaces it)
  waveIndex: number;
  restUntil: number | null; // wall-clock ms the rest gap ends (null = not resting)
  lastStrikeAt: number;
}

interface IDirectorInput {
  now: number;
  activity: ActivityState;
  wantStrike: boolean;
}

export const initDirector: IDirectorState = {
  phase: ScenePhase.Wander,
  pack: [],
  waveIndex: 0,
  restUntil: null,
  lastStrikeAt: 0,
};

export const shouldEngage = (
  activity: ActivityState,
  now: number,
  restUntil: number | null,
): boolean => {
  return activity === ActivityState.Farming && (restUntil === null || now >= restUntil);
};

export const stepDirector = (
  state: IDirectorState,
  input: IDirectorInput,
): IDirectorState => {
  const { now, activity, wantStrike } = input;

  if (state.phase === ScenePhase.Wander) {
    if (shouldEngage(activity, now, state.restUntil)) {
      return {
        phase: ScenePhase.Engage,
        pack: makePack(packSize(state.waveIndex)),
        waveIndex: state.waveIndex + 1,
        restUntil: null,
        lastStrikeAt: now,
      };
    }
    return state;
  }

  // Engage
  if (activity !== ActivityState.Farming) {
    return { ...state, phase: ScenePhase.Wander, pack: [], restUntil: null };
  }

  let pack = state.pack;
  let lastStrikeAt = state.lastStrikeAt;
  if (wantStrike && now - lastStrikeAt >= STRIKE_THROTTLE_MS) {
    const idx = firstAlive(pack);
    if (idx >= 0) {
      pack = strike(pack, idx);
      lastStrikeAt = now;
    }
  }

  if (packCleared(pack)) {
    // Keep the cleared pack (mobs at 0 hits) instead of emptying it, so the killing blow's die
    // animation can play out in the view — the gone-gate drops each corpse after its die anim, and
    // the next engage replaces the pack wholesale. Emptying here unmounts the last mob instantly.
    return {
      ...state,
      phase: ScenePhase.Wander,
      pack,
      restUntil: now + REST_GAP_MS,
      lastStrikeAt,
    };
  }
  return { ...state, pack, lastStrikeAt };
};
