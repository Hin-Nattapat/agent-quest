import type { ITransport } from "./transport";
import { useGameState } from "./use-game-state";
import Hud from "./components/hud";

interface IProps {
  transport: ITransport;
}

const App = (props: IProps) => {
  const { transport } = props;
  const state = useGameState(transport);

  if (!state) {
    return <div className="loading">Connecting…</div>;
  }

  return <Hud state={state} />;
};

export default App;
