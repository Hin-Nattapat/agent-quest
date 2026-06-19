import { useEffect, useRef, useState } from "react";
import type { IState } from "../../core/state";
import { diffStates, type IGameEvent } from "./game-events";

const ENCOUNTER_MS = 18200; // covers the scripted boss fight (10 turn-based rounds + the die/flee exit)

// Diffs each new state into encounter events and plays them one at a time.
export const useEncounter = (state: IState | null): IGameEvent | null => {
  const prevRef = useRef<IState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [queue, setQueue] = useState<IGameEvent[]>([]);
  const [current, setCurrent] = useState<IGameEvent | null>(null);

  // Clear the dismiss timer on unmount ONLY. It must not be the play effect's own cleanup: that
  // effect sets `current`/`queue`, so it re-runs immediately and React would fire the cleanup —
  // cancelling the timeout that dismisses the encounter, leaving the boss stuck on screen forever.
  useEffect(() => {
    return () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!state) {
      return;
    }
    const events = diffStates(prevRef.current, state);
    prevRef.current = state;
    if (events.length > 0) {
      setQueue(q => [...q, ...events]);
    }
  }, [state]);

  useEffect(() => {
    if (current || queue.length === 0) {
      return;
    }
    const [next, ...rest] = queue;
    setQueue(rest);
    setCurrent(next);
    timer.current = setTimeout(() => setCurrent(null), ENCOUNTER_MS);
  }, [current, queue]);

  return current;
};
