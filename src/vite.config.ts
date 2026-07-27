import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// ✅ configuração padrão do Vite
export default defineConfig({
  plugins: [react()],

  server: {
    host: "0.0.0.0",
    port: 5173,
    // 👇 se quiser testar local com o backend remoto
    proxy: {
      "/api": {
        target: "https://multgesti.cloud", // domínio do backend
        changeOrigin: true,
        secure: false, // ignora erro SSL em dev
      },
    },
  },

  build: {
    outDir: "dist",
  },
});
