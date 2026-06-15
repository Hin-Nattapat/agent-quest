import { test, expect } from "bun:test";
import { ActivityState } from "./activity";
import { PACK_HITS } from "./combat";
import {
  ScenePhase,
  REST_GAP_MS,
  STRIKE_THROTTLE_MS,
  initDirector,
  stepDirector,
} from "./scene-phase";

const farming = (over: object = {}) => ({
  now: 0,
  activity: ActivityState.Farming,
  wantStrike: false,
  ...over,
});

test("Wander → Engage spawns a pack when farming", () => {
  const s = stepDirector(initDirector, farming({ now: 1000 }));
  expect(s.phase).toBe(ScenePhase.Engage);
  expect(s.pack.length).toBeGreaterThanOrEqual(1);
  expect(s.pack.length).toBeLessThanOrEqual(3);
  expect(s.pack.every(h => h === PACK_HITS)).toBe(true);
  expect(s.waveIndex).toBe(1);
});

test("stays in Wander when idle", () => {
  const s = stepDirector(initDirector, {
    now: 5000,
    activity: ActivityState.Idle,
    wantStrike: false,
  });
  expect(s.phase).toBe(ScenePhase.Wander);
  expect(s.pack).toEqual([]);
});

test("a throttled strike damages the leftmost mob; too-soon strikes are ignored", () => {
  let s = stepDirector(initDirector, farming({ now: 0 }));
  const size = s.pack.length;
  s = stepDirector(s, farming({ now: STRIKE_THROTTLE_MS, wantStrike: true }));
  expect(s.pack[0]).toBe(PACK_HITS - 1);
  const before = s.pack[0];
  s = stepDirector(s, farming({ now: 2 * STRIKE_THROTTLE_MS - 1, wantStrike: true }));
  expect(s.pack[0]).toBe(before);
  expect(s.pack.length).toBe(size);
});

test("clearing the pack enters a rest gap, then re-engages once it elapses", () => {
  let s = { ...initDirector, phase: ScenePhase.Engage, pack: [1], waveIndex: 1 };
  s = stepDirector(s, farming({ now: 10_000, wantStrike: true }));
  expect(s.phase).toBe(ScenePhase.Wander);
  expect(s.pack).toEqual([]);
  expect(s.restUntil).toBe(10_000 + REST_GAP_MS);

  const resting = stepDirector(s, farming({ now: 10_000 + REST_GAP_MS - 1 }));
  expect(resting.phase).toBe(ScenePhase.Wander);
  const next = stepDirector(s, farming({ now: 10_000 + REST_GAP_MS }));
  expect(next.phase).toBe(ScenePhase.Engage);
  expect(next.waveIndex).toBe(2);
});

test("going non-farming mid-wave abandons the pack", () => {
  const engaged = {
    ...initDirector,
    phase: ScenePhase.Engage,
    pack: [PACK_HITS, PACK_HITS],
    waveIndex: 1,
  };
  const s = stepDirector(engaged, {
    now: 3000,
    activity: ActivityState.Idle,
    wantStrike: false,
  });
  expect(s.phase).toBe(ScenePhase.Wander);
  expect(s.pack).toEqual([]);
  expect(s.restUntil).toBeNull();
});
