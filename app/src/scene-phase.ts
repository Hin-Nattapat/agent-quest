import { ActivityState } from "./activity";
import { packSize, makePack, firstAlive, strike, packCleared } from "./combat";

export enum ScenePhase {
  Wander = "wander",
  Engage = "engage",
}

export const REST_GAP_MS = 4000; // calm wander between waves
export const STRIKE_THROTTLE_MS = 700; // min gap between hero strikes (paces the fight)
export const SPAWN_STAGGER_MS = 120; // pop-in stagger across a pack (used by the view)

export interface IDirectorState {
  phase: ScenePhase;
  pack: number[]; // remaining hits per mob; [] in Wander
  waveIndex: number;
  restUntil: number | null; // wall-clock ms the rest gap ends (null = not resting)
  lastStrikeAt: number;
}

export interface IDirectorInput {
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

export const stepDirector = (state: IDirectorState, input: IDirectorInput): IDirectorState => {
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
    return {
      ...state,
      phase: ScenePhase.Wander,
      pack: [],
      restUntil: now + REST_GAP_MS,
      lastStrikeAt,
    };
  }
  return { ...state, pack, lastStrikeAt };
};
