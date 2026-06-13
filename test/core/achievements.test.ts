import { test, expect } from "bun:test";
import {
  evaluateAchievements,
  DEFAULT_ACHIEVEMENTS,
  type IAchievementDef,
} from "../../core/achievements";
import type { IState } from "../../core/state";

const st = (o: Partial<IState>): IState => ({
  version: 1,
  updated_at: "",
  xp_total: 0,
  level: 1,
  xp_in_level: 0,
  xp_to_next: 7,
  stats: { prompts: 0, actions: {}, sessions: 0, by_source: {}, by_repo: {} },
  ...o,
});

const registry: Record<string, IAchievementDef> = {
  starter: {
    name: "Starter",
    desc: "",
    cond: { stat: "actions_total", gte: 1 },
    points: 5,
    reward: { title: "Rookie" },
  },
  big: { name: "Big", desc: "", cond: { stat: "actions_total", gte: 1000 }, points: 10 },
  weekly: { name: "Weekly", desc: "", cond: { stat: "streak_best", gte: 7 }, points: 15 },
  explorer: {
    name: "Explorer",
    desc: "",
    cond: { distinct: "repo", gte: 2 },
    points: 15,
  },
  combo: {
    name: "Combo",
    desc: "",
    cond: {
      all: [
        { stat: "edits", gte: 1 },
        { stat: "runs", gte: 1 },
      ],
    },
    points: 20,
  },
  secret: {
    name: "Secret",
    desc: "",
    cond: { stat: "level", gte: 5 },
    points: 25,
    reward: { unlocks_class: SecretLine.Maestro },
  },
};

test("earns met conditions, sums points, ignores unknown reward keys", () => {
  const state = st({
    level: 5,
    stats: {
      prompts: 0,
      actions: { edit: 3, run: 2 },
      sessions: 1,
      by_source: { "claude-code": { xp: 1, sessions: 1 } },
      by_repo: { a: { xp: 1, sessions: 1 }, b: { xp: 1, sessions: 1 } },
    },
    streak: { current_days: 8, best_days: 8, last_active: "2026-06-11" },
  });
  const r = evaluateAchievements(state, registry);
  expect(r.earned.sort()).toEqual(["combo", "explorer", "secret", "starter", "weekly"]);
  // starter 5 + weekly 15 + explorer 15 + combo 20 + secret 25 = 80; "big" needs 1000 -> not earned
  expect(r.points).toBe(80);
  expect(r.progress.big).toBe(5); // actions_total = 5, unearned single-stat -> progress
});

test("empty/undefined registry is safe", () => {
  expect(evaluateAchievements(st({}), {})).toEqual({
    earned: [],
    points: 0,
    progress: {},
  });
});

import { SecretLine } from "../../core/classes";

function baseState(over: Partial<any> = {}): any {
  return {
    version: 1,
    xp_total: 0,
    level: 0,
    xp_in_level: 0,
    xp_to_next: 0,
    stats: { prompts: 0, actions: {}, sessions: 0, by_source: {}, by_repo: {} },
    ...over,
  };
}

test("maestro needs both 3 sources AND level >= 25; one alone is not enough", () => {
  const reg = DEFAULT_ACHIEVEMENTS;
  const sources = {
    by_source: {
      a: { xp: 1, sessions: 1 },
      b: { xp: 1, sessions: 1 },
      c: { xp: 1, sessions: 1 },
    },
  };
  const low = baseState({
    level: 10,
    stats: { prompts: 0, actions: {}, sessions: 0, by_repo: {}, ...sources },
  });
  const high = baseState({
    level: 25,
    stats: { prompts: 0, actions: {}, sessions: 0, by_repo: {}, ...sources },
  });
  expect(evaluateAchievements(low, reg).earned).not.toContain("maestro");
  expect(evaluateAchievements(high, reg).earned).toContain("maestro");
  expect(reg.maestro.reward?.unlocks_class).toBe(SecretLine.Maestro);
});

test("night_owl / the_gremlin / the_ascetic read the new signals", () => {
  const reg = DEFAULT_ACHIEVEMENTS;
  const owl = baseState({
    level: 20,
    stats: {
      prompts: 0,
      actions: {},
      sessions: 0,
      by_source: {},
      by_repo: {},
      night_actions: 60,
    },
  });
  expect(evaluateAchievements(owl, reg).earned).toContain("night_owl");
  const grem = baseState({
    level: 20,
    stats: {
      prompts: 0,
      actions: {},
      sessions: 0,
      by_source: {},
      by_repo: {},
      failures_recovered: 40,
    },
  });
  expect(evaluateAchievements(grem, reg).earned).toContain("the_gremlin");
  const asc = baseState({
    level: 25,
    stats: {
      prompts: 0,
      actions: {},
      sessions: 0,
      by_source: {},
      by_repo: {},
      ascetic_seal: 1,
    },
  });
  expect(evaluateAchievements(asc, reg).earned).toContain("the_ascetic");
});

test("a deed earns at its cmd_* threshold", () => {
  const reg = DEFAULT_ACHIEVEMENTS;
  const withCmds = (cmds: Record<string, number>) =>
    baseState({
      stats: { prompts: 0, actions: {}, sessions: 0, by_source: {}, by_repo: {}, cmds },
    });
  expect(evaluateAchievements(withCmds({ reflog: 1 }), reg).earned).toContain("undying");
  expect(evaluateAchievements(withCmds({ stash: 19 }), reg).earned).not.toContain(
    "hoarder",
  );
  expect(evaluateAchievements(withCmds({ stash: 20 }), reg).earned).toContain("hoarder");
  expect(reg.timebender.reward?.title).toBe("Timebender");
});
