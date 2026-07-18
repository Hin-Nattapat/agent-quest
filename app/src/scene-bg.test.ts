import { test, expect } from "bun:test";
import { SceneTheme } from "./scene";
import { hasSceneBg } from "./scene-bg";

test("hasSceneBg is true for a wired theme, false otherwise", () => {
  expect(hasSceneBg(SceneTheme.Grassland)).toBe(true);
  expect(hasSceneBg(SceneTheme.Forest)).toBe(true);
  expect(hasSceneBg(SceneTheme.Dungeon)).toBe(true);
  expect(hasSceneBg(SceneTheme.SkyforgeAether)).toBe(true);
  expect(hasSceneBg(SceneTheme.CircuitCatacombs)).toBe(true);
  expect(hasSceneBg(SceneTheme.AuroraFlux)).toBe(true);
  expect(hasSceneBg(SceneTheme.GeometricSanctum)).toBe(true);
  expect(hasSceneBg(SceneTheme.QuantumRift)).toBe(true);
  expect(hasSceneBg(SceneTheme.NoirCrimeScene)).toBe(true);
  expect(hasSceneBg(SceneTheme.OraclesAthenaeum)).toBe(true);
  expect(hasSceneBg(SceneTheme.ConductorsNexus)).toBe(true);
  expect(hasSceneBg(SceneTheme.GrandConcertVault)).toBe(true);
  expect(hasSceneBg(SceneTheme.MidnightRoost)).toBe(true);
  expect(hasSceneBg(SceneTheme.SilentSummit)).toBe(true);
  expect(hasSceneBg(SceneTheme.FoolsMirage)).toBe(true);
  expect(hasSceneBg(SceneTheme.GlitchPit)).toBe(true);
  expect(hasSceneBg(SceneTheme.Guild)).toBe(false);
  expect(hasSceneBg(SceneTheme.Ascendant)).toBe(false);
});
