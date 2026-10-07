import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Builds the smoke harness into a single bundle that a jsdom script can execute.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '/tmp/smoke-dist',
    emptyOutDir: true,
    lib: { entry: process.env.SMOKE_ENTRY || 'smoke.entry.jsx', formats: ['es'], fileName: process.env.SMOKE_NAME || 'smoke' },
    rollupOptions: { external: [] },
    minify: false,
  },
});
