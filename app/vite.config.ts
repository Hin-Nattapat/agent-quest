import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev: Vite serves the app with HMR and proxies the SSE endpoint to the Bun bridge,
// so the app always calls "/events" in both dev and prod.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { "/events": "http://localhost:7070" },
  },
  build: {
    outDir: "dist",
    // Stable, unhashed names so the VS Code webview can reference assets/app.js + app.css directly.
    rollupOptions: {
      output: {
        entryFileNames: "assets/app.js",
        chunkFileNames: "assets/app-[name].js",
        assetFileNames: "assets/app.[ext]",
      },
    },
  },
});
