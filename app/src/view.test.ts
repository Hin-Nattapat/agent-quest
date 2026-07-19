import { test, expect } from "bun:test";
import {
  xpPercent,
  displayName,
  formatTimeline,
  passiveMultiplier,
  TimelineTone,
  cmdLabel,
  byCountDesc,
  sourceBreakdown,
  groupInventory,
} from "./view";
import { TimelineKind } from "../../core/events";
import type { IState } from "../../core/state";

const asState = (o: object): IState => o as unknown as IState;

const base = {
  version: 1,
  xp_total: 0,
  level: 1,
  xp_in_level: 0,
  xp_to_next: 100,
  stats: { prompts: 0, actions: {}, sessions: 0, by_source: {}, by_repo: {} },
} as unknown as IState;

test("xpPercent: 0, mid, and MAX at cap", () => {
  expect(xpPercent(base)).toBe(0);
  expect(xpPercent({ ...base, xp_in_level: 40, xp_to_next: 60 })).toBe(40);
  expect(xpPercent({ ...base, xp_in_level: 1000, xp_to_next: 0 })).toBe(100);
});

test("displayName falls back to Adventurer", () => {
  expect(displayName(base)).toBe("Adventurer");
  expect(displayName({ ...base, name: "Calypso" })).toBe("Calypso");
});

test("formatTimeline maps each kind to label/tag/tone", () => {
  expect(formatTimeline({ kind: TimelineKind.LevelUp, detail: "21", ts: "t" })).toEqual({
    label: "Level up! → 21",
    tag: "LVL",
    tone: TimelineTone.Gold,
  });
  expect(
    formatTimeline({
      kind: TimelineKind.Loot,
      detail: "Arcane Staff",
      rarity: "rare",
      ts: "t",
    }),
  ).toEqual({ label: "Loot: Arcane Staff", tag: "RARE", tone: TimelineTone.Rare });
  expect(formatTimeline({ kind: TimelineKind.BossFled, detail: "", ts: "t" }).tag).toBe(
    "FLED",
  );
  expect(
    formatTimeline({ kind: TimelineKind.Advance, detail: "Infra Archmage", ts: "t" }),
  ).toEqual({
    label: "Became Infra Archmage",
    tag: "CLASS",
    tone: TimelineTone.Teal,
  });
});

test("passiveMultiplier = 1 + base_passive_pct, one decimal", () => {
  expect(passiveMultiplier(asState({ class: { base_passive_pct: 0.3 } }))).toBe("1.3");
  expect(passiveMultiplier(asState({}))).toBe("1.0");
});

test("cmdLabel maps known CmdTags and Title-Cases unknown ones", () => {
  expect(cmdLabel("force_push")).toBe("Force Pushes");
  expect(cmdLabel("test_run")).toBe("Test Runs");
  expect(cmdLabel("cherry_pick")).toBe("Cherry-Picks");
  expect(cmdLabel("foo_bar")).toBe("Foo Bar"); // unknown → Title Case
});

test("byCountDesc sorts entries by value descending", () => {
  expect(byCountDesc({ a: 1, b: 3, c: 2 })).toEqual([
    ["b", 3],
    ["c", 2],
    ["a", 1],
  ]);
  expect(byCountDesc({})).toEqual([]);
});

test("sourceBreakdown: shares sorted desc by xp, integer pct, 0 when no xp", () => {
  expect(sourceBreakdown({})).toEqual([]);
  expect(
    sourceBreakdown({
      "claude-code": { xp: 30, sessions: 1 },
      codex: { xp: 70, sessions: 2 },
    }),
  ).toEqual([
    { source: "codex", xp: 70, pct: 70 },
    { source: "claude-code", xp: 30, pct: 30 },
  ]);
  expect(
    sourceBreakdown({ b: { xp: 0, sessions: 0 }, a: { xp: 0, sessions: 0 } }),
  ).toEqual([
    { source: "a", xp: 0, pct: 0 },
    { source: "b", xp: 0, pct: 0 },
  ]);
});

test("groupInventory buckets by kind, equipped first, then rarity descending", () => {
  const inv = [
    { id: "azure", rarity: "rare", count: 1, name: "Azure", kind: "name_color" },
    { id: "rookie_title", rarity: "common", count: 1, name: "Rookie", kind: "title" },
    {
      id: "forest_theme",
      rarity: "common",
      count: 1,
      name: "Forest",
      kind: "theme",
      equipped: true,
    },
    { id: "matrix", rarity: "epic", count: 1, name: "Matrix", kind: "theme" },
    { id: "plasma_ink", rarity: "legendary", count: 1, name: "Plasma", kind: "theme" },
    {
      id: "sir_quacks",
      rarity: "legendary",
      count: 1,
      name: "Sir Quacks-a-lot",
      kind: "companion",
    },
  ] as any;
  const groups = groupInventory(inv);
  expect(groups.map(g => g.kind)).toEqual(["title", "theme", "name_color", "companion"]);
  expect(groups[0].label).toBe("Titles");
  // equipped common floats above unequipped legendary; the rest sort legendary -> epic.
  expect(groups[1].items.map(i => i.id)).toEqual([
    "forest_theme",
    "plasma_ink",
    "matrix",
  ]);
});

test("groupInventory hides empty kinds and folds unknown kinds into Other", () => {
  const groups = groupInventory([
    { id: "x", rarity: "common", count: 1, kind: "mystery" },
  ] as any);
  expect(groups.length).toBe(1);
  expect(groups[0].label).toBe("Other");
  expect(groups[0].icon).toBe("❔");
});
