import { useEffect, useRef, useState } from "react";

// Pure: elapsed ms since the cycle started → frame index. count <= 1 (idle / no art) holds 0.
export const frameAt = (elapsedMs: number, count: number, fps: number): number => {
  if (count <= 1) {
    return 0;
  }
  return Math.floor(elapsedMs / (1000 / fps)) % count;
};

const prefersReducedMotion = (): boolean => {
  if (typeof window === "undefined" || !window.matchMedia) {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
};

// Returns the current frame url. playing=false, a single frame, or reduced-motion holds frames[0].
// frames=[] returns "" so the caller can treat it as "no art".
export const useSpriteFrame = (
  frames: string[],
  fps: number,
  playing: boolean,
): string => {
  const [index, setIndex] = useState(0);
  const startRef = useRef<number | null>(null);

  const active = playing && frames.length > 1 && !prefersReducedMotion();

  useEffect(() => {
    if (!active) {
      setIndex(0);
      startRef.current = null;
      return;
    }
    let raf = 0;
    const tick = (now: number) => {
      if (startRef.current === null) {
        startRef.current = now;
      }
      setIndex(frameAt(now - startRef.current, frames.length, fps));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, frames.length, fps]);

  if (frames.length === 0) {
    return "";
  }
  // Clamp: on the render where `frames` shrinks, `index` can still hold a stale value from the
  // previous longer set until the effect re-runs and resets it — guard against a transient OOB read.
  return frames[Math.min(index, frames.length - 1)];
};
