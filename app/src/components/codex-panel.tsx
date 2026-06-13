import type { IState } from "../../../core/state";

interface IProps {
  state: IState;
}

const CodexPanel = (props: IProps) => {
  const { state } = props;
  const ach = state.achievements;
  const earned = ach?.earned_detail ?? [];
  const total = ach?.total ?? earned.length;
  const locked = Math.max(0, total - earned.length);

  return (
    <div className="panel-body codex-panel">
      <div className="panel-head">
        Deeds · {earned.length} / {total} · {ach?.points ?? 0} pts
      </div>
      {earned.length === 0 ? (
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
          {locked > 0 ? (
            <li className="deed-row deed-locked">??? · {locked} hidden</li>
          ) : null}
        </ul>
      )}
    </div>
  );
};

export default CodexPanel;
