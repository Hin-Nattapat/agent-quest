import { assetUrl } from "../assets-base";
import { realmRows } from "./realm-progress";
import type { IBestiaryState } from "../../../core/bestiary";

interface IProps {
  bestiary: IBestiaryState | undefined;
}

const BestiaryList = (props: IProps) => {
  const { bestiary } = props;
  const rows = realmRows(bestiary);
  if (rows.discovered.length === 0) {
    return <div className="panel-empty">No realms discovered yet…</div>;
  }
  return (
    <ul className="bestiary-list">
      {rows.discovered.map(r => (
        <li key={r.theme} className="bestiary-row">
          <img
            className="bestiary-sprite"
            src={assetUrl(`/sprites/monsters/${r.theme}/idle/0.png`)}
            alt=""
            aria-hidden="true"
          />
          <img
            className="bestiary-sprite bestiary-boss"
            src={assetUrl(`/sprites/boss/${r.theme}/idle/0.png`)}
            alt=""
            aria-hidden="true"
          />
          <span className="bestiary-name">{r.label}</span>
          <span className="bestiary-counts">
            {r.encounters} fights · {r.boss_defeated} bosses{r.conquered ? " · ✦" : ""}
          </span>
        </li>
      ))}
      {rows.undiscovered > 0 ? (
        <li className="bestiary-row bestiary-unknown">
          ??? · {rows.undiscovered} undiscovered
        </li>
      ) : null}
    </ul>
  );
};

export default BestiaryList;
