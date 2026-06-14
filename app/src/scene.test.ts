import { test, expect } from "bun:test";
import { sceneFor, realmFor, SceneTheme } from "./scene";

test("sceneFor T1-T3 unchanged", () => {
  expect(sceneFor(0).theme).toBe(SceneTheme.Grassland);
  expect(sceneFor(1).theme).toBe(SceneTheme.Grassland);
  expect(sceneFor(2).theme).toBe(SceneTheme.Forest);
  expect(sceneFor(2).monster).toBe("Error Wraith");
  expect(sceneFor(3).theme).toBe(SceneTheme.Dungeon);
});

test("sceneFor T4 main lines map to realm + boss", () => {
  expect(sceneFor(4, "mage", "a")).toEqual({
    theme: SceneTheme.SkyforgeAether,
    label: "Skyforge Aether",
    monster: "Storm Archon",
  });
  expect(sceneFor(4, "mage", "b").monster).toBe("The Kernel Lich");
  expect(sceneFor(4, "ranger", "a").theme).toBe(SceneTheme.AuroraFlux);
  expect(sceneFor(4, "ranger", "b").monster).toBe("The Grid Warden");
  expect(sceneFor(4, "rogue", "a").theme).toBe(SceneTheme.QuantumRift);
  expect(sceneFor(4, "rogue", "b").monster).toBe("The Phantom Culprit");
  expect(sceneFor(4, "sage", "a").theme).toBe(SceneTheme.OraclesAthenaeum);
  expect(sceneFor(4, "sage", "b").monster).toBe("The Orchestration Construct");
});

test("sceneFor T4 secret classes map to realm + boss", () => {
  expect(sceneFor(4, "maestro", null).monster).toBe("The Living Symphony");
  expect(sceneFor(4, "night_owl", null)).toEqual({
    theme: SceneTheme.MidnightRoost,
    label: "Midnight Roost",
    monster: "The Eclipse Owl",
  });
  expect(sceneFor(4, "ascetic", null).theme).toBe(SceneTheme.SilentSummit);
  expect(sceneFor(4, "gremlin", null).monster).toBe("The Chaos Gremlin King");
  expect(sceneFor(4, "trickster", null).theme).toBe(SceneTheme.FoolsMirage);
});

test("sceneFor T4 main line before branch pick falls back to Ascendant", () => {
  expect(sceneFor(4, "mage", null)).toEqual({
    theme: SceneTheme.Ascendant,
    label: "Ascendant Realm",
    monster: "Realm Guardian",
  });
  expect(sceneFor(5, "sage", null).theme).toBe(SceneTheme.Ascendant);
});

test("sceneFor T4 with no line falls back to Ascendant", () => {
  expect(sceneFor(4, null, null).theme).toBe(SceneTheme.Ascendant);
  expect(sceneFor(4).theme).toBe(SceneTheme.Ascendant);
});

test("realmFor builds keys and falls back on unknown", () => {
  expect(realmFor("mage", "a").theme).toBe(SceneTheme.SkyforgeAether);
  expect(realmFor("gremlin", null).theme).toBe(SceneTheme.GlitchPit);
  expect(realmFor("future_line", "a").theme).toBe(SceneTheme.Ascendant);
  expect(realmFor(null, null).theme).toBe(SceneTheme.Ascendant);
});
