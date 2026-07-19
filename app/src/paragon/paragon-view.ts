import type { IParagonState } from "../../../core/paragon";

export interface IParagonBar {
  pct: number;
  label: string;
  badge: string;
}

// The paragon meter replaces the frozen MAX xp bar once the main levels cap out. Null below the
// cap (xp_to_next > 0) or for states that predate the paragon slice.
export const paragonBar = (
  xpToNext: number,
  paragon: IParagonState | undefined,
): IParagonBar | null => {
  if (xpToNext > 0 || !paragon) {
    return null;
  }
  const span = paragon.xp_in_paragon + paragon.xp_to_next;
  const pct = span === 0 ? 100 : Math.round((paragon.xp_in_paragon / span) * 100);
  return {
    pct,
    label: `${paragon.xp_in_paragon} / ${span}`,
    badge: `✦P${paragon.level}`,
  };
};
