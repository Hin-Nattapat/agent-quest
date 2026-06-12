import { test, expect } from "bun:test";
import { parseStateEvent, sseTransport } from "./transport";

const sample = {
  version: 1,
  xp_total: 100,
  level: 5,
  xp_in_level: 40,
  xp_to_next: 60,
  stats: { prompts: 0, actions: {}, sessions: 0, by_source: {}, by_repo: {} },
};

class FakeSource {
  listeners: Record<string, (e: { data: string }) => void> = {};
  closed = false;
  addEventListener(type: string, cb: (e: { data: string }) => void) {
    this.listeners[type] = cb;
  }
  close() {
    this.closed = true;
  }
  emit(type: string, data: string) {
    this.listeners[type]?.({ data });
  }
}

test("parseStateEvent parses valid state, returns null on garbage", () => {
  expect(parseStateEvent(JSON.stringify(sample))?.level).toBe(5);
  expect(parseStateEvent("{not json")).toBe(null);
});

test("sseTransport delivers parsed state and stops on unsubscribe", () => {
  const fake = new FakeSource();
  const transport = sseTransport("/events", () => fake as unknown as EventSource);
  const seen: number[] = [];
  const unsubscribe = transport.subscribe(s => seen.push(s.level));

  fake.emit("state", JSON.stringify(sample));
  fake.emit("state", JSON.stringify({ ...sample, level: 6 }));
  expect(seen).toEqual([5, 6]);

  unsubscribe();
  expect(fake.closed).toBe(true);
});
