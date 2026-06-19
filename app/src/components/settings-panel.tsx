import { useReduceMotion } from "../use-reduce-motion";

const SettingsPanel = () => {
  const [reduceMotion, toggleMotion] = useReduceMotion();

  return (
    <div className="panel-body settings-panel">
      <div className="panel-head">⚙ Display</div>
      <ul className="settings-list">
        <li className="settings-row">
          <span className="settings-label">Reduce motion</span>
          <button
            type="button"
            className={`toggle ${reduceMotion ? "on" : "off"}`}
            onClick={toggleMotion}
            aria-pressed={reduceMotion}
          >
            {reduceMotion ? "On" : "Off"}
          </button>
        </li>
        <li className="settings-row settings-disabled">
          <span className="settings-label">Mute sounds</span>
          <span className="settings-soon">soon</span>
        </li>
      </ul>
      <div className="panel-empty">More settings coming soon…</div>
    </div>
  );
};

export default SettingsPanel;
