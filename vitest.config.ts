import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      globals: true,
      environment: 'node',
      include: ['src/**/*.test.ts'],
      bail: 1,
      testTimeout: 5_000,
      reporters: ['verbose'],
      restoreMocks: true,
      pool: 'forks',
      coverage: {
        provider: 'v8',
        include: ['src/**/*.ts'],
        exclude: [
          'src/main.ts',
          'src/**/index.ts',
          'src/**/types.ts',
          'src/**/*.test.ts',
          'src/game/Game.ts',
          'src/ui/layers/**',
          'src/ui/MapRenderer.ts',
          'src/ui/Sidebar.ts',
          'src/ui/DebugOverlay.ts',
          'src/ui/KeyboardController.ts',
          'src/ui/Camera.ts',
          'src/bible/main.ts',
          'src/bible/components/**',
        ],
        thresholds: {
          lines: 70,
          functions: 70,
          branches: 70,
          statements: 70,
        },
      },
    },
  }),
);
