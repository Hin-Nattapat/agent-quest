import { useState } from "react";

const MOTION_KEY = "cq.reduceMotion";

const readReduceMotion = (): boolean => {
  try {
    return localStorage.getItem(MOTION_KEY) === "1";
  } catch {
    return false; // webview without storage: just don't persist
  }
};

const SettingsPanel = () => {
  const [reduceMotion, setReduceMotion] = useState(readReduceMotion);

  const toggleMotion = () => {
    const next = !reduceMotion;
    setReduceMotion(next);
    try {
      localStorage.setItem(MOTION_KEY, next ? "1" : "0");
    } catch {
      // ignore: persistence is best-effort
    }
    document.body.classList.toggle("reduce-motion", next);
  };

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
