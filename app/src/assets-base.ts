declare global {
  interface Window {
    __CQ_ASSETS__?: string;
  }
}

// CSS url() cannot resolve one path in both Vite dev (/sprites from public/) and the VS Code
// webview (a vscode-webview:// origin). The host injects window.__CQ_ASSETS__ = asWebviewUri of
// the webview root; dev leaves it undefined. assetUrl prefixes paths so both resolve.
export const joinAsset = (base: string, path: string): string => {
  const trimmed = base.endsWith("/") ? base.slice(0, -1) : base;
  return trimmed + path;
};

export const assetUrl = (path: string): string => {
  const base = (typeof window !== "undefined" && window.__CQ_ASSETS__) || "";
  return joinAsset(base, path);
};
