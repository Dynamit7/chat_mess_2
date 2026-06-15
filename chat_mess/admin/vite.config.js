import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Admin / moderation console for the DeFensy chat backend (Express + Socket.IO on :3000).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5180,
    host: true,
  },
});
