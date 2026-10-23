import { defineConfig } from 'vite';

// configure-pages returns a project path such as /command without a final slash.
// Vite preserves that exact value in import.meta.env.BASE_URL.
const requestedBase = process.env.VITE_BASE_PATH || './';
const base = requestedBase.endsWith('/') ? requestedBase : `${requestedBase}/`;

// Relative assets work on both user Pages and /repository/ project Pages.
export default defineConfig({
  base,
  build: { target: 'es2022', sourcemap: false, emptyOutDir: true },
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
});
