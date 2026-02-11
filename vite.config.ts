import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  base: '/warfare-logistics/',
  resolve: {
    alias: {
      '@core': path.resolve(__dirname, './src/core'),
      '@game': path.resolve(__dirname, './src/game'),
      '@ui': path.resolve(__dirname, './src/ui'),
      '@data': path.resolve(__dirname, './src/data'),
    },
  },
  server: {
    port: 3000,
    open: false,
  },
  build: {
    target: 'ES2020',
    outDir: 'dist',
  },
});
