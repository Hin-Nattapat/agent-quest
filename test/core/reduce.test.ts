import { test, expect } from "bun:test";
import { reduce } from "../../core/reduce";
import { DEFAULT_WEIGHTS, DEFAULT_DIFFICULTY } from "../../core/xp";

const cfg = { weights: DEFAULT_WEIGHTS, difficulty: DEFAULT_DIFFICULTY };
const ev = (o: object) =>
  ({ ts: "t", source: "claude-code", session_id: "s1", ...o }) as any;

test("reduce sums xp, counts stats, splits by source/repo", () => {
  const events = [
    ev({ session_id: "s1", type: "session_start", repo: "cq" }),
    ev({ session_id: "s1", type: "prompt", repo: "cq" }), // +5
    ev({ session_id: "s1", type: "action", action: "edit", repo: "cq" }), // +4
    ev({ session_id: "s1", type: "action", action: "run", repo: "cq" }), // +3
    ev({ session_id: "s1", type: "action_fail", action: "run", repo: "cq" }), // +0
    ev({ session_id: "s2", type: "prompt", repo: "pos" }), // +5
    ev({ session_id: "s2", type: "session_end" }), // +20, no repo
  ];
  const s = reduce(events, cfg);
  expect(s.xp_total).toBe(37);
  expect(s.stats.prompts).toBe(2);
  expect(s.stats.actions).toEqual({ edit: 1, run: 1 }); // action_fail not counted
  expect(s.stats.sessions).toBe(2);
  expect(s.stats.by_source["claude-code"]).toEqual({ xp: 37, sessions: 2 });
  expect(s.stats.by_repo.cq).toEqual({ xp: 12, sessions: 1 });
  expect(s.stats.by_repo.pos).toEqual({ xp: 5, sessions: 1 }); // session_end (no repo) excluded
  expect(s.level).toBe(2); // 37 >= xpForLevel(2)=7, < xpForLevel(3)=40
  expect(s.version).toBe(1);
});

test("reduce of no events is a clean level-1 zero state", () => {
  const s = reduce([], cfg);
  expect(s.xp_total).toBe(0);
  expect(s.level).toBe(1);
  expect(s.stats.sessions).toBe(0);
});

import { DEFAULT_ACHIEVEMENTS } from "../../core/achievements";

const cfgA = {
  weights: DEFAULT_WEIGHTS,
  difficulty: DEFAULT_DIFFICULTY,
  achievements: DEFAULT_ACHIEVEMENTS,
};
const evd = (day: string, o: object) =>
  ({ ts: `${day}T12:00:00Z`, source: "claude-code", session_id: "s", ...o }) as any;

test("reduce folds a streak across consecutive local days", () => {
  const events = [
    evd("2026-06-10", { type: "action", action: "edit", repo: "cq" }),
    evd("2026-06-11", { type: "action", action: "edit", repo: "cq" }),
  ];
  const s = reduce(events, cfgA, "2026-06-11");
  expect(s.streak?.best_days).toBe(2);
  expect(s.streak?.current_days).toBe(2);
});

test("an explicit today with a gap breaks current_days", () => {
  const events = [evd("2026-06-01", { type: "prompt", repo: "cq" })];
  const s = reduce(events, cfgA, "2026-06-15");
  expect(s.streak?.current_days).toBe(0);
});

test("reduce earns first_blood once an action exists", () => {
  const events = [evd("2026-06-11", { type: "action", action: "edit", repo: "cq" })];
  const s = reduce(events, cfgA, "2026-06-11");
  expect(s.achievements?.earned).toContain("first_blood");
  expect(s.achievements?.points).toBeGreaterThanOrEqual(5);
});

import { ClassLine, ClassForm } from "../../core/classes";

const promptsTo5 = Array.from(
  { length: 60 },
  () =>
    ({
      ts: "2026-06-11T12:00:00Z",
      source: "claude-code",
      session_id: "s",
      type: "prompt",
      repo: "cq",
    }) as any,
);

test("no profile -> Novice class with affinity", () => {
  const s = reduce(
    [evd("2026-06-11", { type: "action", action: "run", repo: "cq" })],
    cfgA,
    "2026-06-11",
  );
  expect(s.class?.line).toBe(null);
  expect(s.class?.form).toBe(ClassForm.Novice);
  expect(s.class?.affinity.mage).toBeGreaterThan(0);
});

test("at level 5 with no line, advancement_pending is 'class'", () => {
  const s = reduce(promptsTo5, cfgA, "2026-06-11");
  expect(s.level).toBe(5);
  expect(s.class?.advancement_pending).toBe("class");
});

test("a chosen line resolves to its tier form + name", () => {
  const s = reduce(promptsTo5, cfgA, "2026-06-11", {
    name: "Gandalf",
    line: ClassLine.Mage,
  });
  expect(s.name).toBe("Gandalf");
  expect(s.class?.line).toBe(ClassLine.Mage);
  expect(s.class?.tier).toBe(1);
  expect(s.class?.form).toBe(ClassForm.BackendMage);
  expect(s.class?.advancement_pending).toBe(null);
});

import { basePct } from "../../core/xp";

const at = (sec: string, o: object) =>
  ({
    ts: `2026-06-11T12:00:${sec}Z`,
    source: "claude-code",
    session_id: "s",
    ...o,
  }) as any;

const microCfg = {
  weights: {
    prompt: 1,
    turn_end: 1,
    session_end: 1,
    actions: { edit: 1, write: 1, run: 1, read: 1, search: 1, delegate: 1, other: 1 },
  },
  difficulty: { curve_k: 1, curve_exp: 1, level_cap: 50 },
  passive: { 1: 1.0, 2: 1.0, 3: 1.0, 4: 1.0 },
};

const microEvents = [
  at("01", { type: "prompt", repo: "cq" }),
  at("02", { type: "prompt", repo: "cq" }),
  at("03", { type: "prompt", repo: "cq" }),
  at("04", { type: "prompt", repo: "cq" }),
  at("05", { type: "action", action: "run", repo: "cq" }),
  at("06", { type: "action", action: "run", repo: "cq" }),
  at("07", { type: "action", action: "run", repo: "cq" }),
];

test("base passive multiplies line-signal XP past Lv.5 (micro-case)", () => {
  const classed = reduce(microEvents, microCfg, "2026-06-11", { line: ClassLine.Mage });
  expect(classed.xp_total).toBe(10);
  const novice = reduce(microEvents, microCfg, "2026-06-11");
  expect(novice.xp_total).toBe(7);
});

test("xp_total is independent of input order (the reducer sorts by ts)", () => {
  const shuffled = [
    microEvents[6],
    microEvents[0],
    microEvents[4],
    microEvents[2],
    microEvents[5],
    microEvents[1],
    microEvents[3],
  ];
  const ordered = reduce(microEvents, microCfg, "2026-06-11", { line: ClassLine.Mage });
  const out = reduce(shuffled, microCfg, "2026-06-11", { line: ClassLine.Mage });
  expect(out.xp_total).toBe(ordered.xp_total);
  expect(out).toEqual(ordered);
});

test("base_passive_pct reflects the resolved tier", () => {
  const s = reduce(promptsTo5, cfgA, "2026-06-11", { name: "G", line: ClassLine.Mage });
  expect(s.class?.tier).toBe(1);
  expect(s.class?.base_passive_pct).toBe(basePct(1));
});
