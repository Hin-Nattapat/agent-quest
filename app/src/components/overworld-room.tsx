import { ActivityState } from "../activity";
import { SceneTheme } from "../scene";
import { hasOverworldBg } from "../overworld-bg";
import { assetUrl } from "../assets-base";
import { useWander } from "../use-wander";
import { useMeasuredSize } from "../use-measured-size";
import OverworldHero from "./overworld-hero";
import GuildNpc from "./guild-npc";

// Decorative guild NPCs standing on the open floor in % of the locked stage. Each shows its imported
// south-facing idle loop when present, else the emoji placeholder behind the same seam.
// Staggered in y (depth) as well as x so they don't line up on one plane — top-down reads y as depth.
const GUILD_NPCS = [
  { id: "elder", emoji: "🧙‍♂️", xPct: 52, yPct: 57 },
  { id: "smith", emoji: "🧝", xPct: 22, yPct: 78 },
  { id: "ranger", emoji: "🧑‍🌾", xPct: 80, yPct: 66 },
];

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
  const [areaRef, size] = useMeasuredSize<HTMLDivElement>();

  const hasArt = hasOverworldBg(SceneTheme.Guild);

  // Move the hero with a compositor transform (pixel coords) instead of left/top %, so the
  // pixel-art sprite is rasterized once and slid on the GPU. left/top motion re-samples the
  // scaled bitmap at a new subpixel offset every frame, which shimmers and reads as flicker.
  // The coords are relative to the measured area — the locked .guild-stage when art is present
  // (so the wander % maps to fixed floor positions on the map), else the full room.
  const xPx = Math.round((pose.xPct / 100) * size.w);
  const yPx = Math.round((pose.yPct / 100) * size.h);

  const hero = (
    <OverworldHero
      line={line}
      tier={tier}
      branch={branch}
      facing={pose.facing}
      moving={pose.moving}
      xPx={xPx}
      yPx={yPx}
    />
  );
  const zzz = resting ? (
    <div className="guild-zzz" style={{ left: `${pose.xPct}%`, top: `${pose.yPct}%` }}>
      💤
    </div>
  ) : null;

  if (hasArt) {
    return (
      <div className="guild-room has-art">
        <div className="guild-stage" ref={areaRef}>
          <div
            className="guild-bg"
            aria-hidden="true"
            style={{ backgroundImage: `url(${assetUrl("/overworld/guild.png")})` }}
          />
          {GUILD_NPCS.map(npc => (
            <GuildNpc
              key={npc.id}
              id={npc.id}
              emoji={npc.emoji}
              xPct={npc.xPct}
              yPct={npc.yPct}
            />
          ))}
          {hero}
          {zzz}
        </div>
      </div>
    );
  }

  return (
    <div className="guild-room" ref={areaRef}>
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
      {hero}
      {zzz}
    </div>
  );
};

export default OverworldRoom;
