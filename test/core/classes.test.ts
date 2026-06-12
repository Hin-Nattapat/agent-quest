import { test, expect } from "bun:test";
import {
  ClassLine,
  ClassForm,
  tierForLevel,
  formFor,
  iconFor,
  advancementPending,
} from "../../core/classes";

test("tierForLevel boundaries", () => {
  expect(tierForLevel(4)).toBe(0);
  expect(tierForLevel(5)).toBe(1);
  expect(tierForLevel(14)).toBe(1);
  expect(tierForLevel(15)).toBe(2);
  expect(tierForLevel(30)).toBe(3);
  expect(tierForLevel(50)).toBe(4);
});

test("formFor across tiers and branches", () => {
  expect(formFor(null, 0, null)).toBe(ClassForm.Novice);
  expect(formFor(ClassLine.Mage, 0, null)).toBe(ClassForm.Novice);
  expect(formFor(ClassLine.Mage, 1, null)).toBe(ClassForm.BackendMage);
  expect(formFor(ClassLine.Mage, 3, null)).toBe(ClassForm.InfraArchmage);
  expect(formFor(ClassLine.Mage, 4, null)).toBe(ClassForm.InfraArchmage); // no branch yet
  expect(formFor(ClassLine.Mage, 4, "b")).toBe(ClassForm.KernelLich);
});

test("iconFor", () => {
  expect(iconFor(null)).toBe("");
  expect(iconFor(ClassLine.Ranger)).toBe("🏹");
});

test("advancementPending", () => {
  expect(advancementPending(null, 6, null)).toBe("class");
  expect(advancementPending(ClassLine.Mage, 6, null)).toBe(null);
  expect(advancementPending(ClassLine.Mage, 50, null)).toBe("branch");
  expect(advancementPending(ClassLine.Mage, 50, "a")).toBe(null);
  expect(advancementPending(null, 4, null)).toBe(null);
});

import { SecretLine, isSecret, SECRET_TREE } from "../../core/classes";

test("secret lines resolve four branchless forms; Novice at tier 0", () => {
  expect(isSecret(SecretLine.Maestro)).toBe(true);
  expect(isSecret(ClassLine.Mage)).toBe(false);
  expect(formFor(SecretLine.Maestro, 0, null)).toBe(ClassForm.Novice);
  expect(formFor(SecretLine.Maestro, 1, null)).toBe(ClassForm.Conductor);
  expect(formFor(SecretLine.Maestro, 4, null)).toBe(ClassForm.GrandSymphony);
  expect(formFor(SecretLine.NightOwl, 4, "a")).toBe(ClassForm.Eclipse); // branch ignored
  expect(iconFor(SecretLine.Gremlin)).toBe(SECRET_TREE[SecretLine.Gremlin].icon);
});

test("a secret line never pends a branch, even at level 50", () => {
  expect(advancementPending(SecretLine.Maestro, 50, null)).toBe(null);
  expect(advancementPending(ClassLine.Mage, 50, null)).toBe("branch"); // main unchanged
});
