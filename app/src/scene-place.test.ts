import { test, expect } from "bun:test";
import { EventType } from "../../core/events";
import { ActivityState } from "./activity";
import { SceneTheme } from "./scene";
import { ScenePlace, placeFor, sceneNow } from "./scene-place";

const ev = (type: EventType) => ({
  ts: "2026-06-14T00:00:00.000Z",
  type,
  source: "claude-code",
});

test("placeFor: guild on rest or a fresh session_start, else field", () => {
  expect(placeFor(ActivityState.Rest, ev(EventType.SessionEnd))).toBe(ScenePlace.Guild);
  expect(placeFor(ActivityState.Idle, ev(EventType.SessionStart))).toBe(ScenePlace.Guild);
  expect(placeFor(ActivityState.Idle, ev(EventType.Prompt))).toBe(ScenePlace.Field);
  expect(placeFor(ActivityState.Farming, ev(EventType.Prompt))).toBe(ScenePlace.Field);
  expect(placeFor(ActivityState.Idle, undefined)).toBe(ScenePlace.Field);
});

test("sceneNow: guild place → GUILD_SCENE; field place → sceneFor", () => {
  const guild = sceneNow({
    activity: ActivityState.Rest,
    lastEvent: ev(EventType.SessionEnd),
    tier: 4,
    line: "mage",
    branch: "a",
  });
  expect(guild.theme).toBe(SceneTheme.Guild);
  expect(guild.label).toBe("The Guild");

  const field = sceneNow({
    activity: ActivityState.Farming,
    lastEvent: ev(EventType.Prompt),
    tier: 4,
    line: "mage",
    branch: "a",
  });
  expect(field.theme).toBe(SceneTheme.SkyforgeAether);
  expect(field.label).toBe("Skyforge Aether");

  const t1 = sceneNow({
    activity: ActivityState.Idle,
    lastEvent: ev(EventType.Prompt),
    tier: 1,
  });
  expect(t1.theme).toBe(SceneTheme.Grassland);
});
