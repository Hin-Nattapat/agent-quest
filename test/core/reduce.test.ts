import { test, expect } from "bun:test";
import { reduce } from "../../core/reduce";
import { DEFAULT_WEIGHTS, DEFAULT_DIFFICULTY } from "../../core/xp";

const cfg = { weights: DEFAULT_WEIGHTS, difficulty: DEFAULT_DIFFICULTY };
const ev = (o: object) => ({ ts: "t", source: "claude-code", session_id: "s1", ...o }) as any;

test("reduce sums xp, counts stats, splits by source/repo", () => {
  const events = [
    ev({ session_id: "s1", type: "session_start", repo: "cq" }),
    ev({ session_id: "s1", type: "prompt", repo: "cq" }),                       // +5
    ev({ session_id: "s1", type: "action", action: "edit", repo: "cq" }),       // +4
    ev({ session_id: "s1", type: "action", action: "run", repo: "cq" }),        // +3
    ev({ session_id: "s1", type: "action_fail", action: "run", repo: "cq" }),   // +0
    ev({ session_id: "s2", type: "prompt", repo: "pos" }),                       // +5
    ev({ session_id: "s2", type: "session_end" }),                               // +20, no repo
  ];
  const s = reduce(events, cfg);
  expect(s.xp_total).toBe(37);
  expect(s.stats.prompts).toBe(2);
  expect(s.stats.actions).toEqual({ edit: 1, run: 1 });   // action_fail not counted
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
