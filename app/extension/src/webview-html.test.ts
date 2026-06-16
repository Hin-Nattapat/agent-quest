import { test, expect } from "bun:test";
import { buildWebviewHtml } from "./webview-html";

test("buildWebviewHtml embeds URIs, nonce, and a strict CSP", () => {
  const html = buildWebviewHtml({
    scriptUri: "vscode-webview://abc/assets/app.js",
    styleUri: "vscode-webview://abc/assets/app.css",
    cspSource: "vscode-webview://abc",
    nonce: "N0NCE",
    assetsBase: "vscode-webview://abc",
  });

  expect(html).toContain('src="vscode-webview://abc/assets/app.js"');
  expect(html).toContain('href="vscode-webview://abc/assets/app.css"');
  expect(html).toContain('nonce="N0NCE"');
  expect(html).toContain("script-src 'nonce-N0NCE'");
  expect(html).toContain('<div id="root"></div>');
  // no remote script origins — only the nonce is allowed to run scripts
  expect(html).not.toMatch(/script-src[^;]*https?:/);
});

test("buildWebviewHtml injects the asset base before the app module script", () => {
  const html = buildWebviewHtml({
    scriptUri: "vscode-webview://abc/assets/app.js",
    styleUri: "vscode-webview://abc/assets/app.css",
    cspSource: "vscode-webview://abc",
    nonce: "N0NCE",
    assetsBase: "vscode-webview://abc",
  });

  expect(html).toContain('window.__CQ_ASSETS__="vscode-webview://abc"');
  // the base must be set by a nonce'd inline script (CSP blocks un-nonced scripts)
  expect(html).toMatch(/<script nonce="N0NCE">window\.__CQ_ASSETS__=/);
  // and it must appear before the module that reads it
  const baseAt = html.indexOf("__CQ_ASSETS__");
  const appAt = html.indexOf("app.js");
  expect(baseAt).toBeLessThan(appAt);
});
