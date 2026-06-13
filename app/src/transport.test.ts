import { test, expect } from "bun:test";
import {
  parseStateEvent,
  sseTransport,
  postMessageTransport,
  selectTransport,
  type IMessageTarget,
} from "./transport";

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

class FakeTarget {
  handler: ((e: { data: unknown }) => void) | null = null;
  addEventListener(_type: "message", cb: (e: { data: unknown }) => void) {
    this.handler = cb;
  }
  removeEventListener(_type: "message", _cb: (e: { data: unknown }) => void) {
    this.handler = null;
  }
  emit(data: unknown) {
    this.handler?.({ data });
  }
}

test("postMessageTransport delivers state, posts ready, ignores non-state, unsubscribes", () => {
  const fake = new FakeTarget();
  const posted: unknown[] = [];
  const api = { postMessage: (m: unknown) => posted.push(m) };
  const transport = postMessageTransport(api, fake as unknown as IMessageTarget);

  const seen: number[] = [];
  const unsubscribe = transport.subscribe(s => seen.push(s.level));

  expect(posted).toEqual([{ type: "ready" }]);
  fake.emit({ type: "state", json: JSON.stringify(sample) });
  fake.emit({ type: "other" }); // ignored
  fake.emit({ type: "state", json: "{bad" }); // malformed -> last good kept
  expect(seen).toEqual([5]);

  unsubscribe();
  expect(fake.handler).toBe(null);
});

test("selectTransport picks postMessage when acquireVsCodeApi exists", () => {
  const posted: unknown[] = [];
  const fakeWin = {
    acquireVsCodeApi: () => ({ postMessage: (m: unknown) => posted.push(m) }),
    addEventListener() {},
    removeEventListener() {},
  };
  const transport = selectTransport(
    fakeWin as unknown as Parameters<typeof selectTransport>[0],
  );
  transport.subscribe(() => {});
  expect(posted).toEqual([{ type: "ready" }]); // proves the postMessage branch was chosen
});
