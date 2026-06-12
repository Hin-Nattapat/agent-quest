import type { IState } from "../../../core/state";
import { streakText } from "../view";

interface IProps {
  state: IState;
}

const StreakBadge = (props: IProps) => {
  const { state } = props;
  const text = streakText(state);
  if (!text) {
    return null;
  }
  return <span className="streak-badge">{text}</span>;
};

export default StreakBadge;
