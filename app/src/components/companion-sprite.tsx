import type { CSSProperties } from "react";
import { companionFrames, CompanionFacing } from "../companion";
import { usePreloadFrames } from "../use-preload";
import SpriteFrames from "./sprite-frames";

interface IProps {
  id: string;
  facing: CompanionFacing;
  className: string;
  style?: CSSProperties;
}

const COMPANION_IDLE_FPS = 4;

const CompanionSprite = (props: IProps) => {
  const { id, facing, className, style } = props;
  const frames = companionFrames(id, facing);
  usePreloadFrames(frames);
  if (frames.length === 0) {
    return null;
  }
  return (
    <div className={className} aria-hidden="true" style={style}>
      <SpriteFrames frames={frames} fps={COMPANION_IDLE_FPS} playing={true} />
    </div>
  );
};

export default CompanionSprite;
