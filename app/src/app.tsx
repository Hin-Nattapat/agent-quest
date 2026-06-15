import type { ITransport } from "./transport";
import { useGameState } from "./use-game-state";
import { useActivity } from "./use-activity";
import SceneView from "./components/scene-view";

interface IProps {
  transport: ITransport;
}

const App = (props: IProps) => {
  const { transport } = props;
  const state = useGameState(transport);
  const activity = useActivity(state);

  if (!state) {
    return <div className="loading">Connecting…</div>;
  }

  return <SceneView state={state} activity={activity} dispatch={transport.send} />;
};

export default App;
