import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [tailwindcss()],
  server: {
    port: 5173,
    open: true,
    // Office files dropped in the project root are locked while open in Word,
    // which crashes the watcher on Windows (EBUSY).
    watch: { ignored: ['**/*.docx', '**/~$*'] },
  },
  build: {
    target: 'es2020',
    cssMinify: 'lightningcss',
    rollupOptions: {
      output: {
        // Three.js is by far the heaviest dependency — split it into its own
        // chunk so the HTML/CSS/UI shell can paint before the 3D engine lands.
        manualChunks: { three: ['three'] },
      },
    },
  },
});
