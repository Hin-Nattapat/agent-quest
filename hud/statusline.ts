import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { reduceThrottled } from "../core/reduce";
import { levelProgress, DEFAULT_DIFFICULTY } from "../core/xp";
import { defaultHome } from "../core/config";
import { sourceLabel } from "../core/events";
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

export const renderHud = (props: IRenderHudArgs): string => {
  const { state, tail, cols = 0 } = props;
  const pct =
    state.xp_to_next === 0
      ? 1
      : state.xp_in_level / (state.xp_in_level + state.xp_to_next);
  const filled = Math.round(pct * 10);
  const bar = "█".repeat(filled) + "░".repeat(10 - filled);
  const maxed = state.xp_to_next === 0 ? " MAX" : "";
  const themeColor = state.cosmetics?.theme_color;
  const coloredBar = themeColor ? `\x1b[${themeColor}m${bar}\x1b[0m` : bar;

  const name = state.name || "Adventurer";
  const titleSuffix = state.cosmetics?.title ? ` the ${state.cosmetics.title}` : "";
  const nameColor = state.cosmetics?.name_color;
  const namePlate = `${name}${titleSuffix}`;
  const coloredName = nameColor ? `\x1b[${nameColor}m${namePlate}\x1b[0m` : namePlate;
  const cls = state.class;
  const label = cls && cls.line ? `${cls.icon} ${cls.form}` : "Novice";
  const pending = cls?.advancement_pending ? " ✨" : "";
  const fire =
    state.streak && state.streak.current_days >= 1
      ? ` 🔥${state.streak.current_days}d`
      : "";
  const bagCount = (state.inventory ?? []).reduce((sum, item) => sum + item.count, 0);
  const bag = bagCount > 0 ? ` 🎒${bagCount}` : "";
  const bySource = state.stats?.by_source ?? {};
  const via =
    Object.keys(bySource).length >= 2 && state.last_event?.source
      ? ` · via ${sourceLabel(state.last_event.source)}`
      : "";
  const left =
    `${coloredName} · ${label}${pending}  ` +
    `Lv.${state.level} ${coloredBar}${maxed} ${Math.round(pct * 100)}%${fire}${bag}${via}`;

  const model = tail.model || "?";
  const cost = tail.cost == null ? "0.00" : tail.cost.toFixed(2);
  const ctx = tail.ctx == null ? 0 : Math.round(tail.ctx);
  const rate5 = tail.five_hour == null ? "" : `  ·  5h ${Math.round(tail.five_hour)}%`;
  const rate7 = tail.seven_day == null ? "" : `  ·  7d ${Math.round(tail.seven_day)}%`;
  const right = `${model}  $${cost}  ·  ctx ${ctx}%${rate5}${rate7}`;

  // CC reports COLUMNS as the full terminal width, but the rendered line loses a few columns
  // to the terminal's right edge / CC's own padding. Reserve a small safety gap so the right
  // group is never clipped — a few blank columns on the right are imperceptible.
  const RIGHT_SAFETY = 4;
  const used = displayWidth(left) + displayWidth(right);
  if (cols > used + RIGHT_SAFETY + 1) {
    return left + " ".repeat(cols - used - RIGHT_SAFETY) + right;
  }
  return `${left}  |  ${right}`;
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
