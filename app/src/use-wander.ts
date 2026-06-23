import { useEffect, useRef, useState } from "react";
import { Facing, facingFromDelta } from "./facing";
import { useReducedMotion } from "./use-reduce-motion";

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
    return {
      pose: { xPct: targetX, yPct: targetY, facing, moving: false },
      reached: true,
    };
  }
  return {
    pose: {
      xPct: xPct + (dx / dist) * step,
      yPct: yPct + (dy / dist) * step,
      facing,
      moving: true,
    },
    reached: false,
  };
};

interface IPoint {
  x: number;
  y: number;
}

// Several patrol routes across the open wooden floor, in percentages of the locked .guild-stage.
// The hero walks one route end-to-end, then switches to a different one, so the path varies instead
// of looping a single fixed loop. All points stay in x ~[24,78], y ~[56,86] — off the back wall +
// tables (top ~half) and the side walls (far edges).
const ROUTES: IPoint[][] = [
  // left → right across the upper floor
  [
    { x: 26, y: 60 },
    { x: 50, y: 58 },
    { x: 74, y: 62 },
  ],
  // right → left across the lower floor
  [
    { x: 74, y: 84 },
    { x: 50, y: 82 },
    { x: 30, y: 84 },
  ],
  // zigzag between the two
  [
    { x: 30, y: 62 },
    { x: 44, y: 84 },
    { x: 60, y: 60 },
    { x: 72, y: 82 },
  ],
  // a lap around the central rug
  [
    { x: 50, y: 60 },
    { x: 72, y: 72 },
    { x: 50, y: 84 },
    { x: 30, y: 72 },
  ],
];
const REST_SPOT = { x: 50, y: 74 };
const SPEED_PCT_PER_SEC = 9;
const PAUSE_MIN_MS = 900;
const PAUSE_MAX_MS = 2200;

// Pick a route index different from the current one (rand ∈ [0,1)). Maps rand onto the count-1
// other routes, so the hero never replays the route it just finished. Pure for unit testing.
export const pickNextRoute = (current: number, count: number, rand: number): number => {
  if (count <= 1) {
    return 0;
  }
  const i = Math.floor(rand * (count - 1));
  return i >= current ? i + 1 : i;
};

// roaming=false (Rest) pins the hero to the rest spot facing south. reduced-motion holds the first
// point. Otherwise the hero walks the current route point→point, then switches to a different route
// (via pickNextRoute) so the path varies, with a varied pause between legs.
export const useWander = (roaming: boolean): IWanderPose => {
  const restPose: IWanderPose = {
    xPct: REST_SPOT.x,
    yPct: REST_SPOT.y,
    facing: Facing.South,
    moving: false,
  };
  const first = ROUTES[0][0];
  const idlePose: IWanderPose = {
    xPct: first.x,
    yPct: first.y,
    facing: Facing.South,
    moving: false,
  };
  const [pose, setPose] = useState<IWanderPose>(roaming ? idlePose : restPose);
  const routeRef = useRef(0);
  const wpRef = useRef(0);
  const pauseRef = useRef(0);
  const posRef = useRef({ x: first.x, y: first.y });
  const lastRef = useRef<number | null>(null);
  const reduced = useReducedMotion();

  const active = roaming && !reduced;

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
        const route = ROUTES[routeRef.current];
        const target = route[wpRef.current];
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
          const lastLeg = wpRef.current >= route.length - 1;
          pauseRef.current =
            PAUSE_MIN_MS + (wpRef.current / route.length) * (PAUSE_MAX_MS - PAUSE_MIN_MS);
          if (lastLeg) {
            routeRef.current = pickNextRoute(
              routeRef.current,
              ROUTES.length,
              Math.random(),
            );
            wpRef.current = 0;
          } else {
            wpRef.current += 1;
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // re-arm when active OR roaming flips (covers reduced-motion Rest↔Idle); ROUTES/speed are constants.
  }, [active, roaming]);

  return pose;
};
