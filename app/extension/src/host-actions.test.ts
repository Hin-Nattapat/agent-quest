import { test, expect } from "bun:test";
import { mkdirSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";
import { makeHome } from "../../../test/helpers";
import { rollDrop, LOOT_TABLE, LootKind } from "../../../core/loot";
import { applyAction } from "./host-actions";
import { reduceToFile } from "../../../core/reduce";
import { loadProfile } from "../../../core/profile";

// Zero-weight config so a single session_end is the only trigger: one deterministic clean drop.
function seedOneClean(home: string) {
  writeFileSync(
    join(home, "config.json"),
    JSON.stringify({
      xp: {
        weights: {
          prompt: 0,
          turn_end: 0,
          session_end: 0,
          actions: {
            edit: 0,
            write: 0,
            run: 0,
            read: 0,
            search: 0,
            delegate: 0,
            other: 0,
          },
        },
      },
    }),
  );
  const dir = join(home, "journal");
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "s.ndjson"),
    `{"ts":"2026-06-11T12:00:00Z","source":"claude-code","session_id":"s","type":"session_end","repo":"cq"}\n`,
  );
}

const profile = (home: string) =>
  JSON.parse(readFileSync(join(home, "profile.json"), "utf8"));

test("applyAction equips an owned title/theme, then toggles it off; rejects unowned", () => {
  const home = makeHome();
  seedOneClean(home);
  const droppedId = rollDrop({ trigger: { table: "clean", seed: "clean:s" } })!;
  const kind = LOOT_TABLE[droppedId].kind;

  if (kind === LootKind.Title || kind === LootKind.Theme) {
    const slot = kind === LootKind.Title ? "title" : "theme";

    const s1 = applyAction(home, { name: "equip", kind, id: droppedId });
    expect(s1).not.toBeNull();
    expect(profile(home)[slot]).toBe(droppedId);

    const s2 = applyAction(home, { name: "equip", kind, id: droppedId });
    expect(s2).not.toBeNull();
    expect(profile(home)[slot]).toBeUndefined();
  }

  const unowned = Object.keys(LOOT_TABLE).find(
    id => id !== droppedId && LOOT_TABLE[id].kind === LootKind.Theme,
  )!;
  const before = profile(home);
  const bad = applyAction(home, { name: "equip", kind: "theme", id: unowned });
  expect(bad).toBeNull();
  expect(profile(home)).toEqual(before);
});

test("applyAction equips an owned name-color, then toggles it off", () => {
  const home = makeHome();
  const dir = join(home, "journal");
  mkdirSync(dir, { recursive: true });
  // many clean drops (one per session_end) so the inventory includes a name-color ink
  const lines = Array.from(
    { length: 50 },
    (_, i) =>
      `{"ts":"2026-06-11T12:00:00Z","source":"claude-code","session_id":"s${i}","type":"session_end","repo":"cq"}`,
  );
  writeFileSync(join(dir, "s.ndjson"), lines.join("\n") + "\n");

  const ink = (reduceToFile(home).inventory ?? []).find(
    i => LOOT_TABLE[i.id]?.kind === LootKind.NameColor,
  );
  expect(ink).toBeTruthy();

  const s1 = applyAction(home, { name: "equip", kind: "name_color", id: ink!.id });
  expect(s1).not.toBeNull();
  expect(profile(home).name_color).toBe(ink!.id);
  // the reduced state must mark it equipped, so the Items card shows "Equipped"
  expect(reduceToFile(home).inventory!.find(i => i.id === ink!.id)!.equipped).toBe(true);

  const s2 = applyAction(home, { name: "equip", kind: "name_color", id: ink!.id });
  expect(s2).not.toBeNull();
  expect(profile(home).name_color).toBeUndefined();
  expect(reduceToFile(home).inventory!.find(i => i.id === ink!.id)!.equipped).toBe(false);
});

// A journal that reaches a target level via prompt xp (default config weights).
function seedPrompts(home: string, n: number) {
  const dir = join(home, "journal");
  mkdirSync(dir, { recursive: true });
  const line = `{"ts":"2026-06-11T12:00:00Z","source":"claude-code","session_id":"s","type":"prompt","repo":"cq"}`;
  writeFileSync(join(dir, "s.ndjson"), Array(n).fill(line).join("\n") + "\n");
}

test("applyAction setClass picks a class, then respec changes it (below Lv.50)", () => {
  const home = makeHome();
  seedPrompts(home, 60);
  expect(reduceToFile(home).level).toBeGreaterThanOrEqual(5);

  const s1 = applyAction(home, { name: "setClass", line: "mage" });
  expect(s1).not.toBeNull();
  expect(JSON.parse(readFileSync(join(home, "profile.json"), "utf8")).line).toBe("mage");

  const s2 = applyAction(home, { name: "setClass", line: "rogue" });
  expect(s2).not.toBeNull();
  expect(JSON.parse(readFileSync(join(home, "profile.json"), "utf8")).line).toBe("rogue");

  const bad = applyAction(home, { name: "setClass", line: "wizard" });
  expect(bad).toBeNull();
});

test("applyAction setBranch rejects below Lv.50", () => {
  const home = makeHome();
  seedPrompts(home, 60);
  applyAction(home, { name: "setClass", line: "mage" });
  const r = applyAction(home, { name: "setBranch", branch: "a" });
  expect(r).toBeNull();
});

test("setName trims, caps at 24, and persists to the profile", () => {
  const home = makeHome();
  const out = applyAction(home, {
    name: "setName",
    value: "  Gandalf the Grey the White  ",
  });
  expect(out).not.toBeNull();
  expect(loadProfile(home).name).toBe("Gandalf the Grey the Whi"); // trimmed + 24-char cap
});

test("setName rejects an empty/whitespace value and leaves the profile unchanged", () => {
  const home = makeHome();
  const before = loadProfile(home).name;
  expect(applyAction(home, { name: "setName", value: "   " })).toBeNull();
  expect(loadProfile(home).name).toBe(before);
});
