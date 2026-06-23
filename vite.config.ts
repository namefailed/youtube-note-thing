import { defineConfig } from "vite";

// Port 5191 on purpose — Phoneme dev runs on 5173, and both must run at once.
export default defineConfig({
  clearScreen: false,
  // Don't let Vite's watcher touch the Rust build dir — it locks files mid-compile (EBUSY).
  server: { port: 5191, strictPort: true, watch: { ignored: ["**/src-tauri/**"] } },
  envPrefix: ["VITE_", "TAURI_"],
  build: { target: "esnext" },
});
