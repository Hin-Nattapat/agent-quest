import BadgeMap from "./badge-map";
import BestiaryList from "./bestiary-list";
import type { IBestiaryState } from "../../../core/bestiary";

interface IProps {
  bestiary: IBestiaryState | undefined;
}

const RealmsTab = (props: IProps) => {
  const { bestiary } = props;
  const conquered = bestiary?.conquered.length ?? 0;
  return (
    <>
      <div className="panel-head">
        Realm Conquest · {conquered} / {bestiary?.total ?? 16}
      </div>
      <BadgeMap bestiary={bestiary} />
      <BestiaryList bestiary={bestiary} />
    </>
  );
};

export default RealmsTab;
