import { build } from "esbuild";

await build({
  entryPoints: ["src/extension.ts"],
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node18",
  external: ["vscode"], // provided by the VS Code host at runtime
  outfile: "dist/extension.js",
  sourcemap: true,
});
