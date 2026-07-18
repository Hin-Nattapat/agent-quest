import { test, expect } from "bun:test";
import { renderHud, type ITail } from "../../hud/statusline";
import type { IState } from "../../core/state";

const state = (o: Partial<IState>): IState => ({
  version: 1,
  updated_at: "",
  xp_total: 0,
  level: 1,
  xp_in_level: 0,
  xp_to_next: 7,
  stats: { prompts: 0, actions: {}, sessions: 0, by_source: {}, by_repo: {} },
  ...o,
});

test("renders level, bar, percent, model, cost, ctx", () => {
  const s = state({ level: 5, xp_in_level: 200, xp_to_next: 300 }); // pct 0.4
  const tail: ITail = { model: "Opus 4.8", cost: 0.42, ctx: 8 };
  expect(renderHud({ state: s, tail })).toBe(
    "Adventurer · Novice  Lv.5 ████░░░░░░ 40%  |  Opus 4.8  $0.42  ·  ctx 8%",
  );
});

test("null cost -> $0.00, null ctx -> ctx 0%, null model -> ?", () => {
  const s = state({ level: 1, xp_in_level: 0, xp_to_next: 7 });
  expect(renderHud({ state: s, tail: { model: null, cost: null, ctx: null } })).toBe(
    "Adventurer · Novice  Lv.1 ░░░░░░░░░░ 0%  |  ?  $0.00  ·  ctx 0%",
  );
});

test("non-integer ctx is rounded", () => {
  const s = state({ level: 1, xp_in_level: 0, xp_to_next: 7 });
  expect(renderHud({ state: s, tail: { model: "M", cost: 1, ctx: 23.5 } })).toContain(
    "ctx 24%",
  );
});

test("max level shows full bar + MAX at 100%", () => {
  const s = state({ level: 50, xp_in_level: 1000, xp_to_next: 0 });
  expect(renderHud({ state: s, tail: { model: "M", cost: 0, ctx: 0 } })).toBe(
    "Adventurer · Novice  Lv.50 ██████████ MAX 100%  |  M  $0.00  ·  ctx 0%",
  );
});

test("named character shows icon + form; pending adds the sparkle", () => {
  const base = state({ level: 30, xp_in_level: 0, xp_to_next: 100 });
  const tail = { model: "Opus 4.8", cost: 0.42, ctx: 8 };
  const named = {
    ...base,
    name: "Gandalf",
    class: {
      line: "mage",
      tier: 3,
      form: "Infra Archmage",
      icon: "⚔",
      branch: null,
      affinity: {},
      advancement_pending: null,
    },
  } as any;
  expect(renderHud({ state: named, tail })).toContain(
    "Gandalf · ⚔ Infra Archmage  Lv.30",
  );

  const pending = {
    ...base,
    class: {
      line: null,
      tier: 0,
      form: "Novice",
      icon: "",
      branch: null,
      affinity: {},
      advancement_pending: "class",
    },
  } as any;
  expect(renderHud({ state: pending, tail })).toContain("Adventurer · Novice ✨  Lv.30");
});

test("shows the fire streak when current_days >= 1, hidden at 0", () => {
  const base = state({ level: 5, xp_in_level: 200, xp_to_next: 300 });
  const tail = { model: "M", cost: 0, ctx: 0 };
  const hot = {
    ...base,
    streak: { current_days: 5, best_days: 9, last_active: "2026-06-11" },
  };
  expect(renderHud({ state: hot, tail })).toContain(" 🔥5d ");
  const cold = {
    ...base,
    streak: { current_days: 0, best_days: 9, last_active: "2026-06-01" },
  };
  expect(renderHud({ state: cold, tail })).not.toContain("🔥");
});

test("loot cosmetics + rate limits render; null rates are omitted", () => {
  const s = {
    ...state({ level: 5, xp_in_level: 0, xp_to_next: 100 }),
    cosmetics: { title: "Codeweaver", theme_color: "36", name_color: null },
    inventory: [{ id: "x", rarity: "rare", count: 3 }],
  } as any;
  const out = renderHud({
    state: s,
    tail: {
      model: "Opus",
      cost: 0.5,
      ctx: 8,
      five_hour: 23,
      seven_day: 41,
    },
  });
  expect(out).toContain("Adventurer the Codeweaver");
  expect(out).toContain("\x1b[36m");
  expect(out).toContain("🎒3");
  expect(out).toContain("5h 23%");
  expect(out).toContain("7d 41%");

  const bare = renderHud({
    state: state({ level: 5, xp_in_level: 0, xp_to_next: 100 }),
    tail: {
      model: "M",
      cost: 0,
      ctx: 0,
      five_hour: null,
      seven_day: null,
    },
  });
  expect(bare).not.toContain("5h");
  expect(bare).not.toContain("7d");
});

test("space-between right-aligns the CC group when cols is wide", () => {
  const s = state({ level: 5, xp_in_level: 0, xp_to_next: 100 });
  const out = renderHud({ state: s, tail: { model: "M", cost: 0, ctx: 0 }, cols: 200 });
  expect(out.endsWith("ctx 0%")).toBe(true);
  expect(out).not.toContain("|");
  expect(out.length).toBe(196); // padded to cols, reserving a 4-col right safety gap
});

test("emoji are counted as two columns so the right group never clips", () => {
  const s = {
    ...state({ level: 5, xp_in_level: 0, xp_to_next: 100 }),
    streak: { current_days: 1, best_days: 1, last_active: "2026-06-11" },
    inventory: [{ id: "x", rarity: "rare", count: 22 }],
  } as any;
  const out = renderHud({
    state: s,
    tail: { model: "M", cost: 0, ctx: 0, five_hour: 37, seven_day: 41 },
    cols: 120,
  });
  expect(out.endsWith("7d 41%")).toBe(true); // full right group, not truncated
});

test("name + title are wrapped in the name-color ANSI when equipped", () => {
  const tail: ITail = { model: "M", cost: 0, ctx: 0 };
  const tinted = state({
    name: "Calypso",
    cosmetics: {
      title: "Archmage",
      theme_color: null,
      name_color: "1;38;2;255;54;255",
      companion: null,
    },
  });
  const out = renderHud({ state: tinted, tail });
  expect(out).toContain("\x1b[1;38;2;255;54;255mCalypso the Archmage\x1b[0m");

  const plain = state({
    name: "Calypso",
    cosmetics: {
      title: "Archmage",
      theme_color: null,
      name_color: null,
      companion: null,
    },
  });
  const plainOut = renderHud({ state: plain, tail });
  expect(plainOut).toContain("Calypso the Archmage");
  expect(plainOut).not.toContain("\x1b[1;38;2"); // no stray ANSI on the name
});

test("statusline appends the duck when a companion is equipped", () => {
  const tail: ITail = { model: "M", cost: 0, ctx: 0 };
  const withCompanion = state({
    name: "Calypso",
    cosmetics: {
      title: "Archmage",
      theme_color: null,
      name_color: null,
      companion: "sir_quacks",
    },
  });
  const out = renderHud({ state: withCompanion, tail });
  expect(out).toContain("🦆");
});
