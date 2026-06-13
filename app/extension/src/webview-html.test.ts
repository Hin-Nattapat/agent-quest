import { test, expect } from "bun:test";
import { buildWebviewHtml } from "./webview-html";

test("buildWebviewHtml embeds URIs, nonce, and a strict CSP", () => {
  const html = buildWebviewHtml({
    scriptUri: "vscode-webview://abc/assets/app.js",
    styleUri: "vscode-webview://abc/assets/app.css",
    cspSource: "vscode-webview://abc",
    nonce: "N0NCE",
  });

  expect(html).toContain('src="vscode-webview://abc/assets/app.js"');
  expect(html).toContain('href="vscode-webview://abc/assets/app.css"');
  expect(html).toContain('nonce="N0NCE"');
  expect(html).toContain("script-src 'nonce-N0NCE'");
  expect(html).toContain('<div id="root"></div>');
  // no remote script origins — only the nonce is allowed to run scripts
  expect(html).not.toMatch(/script-src[^;]*https?:/);
});
