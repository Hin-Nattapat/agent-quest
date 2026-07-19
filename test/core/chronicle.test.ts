import { test, expect } from "bun:test";
import {
  weekKeyFor,
  weekStartFor,
  createChronicleScan,
  recordChronicleEvent,
  buildChronicle,
  CHRONICLE_MAX_WEEKS,
} from "../../core/chronicle";
import { EventType } from "../../core/events";

test("weekKeyFor implements true ISO weeks including year boundaries", () => {
  expect(weekKeyFor("2026-07-15")).toBe("2026-W29"); // a Wednesday
  expect(weekKeyFor("2026-07-13")).toBe("2026-W29"); // that Monday
  expect(weekKeyFor("2026-07-19")).toBe("2026-W29"); // that Sunday
  expect(weekKeyFor("2026-01-01")).toBe("2026-W01"); // Thu -> W1 of 2026
  expect(weekKeyFor("2027-01-01")).toBe("2026-W53"); // Fri -> belongs to 2026's W53
  expect(weekKeyFor("2024-12-30")).toBe("2025-W01"); // Mon -> next year's W1
  expect(weekStartFor("2026-07-15")).toBe("2026-07-13");
  expect(weekStartFor("2026-07-13")).toBe("2026-07-13");
});

const act = (over: Partial<Parameters<typeof recordChronicleEvent>[0]>) => ({
  dateKey: "2026-07-15",
  gained: 1,
  eventType: EventType.Action,
  sessionId: "s",
  realm: "dungeon" as string | null,
  bossDefeated: 0,
  bossFled: 0,
  levelBefore: 10,
  newLevel: 10,
  ...over,
});

test("recordChronicleEvent buckets stats per ISO week", () => {
  const scan = createChronicleScan();
  recordChronicleEvent({
    scan,
    ...act({ dateKey: "2026-07-13", levelBefore: 9, newLevel: 10 }),
  });
  recordChronicleEvent({
    scan,
    ...act({ dateKey: "2026-07-15", gained: 5, bossDefeated: 1 }),
  });
  recordChronicleEvent({
    scan,
    ...act({
      dateKey: "2026-07-15",
      eventType: EventType.Prompt,
      gained: 5,
      sessionId: "s2",
    }),
  });
  recordChronicleEvent({ scan, ...act({ dateKey: "2026-07-20", newLevel: 11 }) }); // next week
  const { weeks } = buildChronicle(scan);
  expect(weeks.length).toBe(2);
  expect(weeks[0].week).toBe("2026-W30"); // newest first
  expect(weeks[1]).toEqual({
    week: "2026-W29",
    start: "2026-07-13",
    xp: 11,
    actions: 2,
    prompts: 1,
    sessions: 2,
    bosses_defeated: 1,
    bosses_fled: 0,
    top_realm: "dungeon",
    active_days: 2,
    busiest_day: { date: "2026-07-15", xp: 10 },
    level_start: 9,
    level_end: 10,
  });
});

test("top_realm ties resolve to the first realm seen", () => {
  const scan = createChronicleScan();
  recordChronicleEvent({ scan, ...act({ realm: "grassland" }) });
  recordChronicleEvent({ scan, ...act({ realm: "forest" }) });
  expect(buildChronicle(scan).weeks[0].top_realm).toBe("grassland");
});

test("busiest_day is null for a zero-xp week and realmless weeks have null top_realm", () => {
  const scan = createChronicleScan();
  recordChronicleEvent({
    scan,
    ...act({ gained: 0, eventType: EventType.SessionStart, realm: null }),
  });
  const w = buildChronicle(scan).weeks[0];
  expect(w.busiest_day).toBeNull();
  expect(w.top_realm).toBeNull();
  expect(w.active_days).toBe(1);
});

test("the chronicle keeps only the newest 12 weeks", () => {
  const scan = createChronicleScan();
  for (let i = 0; i < 15; i++) {
    const day = new Date(Date.UTC(2026, 0, 5 + i * 7)); // successive Mondays
    recordChronicleEvent({ scan, ...act({ dateKey: day.toISOString().slice(0, 10) }) });
  }
  const { weeks } = buildChronicle(scan);
  expect(weeks.length).toBe(CHRONICLE_MAX_WEEKS);
  expect(weeks[0].start > weeks[11].start).toBe(true); // newest first
});

test("malformed date keys are skipped rather than bucketed", () => {
  const scan = createChronicleScan();
  recordChronicleEvent({ scan, ...act({ dateKey: "NaN-NaN-NaN" }) });
  recordChronicleEvent({ scan, ...act({ dateKey: "t" }) });
  expect(buildChronicle(scan).weeks).toEqual([]);
});
