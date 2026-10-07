import { defineConfig } from "vite";

// Relative base: the same build runs on localhost, on {titleid}.idos.games and inside the
// idosgames.com iframe (iDos asks for asset_base or "./").
export default defineConfig({
  base: "./",
  server: { port: 5190, host: true },
  build: {
    target: "es2022",
    chunkSizeWarningLimit: 1200,
  },
  test: {
    environment: "node",
  },
} as Parameters<typeof defineConfig>[0]);
