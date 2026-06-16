import { useEffect, useRef, useState } from "react";
import { Facing, facingFromDelta } from "./facing";

export interface IWanderPose {
  xPct: number;
  yPct: number;
  facing: Facing;
  moving: boolean;
}

interface IStepWanderArgs {
  xPct: number;
  yPct: number;
  targetX: number;
  targetY: number;
  speedPctPerSec: number;
  dtMs: number;
}

// One integration tick toward the target. Snaps + stops when the remaining distance is within a
// single step (prevents overshoot jitter). Pure so the motion math is unit-tested without rAF.
export const stepWander = (
  props: IStepWanderArgs,
): { pose: IWanderPose; reached: boolean } => {
  const { xPct, yPct, targetX, targetY, speedPctPerSec, dtMs } = props;
  const dx = targetX - xPct;
  const dy = targetY - yPct;
  const dist = Math.hypot(dx, dy);
  const step = speedPctPerSec * (dtMs / 1000);
  const facing = facingFromDelta(dx, dy);
  if (dist <= step || dist < 0.5) {
    return { pose: { xPct: targetX, yPct: targetY, facing, moving: false }, reached: true };
  }
  return {
    pose: { xPct: xPct + (dx / dist) * step, yPct: yPct + (dy / dist) * step, facing, moving: true },
    reached: false,
  };
};

// Waypoints + rest spot in panel-relative percentages (so the room scales with the panel).
const WAYPOINTS = [
  { x: 25, y: 35 },
  { x: 70, y: 30 },
  { x: 72, y: 68 },
  { x: 35, y: 75 },
  { x: 22, y: 55 },
];
const REST_SPOT = { x: 50, y: 62 };
const SPEED_PCT_PER_SEC = 14;
const PAUSE_MIN_MS = 900;
const PAUSE_MAX_MS = 2200;

const prefersReducedMotion = (): boolean => {
  if (typeof window === "undefined" || !window.matchMedia) {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
};

// roaming=false (Rest) pins the hero to the rest spot facing south. reduced-motion holds the
// first waypoint. Otherwise the hero walks waypoint→waypoint with a varied pause between legs.
export const useWander = (roaming: boolean): IWanderPose => {
  const restPose: IWanderPose = { xPct: REST_SPOT.x, yPct: REST_SPOT.y, facing: Facing.South, moving: false };
  const first = WAYPOINTS[0];
  const idlePose: IWanderPose = { xPct: first.x, yPct: first.y, facing: Facing.South, moving: false };
  const [pose, setPose] = useState<IWanderPose>(roaming ? idlePose : restPose);
  const wpRef = useRef(0);
  const pauseRef = useRef(0);
  const posRef = useRef({ x: first.x, y: first.y });
  const lastRef = useRef<number | null>(null);

  const active = roaming && !prefersReducedMotion();

  useEffect(() => {
    if (!active) {
      setPose(roaming ? idlePose : restPose);
      lastRef.current = null;
      return;
    }
    let raf = 0;
    const tick = (now: number) => {
      if (lastRef.current === null) {
        lastRef.current = now;
      }
      const dtMs = now - lastRef.current;
      lastRef.current = now;
      if (pauseRef.current > 0) {
        pauseRef.current -= dtMs;
      } else {
        const target = WAYPOINTS[wpRef.current];
        const r = stepWander({
          xPct: posRef.current.x,
          yPct: posRef.current.y,
          targetX: target.x,
          targetY: target.y,
          speedPctPerSec: SPEED_PCT_PER_SEC,
          dtMs,
        });
        posRef.current = { x: r.pose.xPct, y: r.pose.yPct };
        setPose(r.pose);
        if (r.reached) {
          pauseRef.current = PAUSE_MIN_MS + (wpRef.current / WAYPOINTS.length) * (PAUSE_MAX_MS - PAUSE_MIN_MS);
          wpRef.current = (wpRef.current + 1) % WAYPOINTS.length;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // re-arm when active OR roaming flips (covers reduced-motion Rest↔Idle); WAYPOINTS/speed are constants.
  }, [active, roaming]);

  return pose;
};
