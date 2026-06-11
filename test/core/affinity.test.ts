import { test, expect } from "bun:test";
import { computeAffinity } from "../../core/affinity";

const ev = (o: object) =>
  ({ ts: "t", source: "claude-code", session_id: "s", ...o }) as any;

test("affinity is the normalized proportion per line", () => {
  const a = computeAffinity([
    ev({ type: "action", action: "run" }), // mage
    ev({ type: "action", action: "edit", file: "a.tsx" }), // ranger
    ev({ type: "action", action: "read" }), // rogue
    ev({ type: "action_fail", action: "run" }), // rogue (failure)
    ev({ type: "action", action: "delegate" }), // sage
    ev({ type: "prompt" }), // no signal
  ]);
  expect(a.mage).toBeCloseTo(0.2);
  expect(a.ranger).toBeCloseTo(0.2);
  expect(a.rogue).toBeCloseTo(0.4);
  expect(a.sage).toBeCloseTo(0.2);
});

test("no signals -> all zero", () => {
  expect(computeAffinity([ev({ type: "prompt" })])).toEqual({
    mage: 0,
    ranger: 0,
    rogue: 0,
    sage: 0,
  });
});

test("file extensions route edits to the right line", () => {
  const a = computeAffinity([
    ev({ type: "action", action: "edit", file: "schema.sql" }), // mage
    ev({ type: "action", action: "write", file: "notes.md" }), // sage
  ]);
  expect(a.mage).toBeCloseTo(0.5);
  expect(a.sage).toBeCloseTo(0.5);
});

import { lineForEvent } from "../../core/affinity";
import { ClassLine } from "../../core/classes";

test("lineForEvent maps an event to its line (or null)", () => {
  expect(lineForEvent(ev({ type: "action", action: "run" }))).toBe(ClassLine.Mage);
  expect(lineForEvent(ev({ type: "action", action: "edit", file: "a.tsx" }))).toBe(
    ClassLine.Ranger,
  );
  expect(lineForEvent(ev({ type: "prompt" }))).toBe(null);
});
