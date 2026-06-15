import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Web client for the DeFensy chat backend (Express + Socket.IO on :3000).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    host: true,
  },
});
