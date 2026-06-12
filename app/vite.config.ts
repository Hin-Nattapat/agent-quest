import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev: Vite serves the app with HMR and proxies the SSE endpoint to the Bun bridge,
// so the app always calls "/events" in both dev and prod.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { "/events": "http://localhost:7070" },
  },
  build: { outDir: "dist" },
});
