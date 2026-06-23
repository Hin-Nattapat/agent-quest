import { assetUrl } from "../assets-base";
import { useSpriteIndex } from "../use-sprite-frame";

interface IProps {
  frames: string[];
  fps: number;
  playing: boolean;
}

// Stacked animation frames inside a positioned sprite host. Every frame is its own layer with a
// fixed background-image (decoded once at mount), and only `opacity` flips between them — so the
// webview never re-decodes/re-uploads a background-image mid-cycle, which is what read as flicker.
const SpriteFrames = (props: IProps) => {
  const { frames, fps, playing } = props;
  const active = useSpriteIndex(frames.length, fps, playing);

  if (frames.length === 0) {
    return null;
  }
  return (
    <>
      {frames.map((url, i) => (
        <span
          key={url}
          className="sprite-frame"
          aria-hidden="true"
          style={{
            backgroundImage: `url(${assetUrl(url)})`,
            opacity: i === active ? 1 : 0,
          }}
        />
      ))}
    </>
  );
};

export default SpriteFrames;
