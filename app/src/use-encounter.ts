import { useEffect, useRef, useState } from "react";
import type { IState } from "../../core/state";
import { diffStates, type IGameEvent } from "./game-events";

const ENCOUNTER_MS = 4500; // min on-screen battle so a real drop never flashes

// Diffs each new state into encounter events and plays them one at a time.
export function useEncounter(state: IState | null): IGameEvent | null {
  const prevRef = useRef<IState | null>(null);
  const [queue, setQueue] = useState<IGameEvent[]>([]);
  const [current, setCurrent] = useState<IGameEvent | null>(null);

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
    const id = setTimeout(() => setCurrent(null), ENCOUNTER_MS);
    return () => clearTimeout(id);
  }, [current, queue]);

  return current;
}
