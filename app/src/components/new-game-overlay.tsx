import { useState } from "react";
import type { IState } from "../../../core/state";
import { ActionType, ClientActionName, type TClientAction } from "../actions";
import { assetUrl } from "../assets-base";

// CSS url() can't resolve under the VS Code webview base, so the BG image goes through assetUrl on an
// inline style (same as the scene backgrounds); the CSS gradient is the fallback behind it.
const bgStyle = { backgroundImage: `url(${assetUrl("/splash.png")})` };

interface IProps {
  state: IState;
  dispatch: (action: TClientAction) => void;
  onStart: () => void;
}

// Title screen shown on every panel open (the `started` flag lives in app.tsx, per session). The
// splash.png already carries the "Agent Quest" logo, so the splash stage is just the Start button
// over the art; a nameless player then gets a name step (its own scrim + UI for legibility).
const NewGameOverlay = (props: IProps) => {
  const { state, dispatch, onStart } = props;
  const [stage, setStage] = useState<"splash" | "name">("splash");
  const [value, setValue] = useState("");

  const start = () => {
    if (state.name) {
      onStart();
    } else {
      setStage("name");
    }
  };
  const begin = () => {
    const name = value.trim();
    if (!name) {
      return;
    }
    dispatch({
      type: ActionType.Action,
      name: ClientActionName.SetName,
      value: name,
    });
    onStart();
  };

  if (stage === "splash") {
    return (
      <div className="new-game ng-splash">
        <div className="ng-bg" aria-hidden="true" style={bgStyle} />
        <button type="button" className="ng-action ng-start" onClick={start}>
          Start Game
        </button>
      </div>
    );
  }

  return (
    <div className="new-game ng-named">
      <div className="ng-bg" aria-hidden="true" style={bgStyle} />
      <div className="ng-scrim" aria-hidden="true" />
      <div className="ng-inner">
        <h1 className="ng-title">Name your adventurer</h1>
        <input
          className="ng-input"
          type="text"
          maxLength={24}
          autoFocus
          value={value}
          placeholder="Adventurer"
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter") {
              begin();
            }
          }}
        />
        <button
          type="button"
          className="ng-action"
          disabled={value.trim().length === 0}
          onClick={begin}
        >
          Begin Quest
        </button>
      </div>
    </div>
  );
};

export default NewGameOverlay;
