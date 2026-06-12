import type { IState } from "../../core/state";

export function xpPercent(state: IState): number {
  if (state.xp_to_next <= 0) {
    return 100; // MAX at the level cap
  }
  const span = state.xp_in_level + state.xp_to_next;
  return Math.round((state.xp_in_level / span) * 100);
}

export function displayName(state: IState): string {
  return state.name ?? "Adventurer";
}

export function classLabel(state: IState): string {
  const klass = state.class;
  if (!klass || !klass.line) {
    return "Novice";
  }
  return `${klass.icon} ${klass.form}`.trim();
}

export function titleSuffix(state: IState): string {
  const title = state.cosmetics?.title;
  return title ? ` the ${title}` : "";
}

export function streakText(state: IState): string {
  const days = state.streak?.current_days ?? 0;
  return days > 0 ? `🔥 ${days}d` : "";
}
