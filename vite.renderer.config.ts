import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    // Alvo unico: o Chromium do Electron (castlabs v42 = Chromium 138+).
    // Evita transpilar/polyfills para navegadores antigos.
    target: "chrome138",
  },
  server: {
    port: 5273,
    strictPort: true,
  },
});
