import { test, expect } from "bun:test";
import type { IProfile } from "../../core/profile";
import { ClassLine, SecretLine } from "../../core/classes";
import { chooseClass, respecClass, chooseBranch } from "../../core/advance";

const P = (over: Partial<IProfile> = {}): IProfile => ({ ...over });

test("chooseClass: main needs Lv.5; secret needs unlock; unknown rejected", () => {
  const low = P();
  expect(
    chooseClass({ profile: low, line: "mage", level: 4, unlockedSecrets: [] }).error,
  ).toContain("level 5");

  const ok = P();
  expect(
    chooseClass({ profile: ok, line: "mage", level: 5, unlockedSecrets: [] }).ok,
  ).toBe(true);
  expect(ok.line).toBe(ClassLine.Mage);

  expect(
    chooseClass({ profile: P(), line: "maestro", level: 60, unlockedSecrets: [] }).error,
  ).toContain("locked");
  const sec = P();
  expect(
    chooseClass({
      profile: sec,
      line: "maestro",
      level: 60,
      unlockedSecrets: ["maestro"],
    }).ok,
  ).toBe(true);
  expect(sec.line).toBe(SecretLine.Maestro);

  expect(
    chooseClass({ profile: P(), line: "wizard", level: 60, unlockedSecrets: [] }).error,
  ).toContain("Unknown");
});

test("respecClass: main or unlocked secret, any level; clears branch", () => {
  const p = P({ line: ClassLine.Mage, branch: "a" });
  expect(respecClass({ profile: p, line: "rogue", unlockedSecrets: [] }).ok).toBe(true);
  expect(p.line).toBe(ClassLine.Rogue);
  expect(p.branch).toBeUndefined();

  // Lv.50+ can respec now (the old gate is gone).
  const high = P({ line: ClassLine.Mage });
  expect(respecClass({ profile: high, line: "rogue", unlockedSecrets: [] }).ok).toBe(
    true,
  );

  // Respec into an unlocked secret; a locked one is rejected.
  const sec = P({ line: ClassLine.Mage });
  expect(
    respecClass({ profile: sec, line: "maestro", unlockedSecrets: ["maestro"] }).ok,
  ).toBe(true);
  expect(sec.line).toBe(SecretLine.Maestro);
  expect(
    respecClass({
      profile: P({ line: ClassLine.Mage }),
      line: "maestro",
      unlockedSecrets: [],
    }).error,
  ).toContain("locked");

  expect(
    respecClass({
      profile: P({ line: ClassLine.Mage }),
      line: "wizard",
      unlockedSecrets: [],
    }).error,
  ).toContain("Unknown");
});

test("chooseBranch: a|b, Lv.50, main, not locked", () => {
  expect(
    chooseBranch({ profile: P({ line: ClassLine.Mage }), branch: "c", level: 50 }).error,
  ).toContain("a");
  expect(chooseBranch({ profile: P(), branch: "a", level: 50 }).error).toContain(
    "class first",
  );
  expect(
    chooseBranch({ profile: P({ line: SecretLine.Maestro }), branch: "a", level: 50 })
      .error,
  ).toContain("Secret");
  expect(
    chooseBranch({ profile: P({ line: ClassLine.Mage }), branch: "a", level: 49 }).error,
  ).toContain("level 50");
  expect(
    chooseBranch({
      profile: P({ line: ClassLine.Mage, branch: "a" }),
      branch: "b",
      level: 50,
    }).error,
  ).toContain("locked");

  const p = P({ line: ClassLine.Mage });
  expect(chooseBranch({ profile: p, branch: "b", level: 50 }).ok).toBe(true);
  expect(p.branch).toBe("b");
});
