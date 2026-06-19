import { useState } from "react";
import type { ITransport } from "./transport";
import { useGameState } from "./use-game-state";
import { useActivity } from "./use-activity";
import NewGameOverlay from "./components/new-game-overlay";
import SceneView from "./components/scene-view";

interface IProps {
  transport: ITransport;
}

const App = (props: IProps) => {
  const { transport } = props;
  const state = useGameState(transport);
  const activity = useActivity(state);
  const [started, setStarted] = useState(false);

  if (!state) {
    return <div className="loading">Connecting…</div>;
  }
  if (!started) {
    return (
      <NewGameOverlay
        state={state}
        dispatch={transport.send}
        onStart={() => setStarted(true)}
      />
    );
  }
  return <SceneView state={state} activity={activity} dispatch={transport.send} />;
};

export default App;
