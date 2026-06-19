import { ActivityState } from "../activity";
import { useWander } from "../use-wander";
import { useMeasuredSize } from "../use-measured-size";
import OverworldHero from "./overworld-hero";

interface IProps {
  line: string;
  tier: number;
  branch: string | null;
  activity: ActivityState;
}

const OverworldRoom = (props: IProps) => {
  const { line, tier, branch, activity } = props;
  const roaming = activity !== ActivityState.Rest;
  const resting = !roaming;
  const pose = useWander(roaming);
  const [roomRef, size] = useMeasuredSize<HTMLDivElement>();

  // Move the hero with a compositor transform (pixel coords) instead of left/top %, so the
  // pixel-art sprite is rasterized once and slid on the GPU. left/top motion re-samples the
  // scaled bitmap at a new subpixel offset every frame, which shimmers and reads as flicker.
  const xPx = Math.round((pose.xPct / 100) * size.w);
  const yPx = Math.round((pose.yPct / 100) * size.h);

  return (
    <div className="guild-room" ref={roomRef}>
      <div className="guild-floor" aria-hidden="true" />
      <div className="guild-rug" aria-hidden="true" />
      <div className="guild-banner" aria-hidden="true">
        🛡️
      </div>
      <div className="guild-table" aria-hidden="true" />
      <div className="guild-npc" aria-hidden="true">
        🧑‍🌾
      </div>
      <div className="guild-chest" aria-hidden="true">
        🧰
      </div>
      <OverworldHero
        line={line}
        tier={tier}
        branch={branch}
        facing={pose.facing}
        moving={pose.moving}
        xPx={xPx}
        yPx={yPx}
      />
      {resting && (
        <div
          className="guild-zzz"
          style={{ left: `${pose.xPct}%`, top: `${pose.yPct}%` }}
        >
          💤
        </div>
      )}
    </div>
  );
};

export default OverworldRoom;
