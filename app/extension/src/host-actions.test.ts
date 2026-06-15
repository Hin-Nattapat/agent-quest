import { test, expect } from "bun:test";
import { mkdirSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";
import { makeHome } from "../../../test/helpers";
import { rollDrop, LOOT_TABLE, LootKind } from "../../../core/loot";
import { applyAction } from "./host-actions";

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
          actions: { edit: 0, write: 0, run: 0, read: 0, search: 0, delegate: 0, other: 0 },
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

const profile = (home: string) => JSON.parse(readFileSync(join(home, "profile.json"), "utf8"));

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
