import { useEffect, useState } from "react";
import { HeroAnim, MonsterAnim } from "./combat";
import { heroAttackMs } from "./combat-timing";
import { GameEventType, type IGameEvent } from "./game-events";
import { useTimerPool } from "./timer-pool";
import { useFlashIds } from "./use-flash-list";

// A scripted boss battle reusing the mob combat visuals. The reducer already decided the outcome
// (defeat/flee) and there is no live HP, so this is pure cosmetic choreography off the one encounter
// diff. It is strictly turn-based: the hero takes a full turn, both sides breathe, the boss takes a
// full turn, repeat — each beat lasts as long as the animation it represents actually needs to play.
export interface IBossFightView {
  bossAnim: MonsterAnim;
  bossHp: number; // 1 → 0, cosmetic (mirrors the mob HP, which is also cosmetic)
  heroAnim: HeroAnim | null; // overrides the scene director's hero while the fight owns it
  heroHits: number[]; // flinch flashes when the boss connects
  bossHits: number[]; // impact bursts on the boss when the hero's blow lands
  leaving: boolean; // trades done → component plays the boss-die / boss-flee exit
}

const ROUNDS = 10; // hero + boss exchanges; the last one is the hero's finisher (no boss counter)
const BOSS_ATTACK_MS = 760; // a punchy strike window for the boss's ~9 attack frames
const HERO_HURT_MS = 460;
const BOSS_HURT_MS = 360;
const FX_MS = 360; // clears a hit flash / impact burst; matches the CSS keyframes
const RECOVER_MS = 220; // a breath between turns so the trade reads as turns, not a scramble

export const useBossFight = (
  encounter: IGameEvent | null,
  line: string,
): IBossFightView => {
  const pool = useTimerPool();
  const [bossAnim, setBossAnim] = useState<MonsterAnim>(MonsterAnim.Idle);
  const [bossHp, setBossHp] = useState(1);
  const [heroAnim, setHeroAnim] = useState<HeroAnim | null>(null);
  const [heroHits, flashHeroHit, clearHeroHits] = useFlashIds(pool, FX_MS);
  const [bossHits, flashBossHit, clearBossHits] = useFlashIds(pool, FX_MS);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    pool.clearAll();
    setBossAnim(MonsterAnim.Idle);
    setBossHp(1);
    setHeroAnim(null);
    clearHeroHits();
    clearBossHits();
    setLeaving(false);
    if (!encounter) {
      return;
    }

    const fled = encounter.type === GameEventType.BossFled;
    const heroMs = heroAttackMs(line);
    const heroContact = Math.round(heroMs * 0.55); // the blow lands late in the swing/cast
    const bossContact = Math.round(BOSS_ATTACK_MS * 0.42);
    // A fleeing boss never takes the finisher — it bails after a full exchange.
    const tradeRounds = fled ? ROUNDS - 1 : ROUNDS;

    let t = 0; // running cursor: each beat is scheduled at `t`, then `t` advances past it
    let resolveAt = 0;

    for (let k = 0; k < tradeRounds; k++) {
      const finisher = !fled && k === ROUNDS - 1;

      // — hero's turn: strike → boss flinches, takes a chunk of HP, shows an impact burst —
      const heroStart = t;
      pool.later(() => setHeroAnim(HeroAnim.Attack), heroStart);
      pool.later(() => setHeroAnim(null), heroStart + heroMs);
      pool.later(() => {
        setBossAnim(MonsterAnim.Hurt);
        setBossHp(hp => Math.max(0, hp - 1 / ROUNDS));
        flashBossHit();
      }, heroStart + heroContact);
      pool.later(
        () => setBossAnim(MonsterAnim.Idle),
        heroStart + heroContact + BOSS_HURT_MS,
      );

      if (finisher) {
        // Collapse a beat after the killing blow connects — no empty round, no boss counter.
        resolveAt = heroStart + heroContact + 350;
        break;
      }
      t = heroStart + heroMs + RECOVER_MS;

      // — boss's turn: strike back → hero flinches —
      const bossStart = t;
      pool.later(() => setBossAnim(MonsterAnim.Attack), bossStart);
      pool.later(() => setBossAnim(MonsterAnim.Idle), bossStart + BOSS_ATTACK_MS);
      pool.later(() => {
        setHeroAnim(HeroAnim.Hurt);
        flashHeroHit();
      }, bossStart + bossContact);
      pool.later(() => setHeroAnim(null), bossStart + bossContact + HERO_HURT_MS);
      t = bossStart + BOSS_ATTACK_MS + RECOVER_MS;
    }

    if (fled) {
      pool.later(() => {
        setBossAnim(MonsterAnim.Idle);
        setLeaving(true);
      }, t);
    } else {
      pool.later(() => {
        setBossHp(0);
        setBossAnim(MonsterAnim.Die);
        setLeaving(true);
      }, resolveAt);
    }
  }, [encounter, line]);

  return { bossAnim, bossHp, heroAnim, heroHits, bossHits, leaving };
};
