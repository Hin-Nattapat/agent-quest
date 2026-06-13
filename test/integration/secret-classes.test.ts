import { test, expect } from "bun:test";
import { reduce } from "../../core/reduce";
import { loadConfig } from "../../core/config";
import { renderHud } from "../../hud/statusline";
import { SecretLine } from "../../core/classes";
import { makeHome } from "../helpers";

test("unlock via xyzzy, equip the secret, and see it in the HUD", () => {
  const cfg = loadConfig(makeHome());
  const events = [
    {
      ts: "2026-06-11T12:00:00Z",
      source: "claude-code",
      session_id: "s",
      type: "prompt",
      repo: "cq",
    },
  ] as any;

  const unlocked = reduce({
    events,
    config: cfg,
    today: "2026-06-11",
    profile: { xyzzy: true },
  });
  expect(unlocked.unlocked_secret_classes).toContain(SecretLine.Trickster);

  const equipped = reduce({
    events,
    config: cfg,
    today: "2026-06-11",
    profile: {
      xyzzy: true,
      line: SecretLine.Trickster,
    },
  });
  expect(equipped.class?.line).toBe(SecretLine.Trickster);
  expect(equipped.class?.branch).toBe(null);
  const line = renderHud({
    state: { ...equipped, updated_at: "" },
    tail: { model: "M", cost: 0, ctx: 0 },
  });
  expect(line).toContain("✦"); // the Trickster icon renders
});
