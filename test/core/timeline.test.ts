import { test, expect } from "bun:test";
import {
  pushTimeline,
  TimelineKind,
  TIMELINE_MAX,
  type ITimelineEntry,
} from "../../core/timeline";

const mk = (n: number): ITimelineEntry => ({
  kind: TimelineKind.LevelUp,
  detail: String(n),
  ts: "t",
});

test("pushTimeline appends, keeps newest last, caps at TIMELINE_MAX", () => {
  let list: ITimelineEntry[] = [];
  for (let i = 1; i <= TIMELINE_MAX + 3; i++) {
    list = pushTimeline(list, mk(i));
  }
  expect(list.length).toBe(TIMELINE_MAX);
  expect(list[list.length - 1].detail).toBe(String(TIMELINE_MAX + 3));
  expect(list[0].detail).toBe(String(4)); // first 3 dropped
});
