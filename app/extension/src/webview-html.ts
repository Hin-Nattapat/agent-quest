export interface IBuildWebviewHtmlArgs {
  scriptUri: string;
  styleUri: string;
  cspSource: string;
  nonce: string;
  assetsBase: string;
}

export const buildWebviewHtml = (args: IBuildWebviewHtmlArgs): string => {
  const { scriptUri, styleUri, cspSource, nonce, assetsBase } = args;
  // Google Fonts: the @import pulls a stylesheet from fonts.googleapis.com and the
  // font files from fonts.gstatic.com — both must be allowlisted or the webview CSP
  // silently blocks them and the pixel/fantasy fonts fall back to system fonts.
  const csp = [
    "default-src 'none'",
    `img-src ${cspSource} data:`,
    `font-src ${cspSource} https://fonts.gstatic.com`,
    `style-src ${cspSource} https://fonts.googleapis.com`,
    `script-src 'nonce-${nonce}'`,
  ].join("; ");
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="Content-Security-Policy" content="${csp};" />
    <link rel="stylesheet" href="${styleUri}" />
    <title>Agent Quest</title>
  </head>
  <body>
    <div id="root"></div>
    <!-- Non-module inline script executes during parse, before the deferred type="module"
         script, ensuring __CQ_ASSETS__ is set before the app reads it on load. -->
    <script nonce="${nonce}">window.__CQ_ASSETS__=${JSON.stringify(assetsBase)};</script>
    <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
  </body>
</html>`;
};
