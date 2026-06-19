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
  firstAlive,
  heroAnim,
  monsterAnim,
  randAlive,
  packCleared,
} from "./combat";
import { attackMsForStyle } from "./combat-timing";
import { heroSpriteSet } from "./sprites";
import { useTimerPool } from "./timer-pool";
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
  heroHits: number[];
}

// These clear each transient anim class after it plays; they MUST match the matching CSS keyframe
// durations in styles.css (.hero-attack/.m-die/.floater/etc.) or the sprite snaps or leaks. The hero
// attack length lives in combat-timing (shared with the boss fight).
const HERO_MS = { hurt: 500, celebrate: 1200 };
const MON_MS = { hurt: 360, attack: 500, die: 600 };
const FLOATER_MS = 900;
const EFFECT_MS = 320;
const TICK_MS = 250; // advances time-driven transitions (engage start, rest-gap expiry)
const COUNTER_DELAY_MS = 1000; // mob bites back ~1s after the hero strike (throttle 2600) → the pair
// of blows lands, then the rest of the window is idle breathing before the next strike
const CONTACT_MS = 180; // delay the impact to the attacker's contact frame, not its windup → smooth
const HERO_HIT_MS = 360; // clears the .hero-hit class; matches its CSS keyframe

export const useSceneDirector = (
  state: IState | null,
  activity: ActivityState,
): ISceneView => {
  const prevRef = useRef<IState | null>(null);
  const dirRef = useRef<IDirectorState>(initDirector);
  const seqRef = useRef(0);
  const pool = useTimerPool();

  const [dir, setDir] = useState<IDirectorState>(initDirector);
  const [attacking, setAttacking] = useState(false);
  const [heroHurt, setHeroHurt] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const [monHurt, setMonHurt] = useState(false);
  const [attackSlot, setAttackSlot] = useState<number | null>(null);
  const [heroHits, setHeroHits] = useState<number[]>([]);
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

  const pulse = (set: (v: boolean) => void, ms: number) => {
    set(true);
    pool.later(() => set(false), ms);
  };
  // seqRef double-duties: a unique id for each transient VFX AND the varying seed randAlive uses to
  // pick which mob counter-attacks — so the flash lists stay inline here rather than useFlashIds.
  const nextId = () => {
    const id = seqRef.current;
    seqRef.current += 1;
    return id;
  };
  const addFloater = (kind: FloaterKind, text: string) => {
    const id = nextId();
    setFloaters(f => [...f, { id, kind, text }]);
    pool.later(() => setFloaters(f => f.filter(x => x.id !== id)), FLOATER_MS);
  };
  const addEffect = (slot: number, kind: EffectKind) => {
    const id = nextId();
    setEffects(e => [...e, { id, slot, kind }]);
    pool.later(() => setEffects(e => e.filter(x => x.id !== id)), EFFECT_MS);
  };
  const addHeroHit = () => {
    const id = nextId();
    setHeroHits(h => [...h, id]);
    pool.later(() => setHeroHits(h => h.filter(x => x !== id)), HERO_HIT_MS);
  };
  // A mob plays its attack frames; CONTACT_MS later its blow connects → hero-hit VFX + flinch.
  const counterAttack = () => {
    const idx = randAlive(dirRef.current.pack, seqRef.current);
    if (idx < 0) {
      return;
    }
    setAttackSlot(idx);
    pool.later(() => setAttackSlot(null), MON_MS.attack);
    pool.later(() => {
      addHeroHit();
      pulse(setHeroHurt, HERO_MS.hurt);
    }, CONTACT_MS);
  };

  // Apply one director step and fan out the CSS pulses implied by the state diff.
  const advance = (wantStrike: boolean) => {
    const before = dirRef.current;
    const next = stepDirector(before, { now: Date.now(), activity, wantStrike });
    dirRef.current = next;
    setDir(next);

    // Gate on the pre-step phase: the killing blow flips next.phase to Wander, so checking next would
    // skip fanning out the final strike's die animation + hit effect.
    if (wantStrike && before.phase === ScenePhase.Engage) {
      const idx = firstAlive(before.pack);
      if (idx >= 0 && next.pack[idx] !== before.pack[idx]) {
        const style = styleRef.current;
        const killed = next.pack[idx] <= 0;
        pulse(setAttacking, attackMsForStyle(style));
        // A killing blow drops the mob's hits to 0 synchronously (setDir above), so mark it dying in
        // the SAME render — otherwise the `gone` gate (hits<=0 && !dying) hides the mob during the
        // contact window and it vanishes before its die animation (and final strike) ever play.
        if (killed) {
          setDyingSlot(idx);
          pool.later(() => setDyingSlot(null), MON_MS.die);
        }
        // The blow lands on the hero's contact frame, not the windup, so the trade reads smoothly.
        pool.later(() => {
          addEffect(idx, effectKindFor(style));
          if (!killed) {
            pulse(setMonHurt, MON_MS.hurt);
          }
        }, CONTACT_MS);
        if (!packCleared(next.pack)) {
          pool.later(counterAttack, COUNTER_DELAY_MS);
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
      const idx = firstAlive(dirRef.current.pack);
      if (idx >= 0) {
        setAttackSlot(idx);
        pool.later(() => setAttackSlot(null), MON_MS.attack);
      }
      pool.later(() => {
        addHeroHit();
        pulse(setHeroHurt, HERO_MS.hurt);
      }, CONTACT_MS);
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

  const hero = heroAnim({
    celebrate: celebrating,
    hurt: heroHurt,
    attack: attacking,
    activity,
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
        attacking: attackSlot === i,
        hurt: isTarget && monHurt,
      }),
      hpFraction: hits / PACK_HITS,
      gone: hits <= 0 && !dying,
    };
  });

  return { phase: dir.phase, hero, mobs, floaters, effects, heroHits };
};
