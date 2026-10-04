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
        'src/modules/clinic/care/clinic-handoff.rules.ts': { functions: 100, lines: 100 },
        'src/modules/clinic/care/emergency-events.ts': { branches: 90, functions: 100, lines: 100 },
        'src/modules/clinic/care/care-feedback.ts': { branches: 100, functions: 100, lines: 100 },
        'src/modules/clinic/questionnaire/clinic-questionnaire.ts': { functions: 100, lines: 100 },
        'src/modules/clinic/analytics/assessment-analytics.ts': { functions: 100, lines: 100 },
        'src/modules/assessment/case/guards.ts': { branches: 100, functions: 100, lines: 100 },
        'src/modules/assessment/case/audit.ts': { branches: 100, functions: 100, lines: 100 },
        'src/modules/assessment/case/selection.ts': { branches: 100, functions: 100, lines: 100 },
        'src/modules/assessment/case/stop-rule.ts': { branches: 100, functions: 100, lines: 100 },
        'src/modules/alerts/alert-rules.service.ts': { branches: 90 },
        'src/modules/webhooks/webhook-outbox.service.ts': { branches: 90 },
      },
    },
  },
});
