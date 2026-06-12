import type { IState } from "../../../core/state";
import { xpPercent } from "../view";

interface IProps {
  state: IState;
}

const XpBar = (props: IProps) => {
  const { state } = props;
  const pct = xpPercent(state);
  const atMax = state.xp_to_next <= 0;

  return (
    <div className="xp-bar" role="progressbar" aria-valuenow={pct}>
      <div className="xp-bar-fill" style={{ width: `${pct}%` }} />
      <span className="xp-bar-label">{atMax ? "MAX" : `${pct}%`}</span>
    </div>
  );
};

export default XpBar;
