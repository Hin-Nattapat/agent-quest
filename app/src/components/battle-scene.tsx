import type { IState } from "../../../core/state";
import type { IScene } from "../scene";
import { ActivityState } from "../activity";
import { useEncounter } from "../use-encounter";
import { useSceneDirector } from "../use-scene-director";
import { useBossFight } from "../use-boss-fight";
import { HeroAnim } from "../combat";
import { CompanionFacing } from "../companion";
import Hero from "./hero";
import Monster from "./monster";
import HitEffects from "./hit-effect";
import HeroHits from "./hero-hit";
import BossEncounter from "./boss-encounter";
import FloatingText from "./floating-text";
import CompanionSprite from "./companion-sprite";

interface IProps {
  state: IState;
  activity: ActivityState;
  sceneInfo: IScene;
  line: string;
  tier: number;
  branch: string | null;
}

const BattleScene = (props: IProps) => {
  const { state, activity, sceneInfo, line, tier, branch } = props;
  // No-art classes (Novice, secret lines without sprites yet) fall back to their own emoji icon.
  const icon = state.class?.icon || "🧙";
  const encounter = useEncounter(state);
  const scene = useSceneDirector(state, activity);
  const fight = useBossFight(encounter, line);
  // During the boss fight the hero is driven ONLY by the fight — never the still-running farming
  // director. Otherwise the director's own attack ticks fire mid-trade (it keeps swinging at the
  // hidden ambient mobs) and the two schedules overlap, so it reads as both sides flailing at once
  // instead of taking clean turns. Between the fight's beats the hero holds a ready battle stance.
  const heroAnim = encounter ? (fight.heroAnim ?? HeroAnim.Farming) : scene.hero;

  return (
    <>
      {!encounter &&
        scene.mobs.map((m, i) => {
          if (m.gone) {
            return null;
          }
          return (
            <Monster key={i} scene={sceneInfo} anim={m.anim} hp={m.hpFraction} slot={i} />
          );
        })}
      {!encounter && <HitEffects effects={scene.effects} />}
      <HeroHits hits={encounter ? fight.heroHits : scene.heroHits} />
      <Hero
        line={line}
        tier={tier}
        branch={branch}
        anim={heroAnim}
        icon={icon}
        aura={state.cosmetics?.aura ?? null}
      />
      {state.cosmetics?.companion && (
        <CompanionSprite
          id={state.cosmetics.companion}
          facing={CompanionFacing.East}
          className="companion-actor companion-battle"
        />
      )}
      <FloatingText floaters={scene.floaters} />
      {encounter && (
        <BossEncounter encounter={encounter} theme={sceneInfo.theme} fight={fight} />
      )}
    </>
  );
};

export default BattleScene;
