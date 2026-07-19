import type { IState } from "../../../core/state";
import { displayName, passiveMultiplier, xpPercent, spriteStyle } from "../view";
import { sourceLabel } from "../../../core/events";
import { heroPortrait } from "../sprites";
import { paragonBar } from "../paragon/paragon-view";

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
  const face = heroPortrait(klass);
  const frame = state.cosmetics?.frame ?? null;
  const pBar = paragonBar(state.xp_to_next, state.paragon);

  return (
    <div className={`portrait-frame${frame ? ` frame-${frame}` : ""}`}>
      <div className="portrait">
        <span
          className={`sprite portrait-face${face ? " has-art" : ""}`}
          style={spriteStyle(face)}
          data-emoji={klass?.icon || "🧙"}
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
          <span className="lvl-tag">
            Lv.{state.level}
            {pBar ? <b className="pf-paragon"> {pBar.badge}</b> : null}
          </span>
          <div className="xpbar">
            <i style={{ width: `${pBar ? pBar.pct : xpPercent(state)}%` }} />
            <span>{pBar ? pBar.label : `${state.xp_in_level} / ${total}`}</span>
          </div>
        </div>
        <div className="pf-chips">
          {days > 0 ? <span className="chip chip-streak">🔥 {days}d</span> : null}
          <span className="chip chip-items">💎 {items}</span>
          <span className="chip chip-mult">{passiveMultiplier(state)}x</span>
          {Object.keys(state.stats.by_source).length >= 2 && state.last_event?.source ? (
            <span className="chip chip-source">
              via {sourceLabel(state.last_event.source)}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default PortraitFrame;
