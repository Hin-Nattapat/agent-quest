import { test, expect } from "bun:test";
import { diffStates, GameEventType, combatBeats } from "./game-events";
import type { IState } from "../../core/state";

const st = (
  defeated: number,
  fled: number,
  inv: { id: string; rarity: string; count: number; name?: string }[],
) =>
  ({
    version: 1,
    xp_total: 0,
    level: 1,
    xp_in_level: 0,
    xp_to_next: 7,
    stats: {
      prompts: 0,
      actions: {},
      sessions: 0,
      by_source: {},
      by_repo: {},
      boss_defeated: defeated,
      boss_fled: fled,
    },
    inventory: inv,
  }) as unknown as IState;

test("diffStates emits boss outcomes with the loot delta", () => {
  const prev = st(0, 0, []);
  const won = st(1, 0, [{ id: "neon_theme", rarity: "rare", count: 1 }]);
  expect(diffStates(prev, won)).toEqual([
    { type: GameEventType.BossDefeated, items: ["neon_theme"] },
  ]);

  const fled = st(0, 1, []);
  expect(diffStates(prev, fled)).toEqual([{ type: GameEventType.BossFled, items: [] }]);

  expect(diffStates(prev, prev)).toEqual([]);
  expect(diffStates(null, won)).toEqual([]); // no animation on first load
});

test("diffStates shows the loot's display name, not the raw id", () => {
  const prev = st(0, 0, []);
  const won = st(1, 0, [
    { id: "archmage_title", rarity: "epic", count: 1, name: "Archmage" },
    { id: "neon_theme", rarity: "rare", count: 1 }, // no denormalized name → falls back to id
  ]);
  expect(diffStates(prev, won)).toEqual([
    { type: GameEventType.BossDefeated, items: ["Archmage", "neon_theme"] },
  ]);
});

const mkState = (o: object): IState =>
  ({ xp_total: 0, level: 1, stats: {}, ...o }) as unknown as IState;

test("combatBeats reports xp gain, failure, and level-up deltas", () => {
  const prev = mkState({ xp_total: 100, level: 5, stats: { action_fails: 2 } });
  const next = mkState({ xp_total: 103, level: 6, stats: { action_fails: 3 } });
  expect(combatBeats(prev, next)).toEqual({ xp: 3, hurt: true, leveledUp: true });
});

test("combatBeats is empty with no prev and clamps negative xp", () => {
  expect(combatBeats(null, mkState({ xp_total: 5 }))).toEqual({
    xp: 0,
    hurt: false,
    leveledUp: false,
  });
  const beats = combatBeats(mkState({ xp_total: 10 }), mkState({ xp_total: 4 }));
  expect(beats.xp).toBe(0); // clamped
});
