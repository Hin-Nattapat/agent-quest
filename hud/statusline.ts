import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { reduceThrottled } from "../core/reduce";
import { levelProgress, DEFAULT_DIFFICULTY } from "../core/xp";
import { defaultHome } from "../core/config";
import type { IState } from "../core/state";

export interface ITail {
  model: string | null;
  cost: number | null;
  ctx: number | null;
  five_hour?: number | null;
  seven_day?: number | null;
}

// Display columns, ignoring ANSI SGR codes and counting emoji / CJK as 2 cells.
// Iterating by code point (for..of) so astral emoji count once, then widened.
const displayWidth = (s: string): number => {
  const noAnsi = s.replace(/\x1b\[[0-9;]*m/g, "");
  let width = 0;
  for (const ch of noAnsi) {
    const cp = ch.codePointAt(0) ?? 0;
    const wide =
      cp === 0x2728 || // ✨
      cp === 0xfe0f || // variation selector-16
      (cp >= 0x2600 && cp <= 0x27bf) || // misc symbols + dingbats (⚔ etc.)
      (cp >= 0x1f000 && cp <= 0x1faff) || // emoji (🔥 🎒 🏹 …)
      (cp >= 0x2e80 && cp <= 0xa4cf) || // CJK
      (cp >= 0xff00 && cp <= 0xff60); // fullwidth forms
    width += wide ? 2 : 1;
  }
  return width;
};

interface IRenderHudArgs {
  state: IState;
  tail: ITail;
  cols?: number;
}

// Wrap text in an ANSI SGR color, or return it unchanged when no color is set.
const colored = (text: string, sgr: string | null | undefined): string =>
  sgr ? `\x1b[${sgr}m${text}\x1b[0m` : text;

// The 0..1 fraction of the current level that's filled.
const levelFraction = (state: IState): number => {
  if (state.xp_to_next === 0) {
    return 1;
  }
  return state.xp_in_level / (state.xp_in_level + state.xp_to_next);
};

// "Name the Title", tinted with the player's chosen name color.
const heroName = (state: IState): string => {
  const title = state.cosmetics?.title ? ` the ${state.cosmetics.title}` : "";
  const duck = state.cosmetics?.companion ? " 🦆" : "";
  return colored(
    `${state.name || "Adventurer"}${title}${duck}`,
    state.cosmetics?.name_color,
  );
};

// "🎼 Maestro" (or "Novice"), with a ✨ when an advancement is available.
const heroClass = (state: IState): string => {
  const cls = state.class;
  const label = cls && cls.line ? `${cls.icon} ${cls.form}` : "Novice";
  return cls?.advancement_pending ? `${label} ✨` : label;
};

// "Lv.5 ██████░░░░ 60%" — themed 10-cell bar; at the cap the bar tracks paragon progress as
// "Lv.50 ✦P7 ███░░░░░░░ 30%" (or " MAX" for old states with no paragon slice).
const xpMeter = (state: IState): string => {
  const paragon = state.paragon;
  if (state.xp_to_next === 0 && paragon) {
    const span = paragon.xp_in_paragon + paragon.xp_to_next;
    const fraction = span === 0 ? 1 : paragon.xp_in_paragon / span;
    const filled = Math.round(fraction * 10);
    const bar = colored(
      "█".repeat(filled) + "░".repeat(10 - filled),
      state.cosmetics?.theme_color,
    );
    return `Lv.${state.level} ✦P${paragon.level} ${bar} ${Math.round(fraction * 100)}%`;
  }
  const fraction = levelFraction(state);
  const filled = Math.round(fraction * 10);
  const bar = colored(
    "█".repeat(filled) + "░".repeat(10 - filled),
    state.cosmetics?.theme_color,
  );
  const maxed = state.xp_to_next === 0 ? " MAX" : "";
  return `Lv.${state.level} ${bar}${maxed} ${Math.round(fraction * 100)}%`;
};

// Trailing 🔥 streak + 🎒 inventory badges, each omitted when empty.
const badges = (state: IState): string => {
  const days = state.streak?.current_days ?? 0;
  const fire = days >= 1 ? ` 🔥${days}d` : "";
  const items = (state.inventory ?? []).reduce((sum, item) => sum + item.count, 0);
  const bag = items > 0 ? ` 🎒${items}` : "";
  return `${fire}${bag}`;
};

// Left side: the hero — "Name the Title · 🎼 Maestro ✨  Lv.5 ██████░░░░ 60% 🔥3d 🎒2".
const heroGroup = (state: IState): string =>
  `${heroName(state)} · ${heroClass(state)}  ${xpMeter(state)}${badges(state)}`;

// Right side: the session — "Opus 4.8  $0.42  ·  ctx 8%  ·  5h 40%  ·  7d 12%".
const sessionGroup = (tail: ITail): string => {
  const cost = tail.cost == null ? "0.00" : tail.cost.toFixed(2);
  const ctx = tail.ctx == null ? 0 : Math.round(tail.ctx);
  const rate5 = tail.five_hour == null ? "" : `  ·  5h ${Math.round(tail.five_hour)}%`;
  const rate7 = tail.seven_day == null ? "" : `  ·  7d ${Math.round(tail.seven_day)}%`;
  return `${tail.model || "?"}  $${cost}  ·  ctx ${ctx}%${rate5}${rate7}`;
};

// CC reports COLUMNS as the full terminal width, but the rendered line loses a few columns to the
// terminal's right edge / CC's own padding. Reserve a small gap so the right group is never clipped.
const RIGHT_SAFETY = 4;

// Right-align the session group when the terminal is wide enough, else join with a separator.
const layout = (left: string, right: string, cols: number): string => {
  const used = displayWidth(left) + displayWidth(right);
  if (cols > used + RIGHT_SAFETY + 1) {
    return left + " ".repeat(cols - used - RIGHT_SAFETY) + right;
  }
  return `${left}  |  ${right}`;
};

export const renderHud = (props: IRenderHudArgs): string => {
  const { state, tail, cols = 0 } = props;
  return layout(heroGroup(state), sessionGroup(tail), cols);
};

const HOME = defaultHome();

const readState = (home: string): IState => {
  const p = join(home, "state.json");
  if (existsSync(p)) {
    try {
      return JSON.parse(readFileSync(p, "utf8")) as IState;
    } catch {
      // fall through to the zero state
    }
  }
  const prog = levelProgress(0, DEFAULT_DIFFICULTY);
  return {
    version: 1,
    updated_at: "",
    xp_total: 0,
    level: prog.level,
    xp_in_level: prog.xp_in_level,
    xp_to_next: prog.xp_to_next,
    stats: { prompts: 0, actions: {}, sessions: 0, by_source: {}, by_repo: {} },
  };
};

const main = async (): Promise<void> => {
  let raw = "";
  try {
    raw = await new Response(Bun.stdin.stream()).text();
  } catch {
    // no stdin
  }
  let tail: ITail = { model: null, cost: null, ctx: null };
  try {
    const j = JSON.parse(raw);
    tail = {
      model: j?.model?.display_name ?? null,
      cost: j?.cost?.total_cost_usd ?? null,
      ctx: j?.context_window?.used_percentage ?? null,
      five_hour: j?.rate_limits?.five_hour?.used_percentage ?? null,
      seven_day: j?.rate_limits?.seven_day?.used_percentage ?? null,
    };
  } catch {
    // keep nulls
  }
  try {
    reduceThrottled(HOME);
  } catch {
    // statusline must never break the prompt
  }
  const cols = Number(process.env.COLUMNS) || 0;
  process.stdout.write(renderHud({ state: readState(HOME), tail, cols }));
};

if (import.meta.main) {
  main().catch(() => process.stdout.write("Lv.1 ░░░░░░░░░░ 0%  |  ?  $0.00  ·  ctx 0%"));
}
