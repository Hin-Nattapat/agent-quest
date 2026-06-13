import { test, expect } from "bun:test";
import { xpPercent, displayName, classLabel, titleSuffix, streakText } from "./view";
import { formatTimeline, passiveMultiplier, areaLabel } from "./view";
import { TimelineKind } from "../../core/timeline";
import type { IState } from "../../core/state";

const asState = (o: object): IState => o as unknown as IState;

const base = {
  version: 1,
  xp_total: 0,
  level: 1,
  xp_in_level: 0,
  xp_to_next: 100,
  stats: { prompts: 0, actions: {}, sessions: 0, by_source: {}, by_repo: {} },
} as any;

test("xpPercent: 0, mid, and MAX at cap", () => {
  expect(xpPercent(base)).toBe(0);
  expect(xpPercent({ ...base, xp_in_level: 40, xp_to_next: 60 })).toBe(40);
  expect(xpPercent({ ...base, xp_in_level: 1000, xp_to_next: 0 })).toBe(100);
});

test("name / class / title / streak text", () => {
  expect(displayName(base)).toBe("Adventurer");
  expect(displayName({ ...base, name: "Calypso" })).toBe("Calypso");
  expect(classLabel(base)).toBe("Novice");
  expect(
    classLabel({ ...base, class: { line: "mage", icon: "⚔", form: "Server Sorcerer" } }),
  ).toBe("⚔ Server Sorcerer");
  expect(titleSuffix(base)).toBe("");
  expect(
    titleSuffix({ ...base, cosmetics: { title: "Undying", theme_color: null } }),
  ).toBe(" the Undying");
  expect(streakText(base)).toBe("");
  expect(
    streakText({ ...base, streak: { current_days: 3, best_days: 3, last_active: "" } }),
  ).toBe("🔥 3d");
});

test("formatTimeline maps each kind to label/tag/tone", () => {
  expect(formatTimeline({ kind: TimelineKind.LevelUp, detail: "21", ts: "t" })).toEqual({
    label: "Level up! → 21",
    tag: "LVL",
    tone: "gold",
  });
  expect(
    formatTimeline({
      kind: TimelineKind.Loot,
      detail: "Arcane Staff",
      rarity: "rare",
      ts: "t",
    }),
  ).toEqual({ label: "Loot: Arcane Staff", tag: "RARE", tone: "rare" });
  expect(formatTimeline({ kind: TimelineKind.BossFled, detail: "", ts: "t" }).tag).toBe(
    "FLED",
  );
  expect(
    formatTimeline({ kind: TimelineKind.Advance, detail: "Infra Archmage", ts: "t" }),
  ).toEqual({
    label: "Became Infra Archmage",
    tag: "CLASS",
    tone: "teal",
  });
});

test("passiveMultiplier = 1 + base_passive_pct, one decimal", () => {
  expect(passiveMultiplier(asState({ class: { base_passive_pct: 0.3 } }))).toBe("1.3");
  expect(passiveMultiplier(asState({}))).toBe("1.0");
});

test("areaLabel comes from the tier scene", () => {
  expect(areaLabel(asState({ class: { tier: 1 } }))).toBe("Grassland outside town");
});
