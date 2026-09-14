import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    clearMocks: true,
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      reportsDirectory: 'coverage',
      thresholds: {
        'src/shared/queue/queuePriority.ts': { branches: 100, functions: 100, lines: 100 },
      },
    },
  },
});
