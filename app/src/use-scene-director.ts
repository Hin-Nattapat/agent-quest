import { useEffect, useRef, useState } from "react";
import type { IState } from "../../core/state";
import { ActivityState } from "./activity";
import { combatBeats } from "./game-events";
import {
  HeroAnim,
  MonsterAnim,
  PACK_HITS,
  AttackStyle,
  attackStyleFor,
  isRanged,
  firstAlive,
  heroAnim,
  monsterAnim,
} from "./combat";
import { heroSpriteSet } from "./sprites";
import {
  ScenePhase,
  initDirector,
  stepDirector,
  type IDirectorState,
} from "./scene-phase";

export enum FloaterKind {
  Xp = "xp",
  Hurt = "hurt",
}

export enum EffectKind {
  Slash = "slash",
  Zap = "zap",
  Arrow = "arrow",
  Glyph = "glyph",
}

export const effectKindFor = (style: AttackStyle): EffectKind => {
  if (style === AttackStyle.Cast) {
    return EffectKind.Zap;
  }
  if (style === AttackStyle.Shoot) {
    return EffectKind.Arrow;
  }
  if (style === AttackStyle.Invoke) {
    return EffectKind.Glyph;
  }
  return EffectKind.Slash;
};

export interface IFloater {
  id: number;
  kind: FloaterKind;
  text: string;
}

export interface IHitEffect {
  id: number;
  slot: number; // pack index the effect lands on
  kind: EffectKind;
}

interface IMobView {
  anim: MonsterAnim;
  hpFraction: number;
  gone: boolean; // felled and its die animation finished — stop rendering so the corpse doesn't linger
}

interface ISceneView {
  phase: ScenePhase;
  hero: HeroAnim;
  mobs: IMobView[]; // [] in Wander
  floaters: IFloater[];
  effects: IHitEffect[];
}

// These clear each transient anim class after it plays; they MUST match the matching CSS keyframe
// durations in styles.css (.hero-attack/.m-die/.floater/etc.) or the sprite snaps or leaks.
const HERO_MS = { attack: 280, hurt: 500, celebrate: 1200 };
const MON_MS = { hurt: 360, attack: 500, die: 600 };
const CAST_MS = 600; // mage cast pulse — long enough to play the 9 cast frames at CAST_FPS
const FLOATER_MS = 900;
const EFFECT_MS = 320;
const TICK_MS = 250; // advances time-driven transitions (engage start, rest-gap expiry)

export const useSceneDirector = (
  state: IState | null,
  activity: ActivityState,
): ISceneView => {
  const prevRef = useRef<IState | null>(null);
  const dirRef = useRef<IDirectorState>(initDirector);
  const seqRef = useRef(0);
  const timers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  const [dir, setDir] = useState<IDirectorState>(initDirector);
  const [attacking, setAttacking] = useState(false);
  const [heroHurt, setHeroHurt] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const [monHurt, setMonHurt] = useState(false);
  const [monAttack, setMonAttack] = useState(false);
  const [dyingSlot, setDyingSlot] = useState<number | null>(null);
  const [floaters, setFloaters] = useState<IFloater[]>([]);
  const [effects, setEffects] = useState<IHitEffect[]>([]);
  const styleRef = useRef<AttackStyle>(AttackStyle.Melee);
  const cls = state?.class;
  const clsLine = cls?.line ?? null;
  const heroSet =
    cls && clsLine ? heroSpriteSet(clsLine, cls.tier, cls.branch) : undefined;
  // No attack frames yet → behave as Melee (dash + slash), so unwired lines don't regress.
  styleRef.current = heroSet?.attack ? attackStyleFor(clsLine ?? "") : AttackStyle.Melee;

  useEffect(() => {
    const set = timers.current;
    return () => {
      for (const t of set) {
        clearTimeout(t);
      }
    };
  }, []);

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
  const nextId = () => {
    const id = seqRef.current;
    seqRef.current += 1;
    return id;
  };
  const addFloater = (kind: FloaterKind, text: string) => {
    const id = nextId();
    setFloaters(f => [...f, { id, kind, text }]);
    later(() => setFloaters(f => f.filter(x => x.id !== id)), FLOATER_MS);
  };
  const addEffect = (slot: number, kind: EffectKind) => {
    const id = nextId();
    setEffects(e => [...e, { id, slot, kind }]);
    later(() => setEffects(e => e.filter(x => x.id !== id)), EFFECT_MS);
  };

  // Apply one director step and fan out the CSS pulses implied by the state diff.
  const advance = (wantStrike: boolean) => {
    const before = dirRef.current;
    const next = stepDirector(before, { now: Date.now(), activity, wantStrike });
    dirRef.current = next;
    setDir(next);

    if (wantStrike && next.phase === ScenePhase.Engage) {
      const idx = firstAlive(before.pack);
      if (idx >= 0 && next.pack[idx] !== before.pack[idx]) {
        const style = styleRef.current;
        const ranged = isRanged(style);
        pulse(setAttacking, ranged ? CAST_MS : HERO_MS.attack);
        addEffect(idx, effectKindFor(style));
        if (next.pack[idx] <= 0) {
          setDyingSlot(idx);
          later(() => setDyingSlot(null), MON_MS.die);
        } else {
          pulse(setMonHurt, MON_MS.hurt);
        }
      }
    }
  };

  // Real state-diff beats.
  useEffect(() => {
    if (!state) {
      return;
    }
    const beats = combatBeats(prevRef.current, state);
    prevRef.current = state;

    if (beats.xp > 0) {
      addFloater(FloaterKind.Xp, `+${beats.xp} XP`);
      advance(true);
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

  // Low-frequency tick drives transitions AND strikes: advance(true) lets Engage strike on the
  // throttle cadence instead of waiting for an XP push, so the fight is continuous while farming.
  useEffect(() => {
    const id = setInterval(() => advance(true), TICK_MS);
    return () => clearInterval(id);
    // advance closes over `activity`; re-arm when it changes so transitions read fresh activity.
  }, [activity]);

  const wander = dir.phase === ScenePhase.Wander;
  const hero = heroAnim({
    celebrate: celebrating,
    hurt: heroHurt,
    attack: attacking,
    activity,
    wander,
  });
  const targetIdx = firstAlive(dir.pack);
  const mobs: IMobView[] = dir.pack.map((hits, i) => {
    // `dying` must bypass the isTarget gate: a killing blow already advanced firstAlive to the next
    // mob, so the corpse is no longer the target yet still needs its die animation to play out.
    const dying = dyingSlot === i;
    const isTarget = i === targetIdx;
    return {
      anim: monsterAnim({
        dying,
        attacking: isTarget && monAttack,
        hurt: isTarget && monHurt,
      }),
      hpFraction: hits / PACK_HITS,
      gone: hits <= 0 && !dying,
    };
  });

  return { phase: dir.phase, hero, mobs, floaters, effects };
};
