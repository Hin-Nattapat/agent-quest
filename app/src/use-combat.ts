import { useEffect, useRef, useState } from "react";
import type { IState } from "../../core/state";
import { ActivityState } from "./activity";
import { combatBeats } from "./game-events";
import {
  HeroAnim,
  MonsterAnim,
  MONSTER_HITS,
  hitMonster,
  heroAnim,
  monsterAnim,
} from "./combat";

export enum FloaterKind {
  Xp = "xp",
  Hurt = "hurt",
}

export interface IFloater {
  id: number;
  kind: FloaterKind;
  text: string;
}

export interface ICombatView {
  hero: HeroAnim;
  monster: MonsterAnim;
  hpFraction: number;
  floaters: IFloater[];
}

const HERO_MS = { attack: 400, hurt: 500, celebrate: 1200 };
const MON_MS = { hurt: 300, attack: 500, die: 600 };
const FLOATER_MS = 900;

export function useCombat(state: IState | null, activity: ActivityState): ICombatView {
  const prevRef = useRef<IState | null>(null);
  const hitsRef = useRef(0);
  const floaterId = useRef(0);
  const timers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  const [hits, setHits] = useState(0);
  const [attacking, setAttacking] = useState(false);
  const [heroHurt, setHeroHurt] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const [monHurt, setMonHurt] = useState(false);
  const [monAttack, setMonAttack] = useState(false);
  const [dying, setDying] = useState(false);
  const [floaters, setFloaters] = useState<IFloater[]>([]);

  // Clear outstanding timers only on unmount (not on each state push).
  useEffect(() => {
    const set = timers.current;
    return () => {
      for (const t of set) {
        clearTimeout(t);
      }
    };
  }, []);

  useEffect(() => {
    if (!state) {
      return;
    }
    const beats = combatBeats(prevRef.current, state);
    prevRef.current = state;

    const later = (fn: () => void, ms: number) => {
      const t = setTimeout(() => {
        timers.current.delete(t);
        fn();
      }, ms);
      timers.current.add(t);
    };
    const pulse = (set: (v: boolean) => void, ms: number) => {
      set(true);
      later(() => set(false), ms);
    };
    const addFloater = (kind: FloaterKind, text: string) => {
      const id = floaterId.current;
      floaterId.current += 1;
      setFloaters(f => [...f, { id, kind, text }]);
      later(() => setFloaters(f => f.filter(x => x.id !== id)), FLOATER_MS);
    };

    if (beats.xp > 0) {
      pulse(setAttacking, HERO_MS.attack);
      addFloater(FloaterKind.Xp, `+${beats.xp} XP`);
      const res = hitMonster(hitsRef.current);
      hitsRef.current = res.hits;
      setHits(res.hits);
      if (res.died) {
        pulse(setDying, MON_MS.die);
      } else {
        pulse(setMonHurt, MON_MS.hurt);
      }
    }
    if (beats.hurt) {
      pulse(setHeroHurt, HERO_MS.hurt);
      pulse(setMonAttack, MON_MS.attack);
      addFloater(FloaterKind.Hurt, "");
    }
    if (beats.leveledUp) {
      pulse(setCelebrating, HERO_MS.celebrate);
    }
  }, [state]);

  const hero = heroAnim({
    celebrate: celebrating,
    hurt: heroHurt,
    attack: attacking,
    activity,
  });
  const monster = monsterAnim({ dying, attacking: monAttack, hurt: monHurt });
  const hpFraction = (MONSTER_HITS - hits) / MONSTER_HITS;

  return { hero, monster, hpFraction, floaters };
}
