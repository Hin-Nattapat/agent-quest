import type { IState } from "../../../core/state";
import { formatTimeline } from "../view";

interface IProps {
  state: IState;
}

const ActivityLog = (props: IProps) => {
  const { state } = props;
  const entries = state.recent ?? [];

  return (
    <div className="activity-log panel">
      <div className="log-head">Activity Log</div>
      {entries.length === 0 ? (
        <div className="log-empty">No deeds yet…</div>
      ) : (
        <ul className="log-list">
          {entries
            .slice()
            .reverse()
            .map((entry, i) => {
              const f = formatTimeline(entry);
              return (
                <li key={i} className={`log-row tone-${f.tone}`}>
                  <span className="log-dot" />
                  <span className="log-label">{f.label}</span>
                  <span className="log-tag">{f.tag}</span>
                </li>
              );
            })}
        </ul>
      )}
    </div>
  );
};

export default ActivityLog;
