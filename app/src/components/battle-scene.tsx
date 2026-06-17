import type { IState } from "../../../core/state";
import type { IScene } from "../scene";
import { ActivityState } from "../activity";
import { useEncounter } from "../use-encounter";
import { useSceneDirector } from "../use-scene-director";
import Hero from "./hero";
import Monster from "./monster";
import HitEffects from "./hit-effect";
import BossEncounter from "./boss-encounter";
import FloatingText from "./floating-text";

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
  const encounter = useEncounter(state);
  const scene = useSceneDirector(state, activity);
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
      <Hero line={line} tier={tier} branch={branch} anim={scene.hero} />
      <FloatingText floaters={scene.floaters} />
      {encounter && <BossEncounter encounter={encounter} />}
    </>
  );
};

export default BattleScene;
