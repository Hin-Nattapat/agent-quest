import type { IState } from "../../../core/state";
import { sceneFor } from "../scene";
import { ActivityState } from "../activity";
import Hero from "./hero";
import Monster from "./monster";
import Hud from "./hud";

interface IProps {
  state: IState;
  activity: ActivityState;
}

const SceneView = (props: IProps) => {
  const { state, activity } = props;
  const scene = sceneFor(state.class?.tier ?? 0);
  const line = state.class?.line ?? "novice";

  return (
    <div className={`scene scene-${scene.theme}`}>
      {activity !== ActivityState.Rest && <Monster scene={scene} />}
      <Hero line={line} activity={activity} />
      <div className="scene-hud">
        <Hud state={state} />
      </div>
    </div>
  );
};

export default SceneView;
