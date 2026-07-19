import { REALM_UI } from "./realm-progress";
import type { IBestiaryState } from "../../../core/bestiary";

interface IProps {
  bestiary: IBestiaryState | undefined;
}

const BadgeMap = (props: IProps) => {
  const { bestiary } = props;
  const realms = bestiary?.realms ?? {};
  return (
    <div className="badge-map">
      {REALM_UI.map(u => {
        const r = realms[u.theme];
        if (r?.conquered) {
          return (
            <div key={u.theme} className="badge badge-conquered" title={u.label}>
              <span className="badge-icon">{u.icon}</span>
              <span className="badge-label">{u.label}</span>
            </div>
          );
        }
        if (r) {
          return (
            <div key={u.theme} className="badge badge-progress" title={u.label}>
              <span className="badge-icon">{u.icon}</span>
              <span className="badge-label">
                {r.encounters} · {r.boss_defeated}
              </span>
            </div>
          );
        }
        return (
          <div key={u.theme} className="badge badge-unknown">
            <span className="badge-icon">?</span>
          </div>
        );
      })}
    </div>
  );
};

export default BadgeMap;
