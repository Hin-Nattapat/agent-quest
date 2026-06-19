import { useRef, useState } from "react";
import type { ITimerPool } from "./timer-pool";

// A list of short-lived ids for transient VFX (hit flashes, impact bursts). flash() pushes a fresh
// id and schedules its removal after `ttlMs` (match the matching CSS keyframe), so the list always
// reflects what's currently on screen. The removal rides the shared timer pool, so it's cleared
// along with everything else on unmount / replay.
export const useFlashIds = (
  pool: ITimerPool,
  ttlMs: number,
): [number[], () => void, () => void] => {
  const [ids, setIds] = useState<number[]>([]);
  const seq = useRef(0);

  const flash = (): void => {
    const id = seq.current;
    seq.current += 1;
    setIds(list => [...list, id]);
    pool.later(() => setIds(list => list.filter(x => x !== id)), ttlMs);
  };

  // Drop everything at once (the pool's clearAll already cancels the pending removals) — used when a
  // fresh encounter restarts the choreography so stale flashes don't linger.
  const clear = (): void => setIds([]);

  return [ids, flash, clear];
};
