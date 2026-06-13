import { ActivityState } from "../activity";

interface IProps {
  activity: ActivityState;
}

const LABELS: Record<ActivityState, string> = {
  [ActivityState.Farming]: "Farming",
  [ActivityState.Idle]: "Idle",
  [ActivityState.Rest]: "Resting",
};

const ActivityBar = (props: IProps) => {
  const { activity } = props;
  return (
    <div className={`activity-bar activity-${activity}`}>
      <span className="activity-dot" /> Currently: {LABELS[activity]}
    </div>
  );
};

export default ActivityBar;
