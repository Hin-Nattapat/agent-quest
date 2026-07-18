import { useState } from "react";
import type { IState } from "../../../core/state";
import type { TClientAction } from "../actions";
import { sceneNow } from "../scene-place";
import { ActivityState } from "../activity";
import { PanelId } from "../panels";
import { SceneMode, sceneModeFor } from "../scene-mode";
import { bannerScene } from "../scene-banner";
import { useTransition } from "../use-transition";
import BattleScene from "./battle-scene";
import OverworldRoom from "./overworld-room";
import WorldTransition from "./world-transition";
import PortraitFrame from "./portrait-frame";
import AreaTag from "./area-tag";
import MetaMenu from "./meta-menu";
import ActivityBar from "./activity-bar";
import PanelOverlay from "./panel-overlay";
import Sidebar from "./sidebar";
import { hasSceneBg } from "../scene-bg";
import { assetUrl } from "../assets-base";

interface IProps {
  state: IState;
  activity: ActivityState;
  dispatch: (action: TClientAction) => void;
}

const SceneView = (props: IProps) => {
  const { state, activity, dispatch } = props;
  const [panel, setPanel] = useState<PanelId | null>(null);
  const sceneInfo = sceneNow({
    activity,
    lastEvent: state.last_event,
    tier: state.class?.tier ?? 0,
    line: state.class?.line,
    branch: state.class?.branch,
  });
  const mode = sceneModeFor(activity);
  const transition = useTransition(bannerScene(mode, sceneInfo.theme));
  const line = state.class?.line ?? "novice";
  const tier = state.class?.tier ?? 0;
  const branch = state.class?.branch ?? null;
  const icon = state.class?.icon || "🧙";
  const sceneClass =
    mode === SceneMode.Battle ? `scene scene-${sceneInfo.theme}` : "scene scene-guild";

  return (
    <div className="companion">
      <div className={sceneClass}>
        <div className="sky" aria-hidden="true" />
        {mode === SceneMode.Battle && (
          <div className="battle-frame">
            <div className="battle-stage">
              {hasSceneBg(sceneInfo.theme) && (
                <div
                  className="scene-bg"
                  aria-hidden="true"
                  style={{
                    backgroundImage: `url(${assetUrl(`/scenes/${sceneInfo.theme}.png`)})`,
                  }}
                />
              )}
              <BattleScene
                state={state}
                activity={activity}
                sceneInfo={sceneInfo}
                line={line}
                tier={tier}
                branch={branch}
              />
            </div>
          </div>
        )}
        {mode === SceneMode.Overworld && (
          <OverworldRoom
            line={line}
            tier={tier}
            branch={branch}
            activity={activity}
            icon={icon}
            companion={state.cosmetics?.companion ?? null}
          />
        )}
        <PortraitFrame state={state} />
        <AreaTag label={mode === SceneMode.Battle ? sceneInfo.label : "Guild Hall"} />
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
