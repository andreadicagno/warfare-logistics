import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/warfare-logistics/',
  resolve: {
    alias: {
      '@core': path.resolve(__dirname, './src/core'),
      '@game': path.resolve(__dirname, './src/game'),
      '@ui': path.resolve(__dirname, './src/ui'),
      '@data': path.resolve(__dirname, './src/data'),
      '@bible': path.resolve(__dirname, './src/bible'),
    },
  },
  server: {
    port: 3000,
    open: false,
  },
  build: {
    target: 'ES2020',
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        bible: path.resolve(__dirname, 'bible/index.html'),
      },
    },
  },
});
