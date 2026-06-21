import { test, expect } from "bun:test";
import { reduce } from "../../core/reduce";
import { EventType } from "../../core/events";
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
  const s = reduce({ events, config: cfg });
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
  const s = reduce({ events: [], config: cfg });
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
  const s = reduce({ events, config: cfgA, today: "2026-06-11" });
  expect(s.streak?.best_days).toBe(2);
  expect(s.streak?.current_days).toBe(2);
});

test("an explicit today with a gap breaks current_days", () => {
  const events = [evd("2026-06-01", { type: "prompt", repo: "cq" })];
  const s = reduce({ events, config: cfgA, today: "2026-06-15" });
  expect(s.streak?.current_days).toBe(0);
});

test("reduce earns first_blood once an action exists", () => {
  const events = [evd("2026-06-11", { type: "action", action: "edit", repo: "cq" })];
  const s = reduce({ events, config: cfgA, today: "2026-06-11" });
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
  const s = reduce({
    events: [evd("2026-06-11", { type: "action", action: "run", repo: "cq" })],
    config: cfgA,
    today: "2026-06-11",
  });
  expect(s.class?.line).toBe(null);
  expect(s.class?.form).toBe(ClassForm.Novice);
  expect(s.class?.affinity.mage).toBeGreaterThan(0);
});

test("at level 5 with no line, advancement_pending is 'class'", () => {
  const s = reduce({ events: promptsTo5, config: cfgA, today: "2026-06-11" });
  expect(s.level).toBe(5);
  expect(s.class?.advancement_pending).toBe("class");
});

test("a chosen line resolves to its tier form + name", () => {
  const s = reduce({
    events: promptsTo5,
    config: cfgA,
    today: "2026-06-11",
    profile: {
      name: "Gandalf",
      line: ClassLine.Mage,
    },
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
  const classed = reduce({
    events: microEvents,
    config: microCfg,
    today: "2026-06-11",
    profile: { line: ClassLine.Mage },
  });
  expect(classed.xp_total).toBe(10);
  const novice = reduce({ events: microEvents, config: microCfg, today: "2026-06-11" });
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
  const ordered = reduce({
    events: microEvents,
    config: microCfg,
    today: "2026-06-11",
    profile: { line: ClassLine.Mage },
  });
  const out = reduce({
    events: shuffled,
    config: microCfg,
    today: "2026-06-11",
    profile: { line: ClassLine.Mage },
  });
  expect(out.xp_total).toBe(ordered.xp_total);
  expect(out).toEqual(ordered);
});

test("base_passive_pct reflects the resolved tier", () => {
  const s = reduce({
    events: promptsTo5,
    config: cfgA,
    today: "2026-06-11",
    profile: { name: "G", line: ClassLine.Mage },
  });
  expect(s.class?.tier).toBe(1);
  expect(s.class?.base_passive_pct).toBe(basePct(1));
});

const zeroCfg = {
  weights: {
    prompt: 0,
    turn_end: 0,
    session_end: 0,
    actions: { edit: 0, write: 0, run: 0, read: 0, search: 0, delegate: 0, other: 0 },
  },
  difficulty: DEFAULT_DIFFICULTY,
};

test("a clean session drops loot; a session with a fail does not", () => {
  const clean = [
    at("01", { session_id: "s1", type: "action", action: "edit", repo: "cq" }),
    at("02", { session_id: "s1", type: "session_end", repo: "cq" }),
  ];
  expect(
    reduce({ events: clean, config: zeroCfg, today: "2026-06-11" }).inventory?.length,
  ).toBe(1);

  const failed = [
    at("01", { session_id: "s2", type: "action_fail", action: "run", repo: "cq" }),
    at("02", { session_id: "s2", type: "session_end", repo: "cq" }),
  ];
  expect(
    reduce({ events: failed, config: zeroCfg, today: "2026-06-11" }).inventory,
  ).toEqual([]);
});

test("loot is idempotent", () => {
  const ev = [at("01", { session_id: "s1", type: "session_end", repo: "cq" })];
  expect(reduce({ events: ev, config: zeroCfg, today: "2026-06-11" }).inventory).toEqual(
    reduce({ events: ev, config: zeroCfg, today: "2026-06-11" }).inventory,
  );
});

test("cosmetics resolve only when the equipped item is owned", () => {
  const ev = [at("01", { session_id: "s1", type: "action", action: "edit", repo: "cq" })];
  const s = reduce({
    events: ev,
    config: zeroCfg,
    today: "2026-06-11",
    profile: { title: "archmage_title" },
  });
  expect(s.inventory).toEqual([]);
  expect(s.cosmetics?.title).toBe(null);
});

import { SecretLine } from "../../core/classes";
import { loadConfig } from "../../core/config";
import { makeHome } from "../helpers";

const easy = (home: string) => ({
  ...loadConfig(home),
  difficulty: { curve_k: 1, curve_exp: 1, level_cap: 50 },
});
const act = (i: number, o: object) =>
  ({
    ts: `2026-06-11T12:00:00Z`,
    source: "s",
    session_id: "sess",
    type: "action",
    ...o,
  }) as any;

test("secret base passive multiplies its thematic signal (Maestro/delegate micro-case)", () => {
  const maestroEvents = [
    at("01", { type: "prompt", repo: "cq" }),
    at("02", { type: "prompt", repo: "cq" }),
    at("03", { type: "prompt", repo: "cq" }),
    at("04", { type: "prompt", repo: "cq" }),
    at("05", { type: "action", action: "delegate", repo: "cq" }),
    at("06", { type: "action", action: "delegate", repo: "cq" }),
    at("07", { type: "action", action: "delegate", repo: "cq" }),
  ];
  const maestro = reduce({
    events: maestroEvents,
    config: microCfg,
    today: "2026-06-11",
    profile: {
      line: SecretLine.Maestro,
    },
  });
  expect(maestro.xp_total).toBe(10); // 4 + 2 + 2 + 2 (delegates x2 past Lv.5)
});

test("achievements split into earned, locked goals (with criteria), and a hidden secret count", () => {
  const s = reduce({ events: [], config: cfgA, today: "2026-06-11" });
  const a = s.achievements!;
  // Fresh state: nothing earned → every deed is either a visible locked goal or a hidden secret.
  expect(a.locked!.length).toBeGreaterThan(0);
  expect(a.locked!.every(d => d.desc.length > 0 && d.name.length > 0)).toBe(true);
  expect(a.secret).toBeGreaterThan(0);
  // The three buckets exactly partition the registry, and locked never overlaps earned.
  expect(a.earned.length + a.locked!.length + (a.secret ?? 0)).toBe(a.total);
  const earnedIds = new Set(a.earned);
  expect(a.locked!.some(d => earnedIds.has(d.id))).toBe(false);
});

test("earning an unlock achievement fills unlocked_secret_classes; balance gates on level", () => {
  const cfg = easy(makeHome());
  const many = Array.from({ length: 30 }, (_, i) =>
    act(i, { source: `s${i % 3}`, action: "read" }),
  );
  const hi = reduce({ events: many, config: cfg, today: "2026-06-11" });
  expect(hi.unlocked_secret_classes).toContain(SecretLine.Maestro);
  const few = Array.from({ length: 3 }, (_, i) =>
    act(i, { source: `s${i}`, action: "read" }),
  );
  expect(
    reduce({ events: few, config: cfg, today: "2026-06-11" }).unlocked_secret_classes ??
      [],
  ).not.toContain(SecretLine.Maestro);
});

test("xyzzy unlocks the Trickster; unlocks are stable on recompute", () => {
  const cfg = loadConfig(makeHome());
  const a = reduce({
    events: microEvents,
    config: cfg,
    today: "2026-06-11",
    profile: { xyzzy: true },
  });
  const b = reduce({
    events: microEvents,
    config: cfg,
    today: "2026-06-11",
    profile: { xyzzy: true },
  });
  expect(a.unlocked_secret_classes).toContain(SecretLine.Trickster);
  expect(b.unlocked_secret_classes).toEqual(a.unlocked_secret_classes);
});

test("failures_recovered counts a fail then a same-kind success in one session", () => {
  const evs = [
    act(0, { type: "action_fail", action: "run", session_id: "x" }),
    act(1, { type: "action", action: "run", session_id: "x" }),
    act(2, { type: "action_fail", action: "edit", session_id: "x" }),
  ];
  const s = reduce({ events: evs, config: microCfg, today: "2026-06-11" });
  expect(s.stats.failures_recovered).toBe(1);
});

test("the fold tallies cmd tags and a single rebase --onto earns Threads of Fate", () => {
  const cfg = loadConfig(makeHome());
  const evs = [
    {
      ts: "2026-06-11T12:00:00Z",
      source: "claude-code",
      session_id: "s",
      type: "action",
      action: "run",
      repo: "cq",
      cmd: "git_rebase_onto",
    },
    {
      ts: "2026-06-11T12:00:01Z",
      source: "claude-code",
      session_id: "s",
      type: "action",
      action: "run",
      repo: "cq",
      cmd: "test_run",
    },
    {
      ts: "2026-06-11T12:00:02Z",
      source: "claude-code",
      session_id: "s",
      type: "action",
      action: "run",
      repo: "cq",
      cmd: "test_run",
    },
  ] as any;
  const s = reduce({ events: evs, config: cfg, today: "2026-06-11" });
  expect(s.stats.cmds).toEqual({ git_rebase_onto: 1, test_run: 2 });
  expect(s.achievements?.earned).toContain("timebender");
});

test("last_event is the latest event by ts (or undefined when empty)", () => {
  const cfg = loadConfig(makeHome());
  const evs = [
    {
      ts: "2026-06-11T12:00:00Z",
      source: "claude-code",
      session_id: "s",
      type: "prompt",
      repo: "cq",
    },
    {
      ts: "2026-06-11T12:05:00Z",
      source: "claude-code",
      session_id: "s",
      type: "session_end",
      repo: "cq",
    },
    {
      ts: "2026-06-11T12:02:00Z",
      source: "claude-code",
      session_id: "s",
      type: "action",
      action: "run",
      repo: "cq",
    },
  ] as any;
  expect(reduce({ events: evs, config: cfg, today: "2026-06-11" }).last_event).toEqual({
    ts: "2026-06-11T12:05:00Z",
    type: EventType.SessionEnd,
    source: "claude-code",
  });
  expect(
    reduce({ events: [], config: cfg, today: "2026-06-11" }).last_event,
  ).toBeUndefined();
});

test("bosses are rate-based, seeded, and idempotent", () => {
  const home = makeHome();
  const acts = Array.from(
    { length: 20 },
    () =>
      ({
        ts: "2026-06-11T12:00:00Z",
        source: "claude-code",
        session_id: "s",
        type: "action",
        action: "read",
        repo: "cq",
      }) as any,
  );

  const none = reduce({
    events: acts,
    config: { ...loadConfig(home), boss_rate: 0 },
    today: "2026-06-11",
  });
  expect(none.stats.boss_defeated).toBe(0);
  expect(none.stats.boss_fled).toBe(0);

  const won = reduce({
    events: acts,
    config: { ...loadConfig(home), boss_rate: 1, boss_flee_rate: 0 },
    today: "2026-06-11",
  });
  expect(won.stats.boss_defeated).toBe(20);
  expect(won.stats.boss_fled).toBe(0);
  expect((won.inventory ?? []).length).toBeGreaterThan(0);

  const fled = reduce({
    events: acts,
    config: { ...loadConfig(home), boss_rate: 1, boss_flee_rate: 1 },
    today: "2026-06-11",
  });
  expect(fled.stats.boss_fled).toBe(20);
  expect(fled.stats.boss_defeated).toBe(0);

  expect(
    reduce({
      events: acts,
      config: { ...loadConfig(home), boss_rate: 1, boss_flee_rate: 0 },
      today: "2026-06-11",
    }),
  ).toEqual(won);
});

import { TimelineKind } from "../../core/timeline";

const cfgBoss = {
  weights: DEFAULT_WEIGHTS,
  difficulty: DEFAULT_DIFFICULTY,
  boss_rate: 1, // every action spawns a boss (deterministic for the test)
  boss_flee_rate: 0, // never flees -> always defeated + drops
};

test("reduce records level-up + boss + loot milestones, idempotently", () => {
  const events = [
    ev({ type: "action", action: "edit" }),
    ev({ type: "action", action: "write" }),
    ev({ type: "action", action: "run" }),
  ];
  const s = reduce({ events, config: cfgBoss });
  const kinds = (s.recent ?? []).map(r => r.kind);
  expect(kinds).toContain(TimelineKind.BossDefeated);
  expect(kinds).toContain(TimelineKind.Loot);
  expect(kinds).toContain(TimelineKind.LevelUp);

  const s2 = reduce({ events, config: cfgBoss });
  expect(s2.recent).toEqual(s.recent); // idempotent
});

test("no boss spawns -> no boss/loot milestones", () => {
  const cfgNoBoss = {
    weights: DEFAULT_WEIGHTS,
    difficulty: DEFAULT_DIFFICULTY,
    boss_rate: 0,
  };
  const s = reduce({
    events: [ev({ type: "action", action: "edit" }), ev({ type: "prompt" })],
    config: cfgNoBoss,
  });
  const kinds = (s.recent ?? []).map(r => r.kind);
  expect(kinds).not.toContain(TimelineKind.BossDefeated);
  expect(kinds).not.toContain(TimelineKind.Loot);
});

test("reduce counts action_fail events into stats.action_fails, idempotently", () => {
  const events = [
    ev({ type: "action", action: "edit" }),
    ev({ type: "action_fail", action: "run" }),
    ev({ type: "action_fail", action: "read" }),
  ];
  const s = reduce({ events, config: cfg });
  expect(s.stats.action_fails).toBe(2);
  expect(reduce({ events, config: cfg }).stats.action_fails).toBe(2); // idempotent

  const clean = reduce({ events: [ev({ type: "action", action: "edit" })], config: cfg });
  expect(clean.stats.action_fails).toBe(0);
});

import type { IProfile } from "../../core/profile";

test("reduce denormalizes class.tree + achievements.earned_detail + total (idempotent)", () => {
  const events = [evd("2026-06-11", { type: "action", action: "edit" })]; // earns first_blood
  const profile = { line: "mage" } as unknown as IProfile;
  const s = reduce({ events, config: cfgA, today: "2026-06-11", profile });

  expect(s.class?.tree?.forms.length).toBe(3);
  expect(s.class?.tree?.branches).toBeDefined();

  const fb = s.achievements?.earned_detail?.find(d => d.id === "first_blood");
  expect(fb?.name).toBe("First Blood");
  expect(typeof fb?.desc).toBe("string");
  expect(s.achievements?.total).toBeGreaterThan(0);

  expect(
    reduce({ events, config: cfgA, today: "2026-06-11", profile }).achievements
      ?.earned_detail,
  ).toEqual(s.achievements?.earned_detail);
});

test("reduce enriches inventory items with name/kind", () => {
  const events = [
    evd("2026-06-11", { session_id: "s1", type: "action", action: "edit" }),
    evd("2026-06-11", { session_id: "s1", type: "session_end" }),
  ];
  const s = reduce({ events, config: cfgA, today: "2026-06-11" });
  for (const item of s.inventory ?? []) {
    expect(typeof item.name).toBe("string");
    expect(typeof item.kind).toBe("string");
  }
});
