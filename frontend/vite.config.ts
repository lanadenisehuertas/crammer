import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // The app is mounted at /app by the FastAPI backend. An absolute base makes
  // asset URLs resolve correctly even on a fresh load of a nested route like
  // /app/quiz/1 (a relative "./" base would resolve assets against the deep
  // path and break). The dev server serves at http://localhost:5173/app/ too.
  base: "/app/",
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://127.0.0.1:8000",
    },
  },
  build: {
    outDir: "dist",
  },
});
