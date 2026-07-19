import { weekRangeLabel, levelLabel } from "./chronicle-view";
import { REALM_UI } from "../codex/realm-progress";
import { assetUrl } from "../assets-base";
import type { IChronicleWeek } from "../../../core/chronicle";

interface IProps {
  week: IChronicleWeek;
  hero: boolean; // the current week renders large
}

const WeekCard = (props: IProps) => {
  const { week, hero } = props;
  const realm = week.top_realm ? REALM_UI.find(u => u.theme === week.top_realm) : null;
  return (
    <div className={`week-card${hero ? " week-card-hero" : ""}`}>
      <div className="wc-head">
        <b>{week.week.split("-")[1]}</b>
        <span>{weekRangeLabel(week.start)}</span>
        <span className="wc-levels">{levelLabel(week)}</span>
      </div>
      <div className="wc-stats">
        <span>⚡ {week.xp} XP</span>
        <span>⚔ {week.actions} fights</span>
        <span>👑 {week.bosses_defeated} bosses</span>
        <span>📅 {week.active_days} days</span>
      </div>
      {realm ? (
        <div className="wc-realm">
          <img
            className="wc-boss"
            src={assetUrl(`/sprites/boss/${realm.theme}/idle/0.png`)}
            alt=""
            aria-hidden="true"
          />
          <span>{realm.label}</span>
          {week.busiest_day ? (
            <span className="wc-peak">
              peak {week.busiest_day.date.slice(5)} +{week.busiest_day.xp}xp
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

export default WeekCard;
