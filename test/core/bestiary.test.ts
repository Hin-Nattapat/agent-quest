import { test, expect } from "bun:test";
import {
  realmFor,
  createBestiaryScan,
  recordBestiaryEvent,
  buildBestiary,
  CONQUEST_THRESHOLDS,
  REALM_LABELS,
  REALM_TOTAL,
} from "../../core/bestiary";
import { ClassLine, SecretLine } from "../../core/classes";

test("realmFor maps tiers and lines to the 16 realm themes", () => {
  expect(realmFor({ line: ClassLine.Mage, tier: 0, branch: null })).toBeNull();
  expect(realmFor({ line: null, tier: 3, branch: null })).toBeNull();
  expect(realmFor({ line: ClassLine.Mage, tier: 1, branch: null })).toBe("grassland");
  expect(realmFor({ line: ClassLine.Rogue, tier: 2, branch: "a" })).toBe("forest");
  expect(realmFor({ line: ClassLine.Sage, tier: 3, branch: "b" })).toBe("dungeon");
  expect(realmFor({ line: ClassLine.Mage, tier: 4, branch: "a" })).toBe(
    "skyforge_aether",
  );
  expect(realmFor({ line: ClassLine.Mage, tier: 4, branch: "b" })).toBe(
    "circuit_catacombs",
  );
  expect(realmFor({ line: ClassLine.Ranger, tier: 4, branch: "a" })).toBe("aurora_flux");
  expect(realmFor({ line: ClassLine.Ranger, tier: 4, branch: "b" })).toBe(
    "geometric_sanctum",
  );
  expect(realmFor({ line: ClassLine.Rogue, tier: 4, branch: "a" })).toBe("quantum_rift");
  expect(realmFor({ line: ClassLine.Rogue, tier: 4, branch: "b" })).toBe(
    "noir_crime_scene",
  );
  expect(realmFor({ line: ClassLine.Sage, tier: 4, branch: "a" })).toBe(
    "oracles_athenaeum",
  );
  expect(realmFor({ line: ClassLine.Sage, tier: 4, branch: "b" })).toBe(
    "conductors_nexus",
  );
  expect(realmFor({ line: ClassLine.Mage, tier: 4, branch: null })).toBeNull(); // pre-branch: no realm yet
  expect(realmFor({ line: SecretLine.Trickster, tier: 4, branch: null })).toBe(
    "fools_mirage",
  );
  expect(realmFor({ line: SecretLine.Ascetic, tier: 4, branch: null })).toBe(
    "silent_summit",
  );
  expect(realmFor({ line: SecretLine.Maestro, tier: 4, branch: null })).toBe(
    "grand_concert_vault",
  );
  expect(realmFor({ line: SecretLine.NightOwl, tier: 4, branch: null })).toBe(
    "midnight_roost",
  );
  expect(realmFor({ line: SecretLine.Gremlin, tier: 4, branch: null })).toBe(
    "glitch_pit",
  );
});

test("REALM_LABELS and CONQUEST_THRESHOLDS cover exactly the 16 realms", () => {
  expect(Object.keys(REALM_LABELS).length).toBe(REALM_TOTAL);
  expect(Object.keys(CONQUEST_THRESHOLDS).sort()).toEqual(
    Object.keys(REALM_LABELS).sort(),
  );
  expect(CONQUEST_THRESHOLDS["grassland"]).toEqual({ encounters: 50, bosses: 1 });
  expect(CONQUEST_THRESHOLDS["fools_mirage"]).toEqual({ encounters: 300, bosses: 5 });
});

test("recordBestiaryEvent counts discovery, action encounters, and boss outcomes per realm", () => {
  const scan = createBestiaryScan();
  recordBestiaryEvent({
    scan,
    realm: null,
    isAction: true,
    bossDefeated: 0,
    bossFled: 0,
  });
  expect(Object.keys(scan.realms).length).toBe(0); // no realm -> nothing recorded

  recordBestiaryEvent({
    scan,
    realm: "grassland",
    isAction: false,
    bossDefeated: 0,
    bossFled: 0,
  });
  expect(scan.realms["grassland"].discovered).toBe(true);
  expect(scan.realms["grassland"].encounters).toBe(0); // non-action discovers but doesn't fight

  recordBestiaryEvent({
    scan,
    realm: "grassland",
    isAction: true,
    bossDefeated: 1,
    bossFled: 0,
  });
  recordBestiaryEvent({
    scan,
    realm: "grassland",
    isAction: true,
    bossDefeated: 0,
    bossFled: 1,
  });
  expect(scan.realms["grassland"].encounters).toBe(2);
  expect(scan.realms["grassland"].boss_defeated).toBe(1);
  expect(scan.realms["grassland"].boss_fled).toBe(1);
});

test("conquest fires when BOTH thresholds are met, in crossing order", () => {
  const scan = createBestiaryScan();
  // grassland: 50 encounters + 1 boss. 49 actions -> not conquered even with a boss.
  for (let i = 0; i < 49; i++) {
    recordBestiaryEvent({
      scan,
      realm: "grassland",
      isAction: true,
      bossDefeated: i === 0 ? 1 : 0,
      bossFled: 0,
    });
  }
  expect(scan.conqueredOrder).toEqual([]);
  recordBestiaryEvent({
    scan,
    realm: "grassland",
    isAction: true,
    bossDefeated: 0,
    bossFled: 0,
  });
  expect(scan.conqueredOrder).toEqual(["grassland"]);
  // Crossing again never duplicates.
  recordBestiaryEvent({
    scan,
    realm: "grassland",
    isAction: true,
    bossDefeated: 1,
    bossFled: 0,
  });
  expect(scan.conqueredOrder).toEqual(["grassland"]);

  const built = buildBestiary(scan);
  expect(built.realms["grassland"].conquered).toBe(true);
  expect(built.conquered).toEqual(["grassland"]);
  expect(built.total).toBe(16);
});
