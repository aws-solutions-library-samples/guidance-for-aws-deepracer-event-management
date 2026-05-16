import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vitejs.dev/config/
export default defineConfig({
  base: '/overlays/',
  plugins: [react()],
  build: {
    outDir: 'build',
    sourcemap: true,
    // avataaars ships every body/hair/face/accessory variant as inline SVG
    // paths (~480 kB minified) — same dependency the public leaderboard and
    // main website use. Lazy-loading it would slow the overlay's first paint,
    // which broadcast operators rely on. Raise the warning threshold so the
    // single legitimate chunk doesn't trip Rollup's default 500 kB caution.
    chunkSizeWarningLimit: 1024,
  },
});
