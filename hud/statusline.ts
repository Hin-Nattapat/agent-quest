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
}

export function renderHud(state: IState, tail: ITail): string {
  const pct = state.xp_to_next === 0 ? 1 : state.xp_in_level / (state.xp_in_level + state.xp_to_next);
  const filled = Math.round(pct * 10);
  const bar = "█".repeat(filled) + "░".repeat(10 - filled);
  const maxed = state.xp_to_next === 0 ? " MAX" : "";
  const model = tail.model || "?";
  const cost = tail.cost == null ? "0.00" : tail.cost.toFixed(2);
  const ctx = tail.ctx == null ? 0 : Math.round(tail.ctx);
  const fire = state.streak && state.streak.current_days >= 1 ? ` 🔥${state.streak.current_days}d` : "";
  return `Lv.${state.level} ${bar}${maxed} ${Math.round(pct * 100)}%${fire}  |  ${model}  $${cost}  ·  ctx ${ctx}%`;
}

const HOME = defaultHome();

function readState(home: string): IState {
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
    version: 1, updated_at: "", xp_total: 0,
    level: prog.level, xp_in_level: prog.xp_in_level, xp_to_next: prog.xp_to_next,
    stats: { prompts: 0, actions: {}, sessions: 0, by_source: {}, by_repo: {} },
  };
}

async function main(): Promise<void> {
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
    };
  } catch {
    // keep nulls
  }
  try {
    reduceThrottled(HOME);
  } catch {
    // statusline must never break the prompt
  }
  process.stdout.write(renderHud(readState(HOME), tail));
}

if (import.meta.main) {
  main().catch(() => process.stdout.write("Lv.1 ░░░░░░░░░░ 0%  |  ?  $0.00  ·  ctx 0%"));
}
