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
    },
  }),
);
