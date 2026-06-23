import { npcFrames } from "../overworld-bg";
import { usePreloadFrames } from "../use-preload";
import SpriteFrames from "./sprite-frames";

interface IProps {
  id: string;
  emoji: string;
  xPct: number;
  yPct: number;
}

const NPC_IDLE_FPS = 4;

const GuildNpc = (props: IProps) => {
  const { id, emoji, xPct, yPct } = props;
  const frames = npcFrames(id);
  usePreloadFrames(frames);
  const style = {
    left: `${xPct}%`,
    top: `${yPct}%`,
  };
  return (
    <div className="guild-npc-actor" aria-hidden="true" style={style}>
      <SpriteFrames frames={frames} fps={NPC_IDLE_FPS} playing={true} />
      {frames.length > 0 ? null : emoji}
    </div>
  );
};

export default GuildNpc;
