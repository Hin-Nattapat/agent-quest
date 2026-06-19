import { useEffect, useRef, useState } from "react";
import { HeroAnim, MonsterAnim, attackStyleFor, isRanged } from "./combat";
import { GameEventType, type IGameEvent } from "./game-events";

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

// Attack lengths must let the full frame cycle play, or the sprite barely animates before reverting.
// These mirror the scene director: a ranged/cast hero needs its whole 9-frame cycle (≈600ms at the
// hero's 15fps), a melee dash is a quick 280ms. The boss gets a punchy strike window.
const HERO_RANGED_MS = 600;
const HERO_MELEE_MS = 280;
const BOSS_ATTACK_MS = 760;
const HERO_HURT_MS = 460;
const BOSS_HURT_MS = 360;
const FX_MS = 360; // clears a hit flash / impact burst; matches the CSS keyframes
const RECOVER_MS = 220; // a breath between turns so the trade reads as turns, not a scramble

const heroAttackMs = (line: string): number =>
  isRanged(attackStyleFor(line)) ? HERO_RANGED_MS : HERO_MELEE_MS;

const IDLE: IBossFightView = {
  bossAnim: MonsterAnim.Idle,
  bossHp: 1,
  heroAnim: null,
  heroHits: [],
  bossHits: [],
  leaving: false,
};

export const useBossFight = (
  encounter: IGameEvent | null,
  line: string,
): IBossFightView => {
  const timers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const seqRef = useRef(0);
  const [bossAnim, setBossAnim] = useState<MonsterAnim>(IDLE.bossAnim);
  const [bossHp, setBossHp] = useState(IDLE.bossHp);
  const [heroAnim, setHeroAnim] = useState<HeroAnim | null>(IDLE.heroAnim);
  const [heroHits, setHeroHits] = useState<number[]>([]);
  const [bossHits, setBossHits] = useState<number[]>([]);
  const [leaving, setLeaving] = useState(false);

  const clearTimers = () => {
    for (const t of timers.current) {
      clearTimeout(t);
    }
    timers.current.clear();
  };
  useEffect(() => {
    return () => {
      clearTimers();
    };
  }, []);

  const later = (fn: () => void, ms: number) => {
    const t = setTimeout(() => {
      timers.current.delete(t);
      fn();
    }, ms);
    timers.current.add(t);
  };
  const flash = (set: (fn: (ids: number[]) => number[]) => void, ms: number) => {
    const id = seqRef.current;
    seqRef.current += 1;
    set(ids => [...ids, id]);
    later(() => set(ids => ids.filter(x => x !== id)), ms);
  };

  useEffect(() => {
    clearTimers();
    setBossAnim(IDLE.bossAnim);
    setBossHp(IDLE.bossHp);
    setHeroAnim(IDLE.heroAnim);
    setHeroHits([]);
    setBossHits([]);
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
      later(() => setHeroAnim(HeroAnim.Attack), heroStart);
      later(() => setHeroAnim(null), heroStart + heroMs);
      later(() => {
        setBossAnim(MonsterAnim.Hurt);
        setBossHp(hp => Math.max(0, hp - 1 / ROUNDS));
        flash(setBossHits, FX_MS);
      }, heroStart + heroContact);
      later(() => setBossAnim(MonsterAnim.Idle), heroStart + heroContact + BOSS_HURT_MS);

      if (finisher) {
        // Collapse a beat after the killing blow connects — no empty round, no boss counter.
        resolveAt = heroStart + heroContact + 350;
        break;
      }
      t = heroStart + heroMs + RECOVER_MS;

      // — boss's turn: strike back → hero flinches —
      const bossStart = t;
      later(() => setBossAnim(MonsterAnim.Attack), bossStart);
      later(() => setBossAnim(MonsterAnim.Idle), bossStart + BOSS_ATTACK_MS);
      later(() => {
        setHeroAnim(HeroAnim.Hurt);
        flash(setHeroHits, FX_MS);
      }, bossStart + bossContact);
      later(() => setHeroAnim(null), bossStart + bossContact + HERO_HURT_MS);
      t = bossStart + BOSS_ATTACK_MS + RECOVER_MS;
    }

    if (fled) {
      later(() => {
        setBossAnim(MonsterAnim.Idle);
        setLeaving(true);
      }, t);
    } else {
      later(() => {
        setBossHp(0);
        setBossAnim(MonsterAnim.Die);
        setLeaving(true);
      }, resolveAt);
    }
  }, [encounter, line]);

  return { bossAnim, bossHp, heroAnim, heroHits, bossHits, leaving };
};
