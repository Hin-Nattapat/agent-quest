import { npcFrames } from "../overworld-bg";
import { useSpriteFrame } from "../use-sprite-frame";
import { usePreloadFrames } from "../use-preload";
import { spriteStyle } from "../view";

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
  const frame = useSpriteFrame(frames, NPC_IDLE_FPS, true);
  const style = {
    left: `${xPct}%`,
    top: `${yPct}%`,
    ...spriteStyle(frame),
  };
  return (
    <div className="guild-npc-actor" aria-hidden="true" style={style}>
      {frame ? null : emoji}
    </div>
  );
};

export default GuildNpc;
