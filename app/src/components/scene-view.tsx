import { useState } from "react";
import type { IState } from "../../../core/state";
import type { TClientAction } from "../actions";
import { sceneNow } from "../scene-place";
import { ActivityState } from "../activity";
import { PanelId } from "../panels";
import { useEncounter } from "../use-encounter";
import { useSceneDirector } from "../use-scene-director";
import { useTransition } from "../use-transition";
import Hero from "./hero";
import Monster from "./monster";
import HitEffects from "./hit-effect";
import WorldTransition from "./world-transition";
import BossEncounter from "./boss-encounter";
import PortraitFrame from "./portrait-frame";
import AreaTag from "./area-tag";
import MetaMenu from "./meta-menu";
import ActivityBar from "./activity-bar";
import FloatingText from "./floating-text";
import PanelOverlay from "./panel-overlay";
import Sidebar from "./sidebar";

interface IProps {
  state: IState;
  activity: ActivityState;
  dispatch: (action: TClientAction) => void;
}

const SceneView = (props: IProps) => {
  const { state, activity, dispatch } = props;
  const [panel, setPanel] = useState<PanelId | null>(null);
  const encounter = useEncounter(state);
  const scene = useSceneDirector(state, activity);
  const sceneInfo = sceneNow({
    activity,
    lastEvent: state.last_event,
    tier: state.class?.tier ?? 0,
    line: state.class?.line,
    branch: state.class?.branch,
  });
  const transition = useTransition(sceneInfo);
  const line = state.class?.line ?? "novice";

  return (
    <div className="companion">
      <div className={`scene scene-${sceneInfo.theme}`}>
        <div className="sky" aria-hidden="true" />
        {!encounter &&
          scene.mobs.map((m, i) => {
            if (m.gone) {
              return null;
            }
            return (
              <Monster
                key={i}
                scene={sceneInfo}
                anim={m.anim}
                hp={m.hpFraction}
                slot={i}
              />
            );
          })}
        {!encounter && <HitEffects effects={scene.effects} />}
        <Hero line={line} tier={state.class?.tier ?? 0} anim={scene.hero} />
        <FloatingText floaters={scene.floaters} />
        {encounter && <BossEncounter encounter={encounter} />}
        <PortraitFrame state={state} />
        <AreaTag label={sceneInfo.label} />
        <MetaMenu onOpen={setPanel} />
        <ActivityBar activity={activity} />
        <PanelOverlay
          activePanel={panel}
          state={state}
          onClose={() => setPanel(null)}
          dispatch={dispatch}
        />
        <WorldTransition active={transition.active} label={transition.label} />
      </div>
      <Sidebar state={state} onOpen={setPanel} />
    </div>
  );
};

export default SceneView;
