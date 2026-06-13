import { useState } from "react";
import type { IState } from "../../../core/state";
import { sceneFor } from "../scene";
import { ActivityState } from "../activity";
import { PanelId } from "../panels";
import { useEncounter } from "../use-encounter";
import { useCombat } from "../use-combat";
import Hero from "./hero";
import Monster from "./monster";
import BossEncounter from "./boss-encounter";
import PortraitFrame from "./portrait-frame";
import AreaTag from "./area-tag";
import ActivityBar from "./activity-bar";
import FloatingText from "./floating-text";
import PanelOverlay from "./panel-overlay";
import Sidebar from "./sidebar";

interface IProps {
  state: IState;
  activity: ActivityState;
}

const SceneView = (props: IProps) => {
  const { state, activity } = props;
  const [panel, setPanel] = useState<PanelId | null>(null);
  const encounter = useEncounter(state);
  const combat = useCombat(state, activity);
  const scene = sceneFor(state.class?.tier ?? 0);
  const line = state.class?.line ?? "novice";

  return (
    <div className="companion">
      <div className={`scene scene-${scene.theme}`}>
        <div className="sky" aria-hidden="true" />
        {activity !== ActivityState.Rest && !encounter && (
          <Monster scene={scene} anim={combat.monster} hp={combat.hpFraction} />
        )}
        <Hero line={line} anim={combat.hero} />
        <FloatingText floaters={combat.floaters} />
        {encounter && <BossEncounter encounter={encounter} />}
        <PortraitFrame state={state} />
        <AreaTag label={scene.label} />
        <ActivityBar activity={activity} />
        <PanelOverlay activePanel={panel} state={state} onClose={() => setPanel(null)} />
      </div>
      <Sidebar state={state} onOpen={setPanel} />
    </div>
  );
};

export default SceneView;
