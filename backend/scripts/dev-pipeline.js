#!/usr/bin/env node

require('dotenv').config();

const { spawnSync } = require('node:child_process');

const steps = [
  {
    label: 'backend smoke',
    command: 'node',
    args: ['scripts/smoke-test-v2.js'],
  },
  {
    label: 'logging smoke',
    command: 'node',
    args: ['scripts/test-logging.js'],
  },
  {
    label: 'realtime smoke',
    command: 'node',
    args: ['scripts/realtime-smoke.js'],
  },
  {
    label: 'frontend-aligned flow smoke',
    command: 'node',
    args: ['scripts/e2e-frontend-flows.js', '--seed'],
  },
];

for (const step of steps) {
  process.stdout.write(`\n[dev-pipeline] Running ${step.label}\n`);
  const result = spawnSync(step.command, step.args, {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: process.env,
  });

  if (result.status !== 0) {
    process.stderr.write(`[dev-pipeline] ${step.label} failed with exit code ${result.status ?? 'unknown'}\n`);
    process.exit(result.status ?? 1);
  }
}

process.stdout.write('\n[dev-pipeline] All checks passed.\n');
