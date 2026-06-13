export interface IBuildWebviewHtmlArgs {
  scriptUri: string;
  styleUri: string;
  cspSource: string;
  nonce: string;
}

export const buildWebviewHtml = (args: IBuildWebviewHtmlArgs): string => {
  const { scriptUri, styleUri, cspSource, nonce } = args;
  const csp = [
    "default-src 'none'",
    `img-src ${cspSource} data:`,
    `font-src ${cspSource}`,
    `style-src ${cspSource}`,
    `script-src 'nonce-${nonce}'`,
  ].join("; ");
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="Content-Security-Policy" content="${csp};" />
    <link rel="stylesheet" href="${styleUri}" />
    <title>Commit Quest</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
  </body>
</html>`;
};
