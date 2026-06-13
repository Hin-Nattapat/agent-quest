import * as vscode from "vscode";
import { randomBytes } from "crypto";
import { join } from "path";
import { homedir } from "os";
import { buildWebviewHtml } from "./webview-html";
import { watchState, readStateText } from "./state-feed";

const HOME = process.env.AGENTRPG_HOME || join(homedir(), ".agentrpg");

let panel: vscode.WebviewPanel | undefined;
let disposeFeed: (() => void) | undefined;

// base64url avoids +, /, = so the value is unambiguous inside the CSP nonce-source and attribute.
const nonce = (): string => randomBytes(16).toString("base64url");

const openPanel = (context: vscode.ExtensionContext): void => {
  if (panel) {
    panel.reveal(vscode.ViewColumn.Beside);
    return;
  }

  // app/extension/ -> app/dist (the Vite build output)
  const distRoot = vscode.Uri.joinPath(context.extensionUri, "..", "dist");
  panel = vscode.window.createWebviewPanel(
    "commitQuestCompanion",
    "Commit Quest",
    vscode.ViewColumn.Beside,
    {
      enableScripts: true,
      localResourceRoots: [distRoot],
      // Keep the renderer alive when the tab is hidden so switching back doesn't reload + re-handshake.
      retainContextWhenHidden: true,
    },
  );
  context.subscriptions.push(panel);

  const { webview } = panel;
  const scriptUri = webview
    .asWebviewUri(vscode.Uri.joinPath(distRoot, "assets", "app.js"))
    .toString();
  const styleUri = webview
    .asWebviewUri(vscode.Uri.joinPath(distRoot, "assets", "app.css"))
    .toString();
  webview.html = buildWebviewHtml({
    scriptUri,
    styleUri,
    cspSource: webview.cspSource,
    nonce: nonce(),
  });

  // The webview asks for the current state once it has subscribed (mount-race fix).
  const messageSub = webview.onDidReceiveMessage((message: { type?: string }) => {
    if (message.type === "ready") {
      const text = readStateText(HOME);
      if (text) {
        webview.postMessage({ type: "state", json: text });
      }
    }
  });
  context.subscriptions.push(messageSub);

  // watchState clears its pending debounce timer on dispose, so onJson never fires post-dispose.
  disposeFeed = watchState(HOME, json => {
    webview.postMessage({ type: "state", json });
  });

  panel.onDidDispose(() => {
    disposeFeed?.();
    disposeFeed = undefined;
    messageSub.dispose();
    panel = undefined;
  });
};

export const activate = (context: vscode.ExtensionContext): void => {
  context.subscriptions.push(
    vscode.commands.registerCommand("commitQuest.openCompanion", () =>
      openPanel(context),
    ),
  );
};

export const deactivate = (): void => {
  disposeFeed?.();
};
