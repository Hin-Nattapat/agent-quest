import type { IState } from "../../../core/state";

interface IProps {
  state: IState;
}

const KIND_ICON: Record<string, string> = { title: "👑", theme: "🎨", skin: "👕" };

const ItemsPanel = (props: IProps) => {
  const { state } = props;
  const inv = state.inventory ?? [];

  return (
    <div className="panel-body items-panel">
      <div className="panel-head">Inventory · {inv.length} items</div>
      {inv.length === 0 ? (
        <div className="panel-empty">No loot yet…</div>
      ) : (
        <div className="item-grid">
          {inv.map(item => (
            <div
              key={item.id}
              className={`item-slot rarity-${item.rarity}${item.equipped ? " equipped" : ""}`}
            >
              <span className="item-icon">{KIND_ICON[item.kind ?? "title"] ?? "❔"}</span>
              <span className="item-count">×{item.count}</span>
              <span className="item-name">{item.name ?? item.id}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ItemsPanel;
