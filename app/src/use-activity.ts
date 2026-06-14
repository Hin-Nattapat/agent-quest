import { useEffect, useState } from "react";
import type { IState } from "../../core/state";
import { activityState, ActivityState } from "./activity";

const TICK_MS = 5000;

// Re-derives on a timer because, while idle, state.json doesn't change (no SSE push).
export const useActivity = (state: IState | null): ActivityState => {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, []);

  if (!state) {
    return ActivityState.Idle;
  }
  return activityState(state.last_event, now);
};
