import type { IState } from "../../../core/state";

interface IProps {
  state: IState;
}

const AchievementCount = (props: IProps) => {
  const { state } = props;
  const earned = state.achievements?.earned.length ?? 0;
  const points = state.achievements?.points ?? 0;
  return (
    <span className="achievement-count">
      🏆 {earned} ({points} pts)
    </span>
  );
};

export default AchievementCount;
