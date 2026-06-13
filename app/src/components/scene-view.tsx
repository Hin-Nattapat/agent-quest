import type { IState } from "../../../core/state";
import { sceneFor } from "../scene";
import { ActivityState } from "../activity";
import { useEncounter } from "../use-encounter";
import Hero from "./hero";
import Monster from "./monster";
import BossEncounter from "./boss-encounter";
import Hud from "./hud";

interface IProps {
  state: IState;
  activity: ActivityState;
}

const SceneView = (props: IProps) => {
  const { state, activity } = props;
  const encounter = useEncounter(state);
  const scene = sceneFor(state.class?.tier ?? 0);
  const line = state.class?.line ?? "novice";

  return (
    <div className={`scene scene-${scene.theme}`}>
      {activity !== ActivityState.Rest && <Monster scene={scene} />}
      <Hero line={line} activity={activity} />
      {encounter && <BossEncounter encounter={encounter} />}
      <div className="scene-hud">
        <Hud state={state} />
      </div>
    </div>
  );
};

export default SceneView;
