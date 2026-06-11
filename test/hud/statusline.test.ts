import { test, expect } from "bun:test";
import { renderHud, type ITail } from "../../hud/statusline";
import type { IState } from "../../core/state";

const state = (o: Partial<IState>): IState => ({
  version: 1, updated_at: "", xp_total: 0, level: 1, xp_in_level: 0, xp_to_next: 7,
  stats: { prompts: 0, actions: {}, sessions: 0, by_source: {}, by_repo: {} }, ...o,
});

test("renders level, bar, percent, model, cost, ctx", () => {
  const s = state({ level: 5, xp_in_level: 200, xp_to_next: 300 }); // pct 0.4
  const tail: ITail = { model: "Opus 4.8", cost: 0.42, ctx: 8 };
  expect(renderHud(s, tail)).toBe("Lv.5 ████░░░░░░ 40%  |  Opus 4.8  $0.42  ·  ctx 8%");
});

test("null cost -> $0.00, null ctx -> ctx 0%, null model -> ?", () => {
  const s = state({ level: 1, xp_in_level: 0, xp_to_next: 7 });
  expect(renderHud(s, { model: null, cost: null, ctx: null })).toBe(
    "Lv.1 ░░░░░░░░░░ 0%  |  ?  $0.00  ·  ctx 0%");
});

test("non-integer ctx is rounded", () => {
  const s = state({ level: 1, xp_in_level: 0, xp_to_next: 7 });
  expect(renderHud(s, { model: "M", cost: 1, ctx: 23.5 })).toContain("ctx 24%");
});

test("max level shows full bar + MAX at 100%", () => {
  const s = state({ level: 50, xp_in_level: 1000, xp_to_next: 0 });
  expect(renderHud(s, { model: "M", cost: 0, ctx: 0 })).toBe(
    "Lv.50 ██████████ MAX 100%  |  M  $0.00  ·  ctx 0%");
});

test("shows the fire streak when current_days >= 1, hidden at 0", () => {
  const base = state({ level: 5, xp_in_level: 200, xp_to_next: 300 });
  const tail = { model: "M", cost: 0, ctx: 0 };
  const hot = { ...base, streak: { current_days: 5, best_days: 9, last_active: "2026-06-11" } };
  expect(renderHud(hot, tail)).toContain(" 🔥5d ");
  const cold = { ...base, streak: { current_days: 0, best_days: 9, last_active: "2026-06-01" } };
  expect(renderHud(cold, tail)).not.toContain("🔥");
});
