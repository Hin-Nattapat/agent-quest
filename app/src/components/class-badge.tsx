import type { IState } from "../../../core/state";
import { classLabel } from "../view";

interface IProps {
  state: IState;
}

const ClassBadge = (props: IProps) => {
  const { state } = props;
  return <span className="class-badge">{classLabel(state)}</span>;
};

export default ClassBadge;
