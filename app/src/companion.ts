export enum CompanionFacing {
  East = "east",
  South = "south",
}

// Companion ids with imported idle art at /sprites/companion/<id>/<facing>/<N>.png.
// An id not here → [] → the caller hides the companion (no emoji fallback: it's a secret).
const COMPANION_ART = new Set<string>(["sir_quacks"]);
const COMPANION_IDLE_FRAMES = 9;

export const companionFrames = (id: string, facing: CompanionFacing): string[] =>
  COMPANION_ART.has(id)
    ? Array.from(
        { length: COMPANION_IDLE_FRAMES },
        (_, i) => `/sprites/companion/${id}/${facing}/${i}.png`,
      )
    : [];
