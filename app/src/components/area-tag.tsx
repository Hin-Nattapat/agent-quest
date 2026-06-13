interface IProps {
  label: string;
}

const AreaTag = (props: IProps) => {
  const { label } = props;
  return (
    <div className="area-tag">
      <span className="area-name">{label}</span>
    </div>
  );
};

export default AreaTag;
