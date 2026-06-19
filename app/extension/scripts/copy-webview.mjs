import { rmSync, cpSync, mkdirSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const here = dirname(fileURLToPath(import.meta.url)); // app/extension/scripts
const ext = join(here, ".."); // app/extension
const src = join(ext, "..", "dist", "assets"); // app/dist/assets
const destRoot = join(ext, "webview");
const dest = join(destRoot, "assets");

if (!existsSync(src)) {
  console.error(`copy-webview: missing ${src} — run the app build first (vite build).`);
  process.exit(1);
}

rmSync(destRoot, { recursive: true, force: true }); // drop stale assets so nothing lingers
mkdirSync(dest, { recursive: true });
cpSync(src, dest, { recursive: true });
console.log(`copy-webview: ${src} -> ${dest}`);

// Static asset folders Vite emits from public/ (heroes/monsters, scene backdrops, items). Each
// must be copied into the webview so assetUrl(/<dir>/…) resolves under the VS Code webview base.
for (const dir of ["sprites", "scenes", "items", "overworld"]) {
  const dirSrc = join(ext, "..", "dist", dir);
  if (existsSync(dirSrc)) {
    const dirDest = join(destRoot, dir);
    cpSync(dirSrc, dirDest, { recursive: true });
    console.log(`copy-webview: ${dirSrc} -> ${dirDest}`);
  }
}

// Root-level public files Vite emits straight into dist/ (e.g. the splash title image) — copy each
// so assetUrl("/<file>") resolves under the webview base, like the asset folders above.
for (const file of ["splash.png"]) {
  const fileSrc = join(ext, "..", "dist", file);
  if (existsSync(fileSrc)) {
    cpSync(fileSrc, join(destRoot, file));
    console.log(`copy-webview: ${fileSrc} -> ${join(destRoot, file)}`);
  }
}
