import type { IState } from "../../../core/state";
import { EquipKind, type TClientAction } from "../actions";

interface IProps {
  state: IState;
  dispatch: (action: TClientAction) => void;
}

const KIND_ICON: Record<string, string> = {
  title: "👑",
  theme: "🎨",
  skin: "👕",
  name_color: "✒️",
};

// Inventory title/theme items are equippable; skins have no equip path in core.
const equipKindOf = (kind: string | undefined): EquipKind | null => {
  if (kind === "title") {
    return EquipKind.Title;
  }
  if (kind === "theme") {
    return EquipKind.Theme;
  }
  return null;
};

const ItemsPanel = (props: IProps) => {
  const { state, dispatch } = props;
  const inv = state.inventory ?? [];

  return (
    <div className="panel-body items-panel">
      <div className="panel-head">Inventory · {inv.length} items</div>
      {inv.length === 0 ? (
        <div className="panel-empty">No loot yet…</div>
      ) : (
        <div className="item-grid">
          {inv.map(item => {
            const ek = equipKindOf(item.kind);
            return (
              <div
                key={item.id}
                className={`item-slot rarity-${item.rarity}${item.equipped ? " equipped" : ""}`}
              >
                <span className="item-icon">
                  {KIND_ICON[item.kind ?? "title"] ?? "❔"}
                </span>
                <span className="item-name">{item.name ?? item.id}</span>
                {ek ? (
                  <button
                    type="button"
                    className={`item-equip${item.equipped ? " is-equipped" : ""}`}
                    onClick={() =>
                      dispatch({ type: "action", name: "equip", kind: ek, id: item.id })
                    }
                  >
                    {item.equipped ? "Equipped" : "Equip"}
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ItemsPanel;
