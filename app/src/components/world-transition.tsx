interface IProps {
  active: boolean;
  label: string | null;
}

const WorldTransition = (props: IProps) => {
  const { active, label } = props;
  if (!active) {
    return null;
  }
  return (
    <div className="world-transition" aria-hidden="true">
      <div className="world-banner">
        <span className="world-eyebrow">Now Entering</span>
        <span className="world-realm">{label}</span>
      </div>
    </div>
  );
};

export default WorldTransition;
