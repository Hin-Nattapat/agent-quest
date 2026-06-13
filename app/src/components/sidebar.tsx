import type { IState } from "../../../core/state";
import ActivityLog from "./activity-log";
import NavBar from "./nav-bar";

interface IProps {
  state: IState;
}

const Sidebar = (props: IProps) => {
  const { state } = props;
  return (
    <div className="sidebar">
      <ActivityLog state={state} />
      <NavBar />
    </div>
  );
};

export default Sidebar;
