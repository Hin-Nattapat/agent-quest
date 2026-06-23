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

// Active frame index for an N-frame loop. playing=false, a single frame, or reduced-motion holds 0.
// The frames live as stacked, always-decoded layers (see SpriteFrames) so only this index — never a
// background-image url — changes per frame: the GPU just flips which layer is opaque, with nothing to
// re-decode, which is what kills the per-frame flash a background-image swap causes in the webview.
export const useSpriteIndex = (
  frameCount: number,
  fps: number,
  playing: boolean,
): number => {
  const [index, setIndex] = useState(0);
  const startRef = useRef<number | null>(null);

  const active = playing && frameCount > 1 && !prefersReducedMotion();

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
      const next = frameAt(now - startRef.current, frameCount, fps);
      // rAF ticks ~60Hz but the frame only changes at `fps`; bail when unchanged so we re-render at
      // the animation rate, not every paint.
      setIndex(prev => (prev === next ? prev : next));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, frameCount, fps]);

  if (frameCount === 0) {
    return 0;
  }
  // Clamp: on the render where the frame set shrinks, `index` can still hold a stale value from the
  // previous longer set until the effect re-runs and resets it — guard against a transient OOB read.
  return Math.min(index, frameCount - 1);
};
