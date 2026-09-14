import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    clearMocks: true,
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      reportsDirectory: 'coverage',
      thresholds: {
        'src/modules/alerts/alert-rules.ts': { branches: 100, functions: 100, lines: 100 },
        'src/modules/clinical-access/clinical-access.policy.ts': { branches: 100, functions: 100, lines: 100 },
        'src/modules/alerts/alert-rules.service.ts': { branches: 90 },
        'src/modules/webhooks/webhook-outbox.service.ts': { branches: 90 },
      },
    },
  },
});
