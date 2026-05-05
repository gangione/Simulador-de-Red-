import { defineConfig } from 'vite';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';

export default defineConfig({
  plugins: [
    electron([
      {
        // Main process
        entry: 'electron/main.js',
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              external: ['electron'],
            },
          },
        },
      },
      {
        // Preload script (bridge entre renderer y main)
        entry: 'electron/preload.js',
        onstart(args) { args.reload(); },
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              external: ['electron'],
            },
          },
        },
      },
    ]),
    renderer(),
  ],
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'esnext',
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
