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

export type TClientAction = IEquipAction | ISetClassAction | ISetBranchAction;
