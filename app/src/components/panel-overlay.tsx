import { useEffect } from "react";
import type { IState } from "../../../core/state";
import { PanelId } from "../panels";
import HeroPanel from "./hero-panel";
import ItemsPanel from "./items-panel";
import CodexPanel from "./codex-panel";
import TalentsPanel from "./talents-panel";

interface IProps {
  activePanel: PanelId | null;
  state: IState;
  onClose: () => void;
}

const TITLES: Record<PanelId, string> = {
  [PanelId.Hero]: "Hero",
  [PanelId.Talents]: "Talents",
  [PanelId.Items]: "Items",
  [PanelId.Codex]: "Codex",
};

const PanelOverlay = (props: IProps) => {
  const { activePanel, state, onClose } = props;

  useEffect(() => {
    if (!activePanel) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activePanel, onClose]);

  if (!activePanel) {
    return null;
  }

  return (
    <div className="panel-backdrop" onClick={onClose}>
      <div className="panel-window" onClick={e => e.stopPropagation()}>
        <div className="panel-titlebar">
          <span>{TITLES[activePanel]}</span>
          <button
            className="panel-close"
            type="button"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        {activePanel === PanelId.Hero ? <HeroPanel state={state} /> : null}
        {activePanel === PanelId.Items ? <ItemsPanel state={state} /> : null}
        {activePanel === PanelId.Codex ? <CodexPanel state={state} /> : null}
        {activePanel === PanelId.Talents ? <TalentsPanel state={state} /> : null}
      </div>
    </div>
  );
};

export default PanelOverlay;
