import { defineConfig } from 'vite';

// Relative assets work on both user Pages and /repository/ project Pages.
export default defineConfig({
  base: process.env.VITE_BASE_PATH || './',
  build: { target: 'es2022', sourcemap: false, emptyOutDir: true },
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
});
