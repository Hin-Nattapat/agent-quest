import { useState } from "react";
import type { IState } from "../../../core/state";
import { CodexTab } from "../codex/realm-progress";
import RealmsTab from "../codex/realms-tab";

interface IProps {
  state: IState;
}

const CodexPanel = (props: IProps) => {
  const { state } = props;
  const [tab, setTab] = useState<CodexTab>(CodexTab.Deeds);
  const ach = state.achievements;
  const earned = ach?.earned_detail ?? [];
  const locked = ach?.locked ?? [];
  const secret = ach?.secret ?? 0;
  const total = ach?.total ?? earned.length;
  const nothing = earned.length === 0 && locked.length === 0 && secret === 0;

  return (
    <div className="panel-body codex-panel">
      <div className="codex-tabs">
        <button
          type="button"
          className={`codex-tab${tab === CodexTab.Deeds ? " active" : ""}`}
          onClick={() => setTab(CodexTab.Deeds)}
        >
          Deeds
        </button>
        <button
          type="button"
          className={`codex-tab${tab === CodexTab.Realms ? " active" : ""}`}
          onClick={() => setTab(CodexTab.Realms)}
        >
          Realms
        </button>
      </div>
      {tab === CodexTab.Realms ? (
        <RealmsTab bestiary={state.bestiary} />
      ) : (
        <>
          <div className="panel-head">
            Deeds · {earned.length} / {total} · {ach?.points ?? 0} pts
          </div>
          {nothing ? (
            <div className="panel-empty">No deeds yet…</div>
          ) : (
            <ul className="deed-list">
              {earned.map(d => (
                <li key={d.id} className="deed-row">
                  <div className="deed-top">
                    <b className="deed-name">{d.name}</b>
                    <span className="deed-pts">{d.points} pts</span>
                  </div>
                  <div className="deed-desc">{d.desc}</div>
                </li>
              ))}
              {/* Visible goals: show the criteria so the player knows what to chase next. */}
              {locked.map(d => (
                <li key={d.id} className="deed-row deed-todo">
                  <div className="deed-top">
                    <b className="deed-name">🔒 {d.name}</b>
                    <span className="deed-pts">{d.points} pts</span>
                  </div>
                  <div className="deed-desc">{d.desc}</div>
                </li>
              ))}
              {secret > 0 ? (
                <li className="deed-row deed-locked">??? · {secret} secret</li>
              ) : null}
            </ul>
          )}
        </>
      )}
    </div>
  );
};

export default CodexPanel;
