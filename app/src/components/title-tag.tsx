import type { IState } from "../../../core/state";
import { displayName, titleSuffix } from "../view";

interface IProps {
  state: IState;
}

const TitleTag = (props: IProps) => {
  const { state } = props;
  return (
    <span className="title-tag">
      {displayName(state)}
      {titleSuffix(state)}
    </span>
  );
};

export default TitleTag;
