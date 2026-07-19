import WeekCard from "./week-card";
import type { IState } from "../../../core/state";

interface IProps {
  state: IState;
}

const ChroniclePanel = (props: IProps) => {
  const { state } = props;
  const weeks = state.chronicle?.weeks ?? [];
  if (weeks.length === 0) {
    return (
      <div className="panel-body">
        <div className="panel-empty">No chronicle yet…</div>
      </div>
    );
  }
  return (
    <div className="panel-body chronicle-panel">
      {weeks.map((w, i) => (
        <WeekCard key={w.week} week={w} hero={i === 0} />
      ))}
    </div>
  );
};

export default ChroniclePanel;
