import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// ══════════════════════════════════════════════════════════════════
//  KIDORA — Configuration Vite
//  • Proxy /api → backend local en développement
//  • Code splitting : react / games chargés séparément (§35)
// ══════════════════════════════════════════════════════════════════

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    target: "es2020",
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-state": ["zustand"],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
  test: {
    environment: "jsdom",
    setupFiles: ["src/tests/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    globals: false,
  },
});
