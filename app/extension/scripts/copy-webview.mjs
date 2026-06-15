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
