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
