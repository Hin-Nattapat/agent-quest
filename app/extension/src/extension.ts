import * as vscode from "vscode";
import { randomBytes } from "crypto";
import { join } from "path";
import { homedir } from "os";
import { buildWebviewHtml } from "./webview-html";
import { watchState, readStateText } from "./state-feed";

const HOME = process.env.AGENTRPG_HOME || join(homedir(), ".agentrpg");
const VIEW_ID = "commitQuest.companion";

// base64url avoids +, /, = so the value is unambiguous inside the CSP nonce-source and attribute.
const nonce = (): string => randomBytes(16).toString("base64url");

// Wire one resolved webview view to the live state feed (re-run on each resolve).
const resolveView = (
  context: vscode.ExtensionContext,
  view: vscode.WebviewView,
): void => {
  // Webview assets are copied into the extension (scripts/copy-webview.mjs) so the same bundle
  // ships in the .vsix and is loaded under F5 — one source, no drift.
  const distRoot = vscode.Uri.joinPath(context.extensionUri, "webview");
  const { webview } = view;
  webview.options = { enableScripts: true, localResourceRoots: [distRoot] };

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

  // watchState clears its pending debounce timer on dispose, so onJson never fires post-dispose.
  const disposeFeed = watchState(HOME, json => {
    webview.postMessage({ type: "state", json });
  });

  view.onDidDispose(() => {
    disposeFeed();
    messageSub.dispose();
  });
};

export const activate = (context: vscode.ExtensionContext): void => {
  const provider: vscode.WebviewViewProvider = {
    resolveWebviewView(view) {
      resolveView(context, view);
    },
  };

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(VIEW_ID, provider, {
      // Keep the renderer alive when the panel is collapsed so reopening doesn't reload + re-handshake.
      webviewOptions: { retainContextWhenHidden: true },
    }),
    vscode.commands.registerCommand("commitQuest.openCompanion", () =>
      vscode.commands.executeCommand(`${VIEW_ID}.focus`),
    ),
  );
};

export const deactivate = (): void => {};
