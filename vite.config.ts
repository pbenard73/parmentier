import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Served from a GitHub Pages project subpath:
  // https://pbenard73.github.io/parmentier/
  base: '/parmentier/',
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
  },
  build: {
    chunkSizeWarningLimit: 1600,
  },
});
