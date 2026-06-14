import { test, expect } from "bun:test";
import {
  ClassLine,
  ClassForm,
  tierForLevel,
  formFor,
  iconFor,
  advancementPending,
  AdvancementKind,
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
  expect(formFor({ line: null, tier: 0, branch: null })).toBe(ClassForm.Novice);
  expect(formFor({ line: ClassLine.Mage, tier: 0, branch: null })).toBe(ClassForm.Novice);
  expect(formFor({ line: ClassLine.Mage, tier: 1, branch: null })).toBe(
    ClassForm.BackendMage,
  );
  expect(formFor({ line: ClassLine.Mage, tier: 3, branch: null })).toBe(
    ClassForm.InfraArchmage,
  );
  expect(formFor({ line: ClassLine.Mage, tier: 4, branch: null })).toBe(
    ClassForm.InfraArchmage,
  ); // no branch yet
  expect(formFor({ line: ClassLine.Mage, tier: 4, branch: "b" })).toBe(
    ClassForm.KernelLich,
  );
});

test("iconFor", () => {
  expect(iconFor(null)).toBe("");
  expect(iconFor(ClassLine.Ranger)).toBe("🏹");
});

test("advancementPending", () => {
  expect(advancementPending({ line: null, level: 6, branch: null })).toBe(
    AdvancementKind.Class,
  );
  expect(advancementPending({ line: ClassLine.Mage, level: 6, branch: null })).toBe(null);
  expect(advancementPending({ line: ClassLine.Mage, level: 50, branch: null })).toBe(
    AdvancementKind.Branch,
  );
  expect(advancementPending({ line: ClassLine.Mage, level: 50, branch: "a" })).toBe(null);
  expect(advancementPending({ line: null, level: 4, branch: null })).toBe(null);
});

import { SecretLine, isSecret, SECRET_TREE, classTree } from "../../core/classes";

test("secret lines resolve four branchless forms; Novice at tier 0", () => {
  expect(isSecret(SecretLine.Maestro)).toBe(true);
  expect(isSecret(ClassLine.Mage)).toBe(false);
  expect(formFor({ line: SecretLine.Maestro, tier: 0, branch: null })).toBe(
    ClassForm.Novice,
  );
  expect(formFor({ line: SecretLine.Maestro, tier: 1, branch: null })).toBe(
    ClassForm.Conductor,
  );
  expect(formFor({ line: SecretLine.Maestro, tier: 4, branch: null })).toBe(
    ClassForm.GrandSymphony,
  );
  expect(formFor({ line: SecretLine.NightOwl, tier: 4, branch: "a" })).toBe(
    ClassForm.Eclipse,
  ); // branch ignored
  expect(iconFor(SecretLine.Gremlin)).toBe(SECRET_TREE[SecretLine.Gremlin].icon);
});

test("a secret line never pends a branch, even at level 50", () => {
  expect(advancementPending({ line: SecretLine.Maestro, level: 50, branch: null })).toBe(
    null,
  );
  expect(advancementPending({ line: ClassLine.Mage, level: 50, branch: null })).toBe(
    "branch",
  ); // main unchanged
});

test("classTree gives 3 forms + branches for a main line, 4 + none for secret, undefined for null", () => {
  const mage = classTree(ClassLine.Mage);
  expect(mage?.forms.length).toBe(3);
  expect(mage?.branches?.a).toBe("Cloud Summoner");
  expect(mage?.branches?.b).toBe("Kernel Lich");

  const trick = classTree(SecretLine.Trickster);
  expect(trick?.forms.length).toBe(4);
  expect(trick?.branches).toBeUndefined();

  expect(classTree(null)).toBeUndefined();
});
