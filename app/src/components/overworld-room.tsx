import { ActivityState } from "../activity";
import { useWander } from "../use-wander";
import OverworldHero from "./overworld-hero";

interface IProps {
  line: string;
  tier: number;
  activity: ActivityState;
}

const OverworldRoom = (props: IProps) => {
  const { line, tier, activity } = props;
  const roaming = activity !== ActivityState.Rest;
  const pose = useWander(roaming);
  const resting = activity === ActivityState.Rest;
  return (
    <div className="guild-room">
      <div className="guild-floor" aria-hidden="true" />
      <div className="guild-rug" aria-hidden="true" />
      <div className="guild-banner" aria-hidden="true">🛡️</div>
      <div className="guild-table" aria-hidden="true" />
      <div className="guild-npc" aria-hidden="true">🧑‍🌾</div>
      <div className="guild-chest" aria-hidden="true">🧰</div>
      <OverworldHero
        line={line}
        tier={tier}
        facing={pose.facing}
        moving={pose.moving}
        xPct={pose.xPct}
        yPct={pose.yPct}
      />
      {resting && (
        <div className="guild-zzz" style={{ left: `${pose.xPct}%`, top: `${pose.yPct}%` }}>
          💤
        </div>
      )}
    </div>
  );
};

export default OverworldRoom;
