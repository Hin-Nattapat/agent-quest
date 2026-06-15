export enum EquipKind {
  Title = "title",
  Theme = "theme",
}

export interface IEquipAction {
  type: "action";
  name: "equip";
  kind: EquipKind;
  id: string;
}

export type TClientAction = IEquipAction;
