import type { IState } from "../../../core/state";
import { displayName, passiveMultiplier, xpPercent } from "../view";
import { heroSpriteSet } from "../sprites";
import { Facing } from "../facing";
import { assetUrl } from "../assets-base";

interface IProps {
  state: IState;
}

const PortraitFrame = (props: IProps) => {
  const { state } = props;
  const klass = state.class;
  const tier = klass?.tier ?? 0;
  const form = klass?.form ?? "Novice";
  const title = state.cosmetics?.title ?? null;
  const days = state.streak?.current_days ?? 0;
  const items = (state.inventory ?? []).length; // distinct loot owned
  const total = state.xp_in_level + state.xp_to_next;
  // Real class sprite (south/front-facing) instead of the mage emoji, matching the Hero panel.
  const set = klass?.line
    ? heroSpriteSet(klass.line, klass.tier, klass.branch)
    : undefined;
  const face = set?.idle[Facing.South];
  const faceStyle = face ? { backgroundImage: `url(${assetUrl(face)})` } : undefined;

  return (
    <div className="portrait-frame">
      <div className="portrait">
        <span
          className={`sprite portrait-face${face ? " has-art" : ""}`}
          style={faceStyle}
          aria-hidden="true"
        />
      </div>
      <div className="portrait-body">
        <div className="pf-top">
          <b className="pf-name">{displayName(state)}</b>
          <span className="pf-class">
            {form}
            {tier > 0 ? ` · T${tier}` : ""}
          </span>
        </div>
        {title ? <div className="pf-title">the {title}</div> : null}
        <div className="xp-row">
          <span className="lvl-tag">Lv.{state.level}</span>
          <div className="xpbar">
            <i style={{ width: `${xpPercent(state)}%` }} />
            <span>
              {state.xp_in_level} / {total}
            </span>
          </div>
        </div>
        <div className="pf-chips">
          {days > 0 ? <span className="chip chip-streak">🔥 {days}d</span> : null}
          <span className="chip chip-items">💎 {items}</span>
          <span className="chip chip-mult">{passiveMultiplier(state)}x</span>
        </div>
      </div>
    </div>
  );
};

export default PortraitFrame;
