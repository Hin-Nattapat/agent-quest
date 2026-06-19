interface IProps {
  items: string[];
}

const LootToast = (props: IProps) => {
  const { items } = props;
  if (items.length === 0) {
    return null;
  }
  return (
    <div className="loot-toast">
      {items.map((id, i) => (
        <span key={`${id}-${i}`} className="loot-item">
          🎁 {id}
        </span>
      ))}
    </div>
  );
};

export default LootToast;
