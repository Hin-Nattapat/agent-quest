import type { IState } from "../../../core/state";
import TitleTag from "./title-tag";
import ClassBadge from "./class-badge";
import XpBar from "./xp-bar";
import StreakBadge from "./streak-badge";
import AchievementCount from "./achievement-count";

interface IProps {
  state: IState;
}

const Hud = (props: IProps) => {
  const { state } = props;

  return (
    <div className="hud">
      <header className="hud-head">
        <TitleTag state={state} />
        <ClassBadge state={state} />
      </header>
      <div className="hud-level">Lv.{state.level}</div>
      <XpBar state={state} />
      <footer className="hud-meta">
        <StreakBadge state={state} />
        <AchievementCount state={state} />
      </footer>
    </div>
  );
};

export default Hud;
