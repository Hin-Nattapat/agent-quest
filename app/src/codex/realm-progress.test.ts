import { test, expect } from "bun:test";
import { realmRows, REALM_UI } from "./realm-progress";

test("realmRows orders known realms first and folds undiscovered into a count", () => {
  const rows = realmRows({
    realms: {
      grassland: {
        discovered: true,
        encounters: 60,
        boss_defeated: 2,
        boss_fled: 0,
        conquered: true,
      },
      dungeon: {
        discovered: true,
        encounters: 10,
        boss_defeated: 0,
        boss_fled: 1,
        conquered: false,
      },
    },
    conquered: ["grassland"],
    total: 16,
  });
  expect(rows.discovered.length).toBe(2);
  expect(rows.discovered[0].theme).toBe("grassland");
  expect(rows.discovered[0].conquered).toBe(true);
  expect(rows.undiscovered).toBe(14);
});

test("REALM_UI carries all 16 realms", () => {
  expect(REALM_UI.length).toBe(16);
});
