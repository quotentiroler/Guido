import { defineConfig } from 'vitest/config';
import path from 'path';

/**
 * Config for the dream-engine target spec (`npm run test:dream`). It runs ONLY the
 * intentionally-red roadmap of ideal engine behavior, which the main config excludes
 * so `npm test` stays green. Red tests here are the engine to-do list.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['packages/core/src/dream-engine.discovery.test.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
