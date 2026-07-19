import { xpForLevel, type IDifficulty } from "./xp";

// Paragon (spec 2026-07-19): endless post-cap levels priced flat at the cost of the LAST main
// level, so the late-game rhythm continues unchanged. Reads the overflow XP that levelProgress
// already parks at the cap — nothing new is accumulated.

export interface IParagonState {
  level: number;
  xp_in_paragon: number;
  xp_to_next: number;
  auras: string[];
}

export interface IAuraMilestone {
  level: number;
  id: string;
  label: string;
}

export const AURA_MILESTONES: IAuraMilestone[] = [
  { level: 10, id: "ember", label: "Ember" },
  { level: 25, id: "azure", label: "Azure" },
  { level: 50, id: "royal", label: "Royal" },
  { level: 100, id: "radiant", label: "Radiant" },
];

interface IParagonForArgs {
  xpTotal: number;
  difficulty: IDifficulty;
}

export const paragonFor = (props: IParagonForArgs): IParagonState => {
  const { xpTotal, difficulty } = props;
  const cap = difficulty.level_cap;
  const capXp = xpForLevel(cap, difficulty);
  const step = Math.max(1, capXp - xpForLevel(Math.max(1, cap - 1), difficulty));
  const overflow = Math.max(0, xpTotal - capXp);
  const level = Math.floor(overflow / step);
  const xpInParagon = overflow % step;
  const auras = AURA_MILESTONES.filter(m => level >= m.level).map(m => m.id);
  if (xpTotal < capXp) {
    return { level: 0, xp_in_paragon: 0, xp_to_next: step, auras: [] };
  }
  return { level, xp_in_paragon: xpInParagon, xp_to_next: step - xpInParagon, auras };
};
