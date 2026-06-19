export enum EquipKind {
  Title = "title",
  Theme = "theme",
  NameColor = "name_color",
}

export interface IEquipAction {
  type: "action";
  name: "equip";
  kind: EquipKind;
  id: string;
}

export interface ISetClassAction {
  type: "action";
  name: "setClass";
  line: string;
}

export interface ISetBranchAction {
  type: "action";
  name: "setBranch";
  branch: string;
}

export interface ISetNameAction {
  type: "action";
  name: "setName";
  value: string;
}

export type TClientAction =
  | IEquipAction
  | ISetClassAction
  | ISetBranchAction
  | ISetNameAction;
