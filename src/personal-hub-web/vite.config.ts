import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/api": { target: "http://127.0.0.1:5097", changeOrigin: false },
      "/health": { target: "http://127.0.0.1:5097", changeOrigin: false },
    },
  },
  build: { outDir: "../PersonalHub.Api/wwwroot", emptyOutDir: true },
});
