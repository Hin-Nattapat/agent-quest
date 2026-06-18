import { test, expect } from "bun:test";
import { AttackStyle } from "./combat";
import { EffectKind, effectKindFor } from "./use-scene-director";

test("effectKindFor maps style → VFX", () => {
  expect(effectKindFor(AttackStyle.Cast)).toBe(EffectKind.Zap);
  expect(effectKindFor(AttackStyle.Shoot)).toBe(EffectKind.Arrow);
  expect(effectKindFor(AttackStyle.Invoke)).toBe(EffectKind.Glyph);
  expect(effectKindFor(AttackStyle.Stab)).toBe(EffectKind.Slash);
  expect(effectKindFor(AttackStyle.Melee)).toBe(EffectKind.Slash);
});
