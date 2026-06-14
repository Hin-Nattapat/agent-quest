import type { IFloater } from "../use-scene-director";

interface IProps {
  floaters: IFloater[];
}

const FloatingText = (props: IProps) => {
  const { floaters } = props;
  return (
    <div className="floaters" aria-hidden="true">
      {floaters.map(f => (
        <span key={f.id} className={`floater floater-${f.kind}`}>
          {f.text}
        </span>
      ))}
    </div>
  );
};

export default FloatingText;
