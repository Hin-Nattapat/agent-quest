import { test, expect } from "bun:test";
import { paragonBar } from "./paragon-view";

test("paragonBar activates only at the cap with a paragon slice", () => {
  expect(paragonBar(120, undefined)).toBeNull();
  expect(
    paragonBar(120, { level: 3, xp_in_paragon: 0, xp_to_next: 10, auras: [] }),
  ).toBeNull();
  const bar = paragonBar(0, { level: 7, xp_in_paragon: 300, xp_to_next: 700, auras: [] });
  expect(bar).toEqual({ pct: 30, label: "300 / 1000", badge: "✦P7" });
});
