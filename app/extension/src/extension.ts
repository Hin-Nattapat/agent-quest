import * as vscode from "vscode";

export const activate = (context: vscode.ExtensionContext): void => {
  context.subscriptions.push(
    vscode.commands.registerCommand("commitQuest.openCompanion", () => {
      vscode.window.showInformationMessage(
        "Commit Quest companion — panel coming up next.",
      );
    }),
  );
};

export const deactivate = (): void => {};
