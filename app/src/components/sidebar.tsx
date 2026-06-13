import type { IState } from "../../../core/state";
import type { PanelId } from "../panels";
import ActivityLog from "./activity-log";
import NavBar from "./nav-bar";

interface IProps {
  state: IState;
  onOpen: (panel: PanelId) => void;
}

const Sidebar = (props: IProps) => {
  const { state, onOpen } = props;
  return (
    <div className="sidebar">
      <ActivityLog state={state} />
      <NavBar onOpen={onOpen} />
    </div>
  );
};

export default Sidebar;
