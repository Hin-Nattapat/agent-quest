import { test, expect } from "bun:test";
import { diffStates, GameEventType } from "./game-events";

const st = (
  defeated: number,
  fled: number,
  inv: { id: string; rarity: string; count: number }[],
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
  }) as any;

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
