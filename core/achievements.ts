import type { IState, IAchievementsState } from "./state";

export type TCond =
  | { stat: string; gte?: number; lt?: number }
  | { distinct: "source" | "repo"; gte: number }
  | { all: TCond[] }
  | { any: TCond[] };

export interface IAchievementDef {
  name: string;
  desc: string;
  cond: TCond;
  points: number;
  reward?: { title?: string; loot_roll?: string; unlocks_class?: string };
  hidden?: boolean;
}

type TFacts = Record<string, number>;
type TStateLike = Omit<IState, "updated_at">;

function facts(state: TStateLike): TFacts {
  const a = state.stats.actions;
  const n = (k: string) => a[k] ?? 0;
  return {
    xp_total: state.xp_total,
    level: state.level,
    prompts: state.stats.prompts,
    sessions: state.stats.sessions,
    actions_total: Object.values(a).reduce((s, x) => s + x, 0),
    edits: n("edit"),
    writes: n("write"),
    runs: n("run"),
    reads: n("read"),
    searches: n("search"),
    delegates: n("delegate"),
    streak_best: state.streak?.best_days ?? 0,
    distinct_source: Object.keys(state.stats.by_source).length,
    distinct_repo: Object.keys(state.stats.by_repo).length,
  };
}

function passes(cond: TCond, f: TFacts): boolean {
  if ("all" in cond) {
    return cond.all.every(c => passes(c, f));
  }
  if ("any" in cond) {
    return cond.any.some(c => passes(c, f));
  }
  if ("distinct" in cond) {
    const v = cond.distinct === "source" ? f.distinct_source : f.distinct_repo;
    return v >= cond.gte;
  }
  const v = f[cond.stat] ?? 0;
  return (cond.gte == null || v >= cond.gte) && (cond.lt == null || v < cond.lt);
}

// Current value for a simple gte condition, for an unearned progress bar. null = no simple bar.
function progressValue(cond: TCond, f: TFacts): number | null {
  if ("distinct" in cond) {
    return cond.distinct === "source" ? f.distinct_source : f.distinct_repo;
  }
  if ("stat" in cond && cond.gte != null && cond.lt == null) {
    return f[cond.stat] ?? 0;
  }
  return null;
}

export function evaluateAchievements(
  state: TStateLike,
  registry: Record<string, IAchievementDef> = {},
): IAchievementsState {
  const f = facts(state);
  const earned: string[] = [];
  let points = 0;
  const progress: Record<string, number> = {};
  for (const [id, def] of Object.entries(registry)) {
    if (passes(def.cond, f)) {
      earned.push(id);
      points += def.points;
    } else {
      const p = progressValue(def.cond, f);
      if (p != null) {
        progress[id] = p;
      }
    }
  }
  return { earned, points, progress };
}

export const DEFAULT_ACHIEVEMENTS: Record<string, IAchievementDef> = {
  first_blood: {
    name: "First Blood",
    desc: "Run your first action",
    cond: { stat: "actions_total", gte: 1 },
    points: 5,
    reward: { title: "Rookie" },
  },
  tooling_up: {
    name: "Tooling Up",
    desc: "1,000 tool actions",
    cond: { stat: "actions_total", gte: 1000 },
    points: 10,
  },
  tool_master: {
    name: "Tool Master",
    desc: "10,000 tool actions",
    cond: { stat: "actions_total", gte: 10000 },
    points: 25,
    reward: { title: "Veteran" },
  },
  wordsmith: {
    name: "Wordsmith",
    desc: "500 prompts",
    cond: { stat: "prompts", gte: 500 },
    points: 10,
  },
  level_10: {
    name: "Double Digits",
    desc: "Reach level 10",
    cond: { stat: "level", gte: 10 },
    points: 15,
  },
  level_25: {
    name: "Halfway Hero",
    desc: "Reach level 25",
    cond: { stat: "level", gte: 25 },
    points: 30,
    reward: { title: "Adept" },
  },
  century: {
    name: "Century",
    desc: "100 sessions",
    cond: { stat: "sessions", gte: 100 },
    points: 20,
  },
  refactor_slayer: {
    name: "Refactor Slayer",
    desc: "1,000 edits",
    cond: { stat: "edits", gte: 1000 },
    points: 15,
    reward: { title: "Refactor Slayer" },
  },
  shell_wizard: {
    name: "Shell Wizard",
    desc: "1,000 shell runs",
    cond: { stat: "runs", gte: 1000 },
    points: 15,
    reward: { title: "Shell Wizard" },
  },
  bookworm: {
    name: "Bookworm",
    desc: "2,000 reads",
    cond: { stat: "reads", gte: 2000 },
    points: 10,
  },
  week_warrior: {
    name: "Week Warrior",
    desc: "7-day streak",
    cond: { stat: "streak_best", gte: 7 },
    points: 15,
    reward: { title: "Consistent" },
  },
  monthly_grind: {
    name: "Monthly Grind",
    desc: "30-day streak",
    cond: { stat: "streak_best", gte: 30 },
    points: 30,
    reward: { title: "Dedicated" },
  },
  unbroken: {
    name: "Unbroken",
    desc: "100-day streak",
    cond: { stat: "streak_best", gte: 100 },
    points: 50,
    reward: { title: "Unstoppable" },
  },
  wanderer: {
    name: "Wanderer",
    desc: "Work in 5 repos",
    cond: { distinct: "repo", gte: 5 },
    points: 15,
    reward: { title: "Explorer" },
  },
  globetrotter: {
    name: "Globetrotter",
    desc: "Work in 20 repos",
    cond: { distinct: "repo", gte: 20 },
    points: 25,
  },
  polyglot: {
    name: "Polyglot",
    desc: "Use 3 different agent sources",
    cond: { distinct: "source", gte: 3 },
    points: 25,
    hidden: true,
  },
  well_rounded: {
    name: "Well-Rounded",
    desc: "100+ each of edit, run, read, prompt",
    cond: {
      all: [
        { stat: "edits", gte: 100 },
        { stat: "runs", gte: 100 },
        { stat: "reads", gte: 100 },
        { stat: "prompts", gte: 100 },
      ],
    },
    points: 20,
    reward: { title: "Full-Stack" },
  },
  bash_goblin: {
    name: "Bash Goblin",
    desc: "5,000 shell runs",
    cond: { stat: "runs", gte: 5000 },
    points: 20,
    reward: { title: "Goblin" },
  },
  keyboard_archaeologist: {
    name: "Keyboard Archaeologist",
    desc: "5,000 reads",
    cond: { stat: "reads", gte: 5000 },
    points: 15,
  },
  yak_shaver: {
    name: "Yak Shaver",
    desc: "200 sessions",
    cond: { stat: "sessions", gte: 200 },
    points: 20,
    reward: { title: "Yak Shaver" },
  },
  delegator_supreme: {
    name: "Delegator Supreme",
    desc: "100 subagent delegations",
    cond: { stat: "delegates", gte: 100 },
    points: 15,
    reward: { title: "Overlord" },
  },
  leet: {
    name: "1337",
    desc: "Reach 1,337 XP",
    cond: { stat: "xp_total", gte: 1337 },
    points: 13,
    hidden: true,
  },
  the_grind: {
    name: "The Grind Never Stops",
    desc: "50,000 tool actions",
    cond: { stat: "actions_total", gte: 50000 },
    points: 50,
    reward: { title: "Machine" },
  },
  cant_stop: {
    name: "I Can't Stop",
    desc: "Reach level 50",
    cond: { stat: "level", gte: 50 },
    points: 50,
    reward: { title: "Maxed" },
  },
  talk_is_cheap: {
    name: "Talk Is Cheap",
    desc: "2,000 prompts and 50 delegations",
    cond: {
      all: [
        { stat: "prompts", gte: 2000 },
        { stat: "delegates", gte: 50 },
      ],
    },
    points: 20,
    reward: { title: "Manager" },
  },
};
