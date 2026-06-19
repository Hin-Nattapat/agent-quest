// Client → extension-host action messages. The enum string values ARE the wire contract read by the
// host (app/extension/src/host-actions.ts), so keep them in sync.
export enum ActionType {
  Action = "action",
}

export enum ClientActionName {
  Equip = "equip",
  SetClass = "setClass",
  SetBranch = "setBranch",
  SetName = "setName",
}

export enum EquipKind {
  Title = "title",
  Theme = "theme",
  NameColor = "name_color",
}

export interface IEquipAction {
  type: ActionType.Action;
  name: ClientActionName.Equip;
  kind: EquipKind;
  id: string;
}

export interface ISetClassAction {
  type: ActionType.Action;
  name: ClientActionName.SetClass;
  line: string;
}

export interface ISetBranchAction {
  type: ActionType.Action;
  name: ClientActionName.SetBranch;
  branch: string;
}

export interface ISetNameAction {
  type: ActionType.Action;
  name: ClientActionName.SetName;
  value: string;
}

export type TClientAction =
  | IEquipAction
  | ISetClassAction
  | ISetBranchAction
  | ISetNameAction;
