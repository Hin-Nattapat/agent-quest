import { useEffect, useRef } from "react";

export interface ITimerPool {
  later: (fn: () => void, ms: number) => void;
  clearAll: () => void;
}

// A pool of setTimeouts that are all cleared on unmount, and on demand via clearAll(). The combat
// hooks fan out their CSS-pulse choreography through it so timers never leak across a remount or a
// fresh encounter/replay. `later`/`clearAll` close over a stable ref, so they're safe to call from
// effects without being dependencies.
export const useTimerPool = (): ITimerPool => {
  const timers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  const clearAll = (): void => {
    for (const timer of timers.current) {
      clearTimeout(timer);
    }
    timers.current.clear();
  };

  const later = (fn: () => void, ms: number): void => {
    const timer = setTimeout(() => {
      timers.current.delete(timer);
      fn();
    }, ms);
    timers.current.add(timer);
  };

  useEffect(() => {
    return () => {
      clearAll();
    };
  }, []);

  return { later, clearAll };
};
