#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const compose = ['compose', '-f', 'docker-compose.cloud.yml'];
const command = process.argv[2] || 'help';

const commands = {
  up: () => {
    run('docker', [...compose, 'down', '-v', '--remove-orphans']);
    run('docker', [...compose, 'up', '-d', '--build']);
    waitForReady();
    printEndpoints();
  },
  down: () => run('docker', [...compose, 'down', '-v', '--remove-orphans']),
  reset: () => run('docker', [...compose, 'down', '-v']),
  status: () => run('docker', [...compose, 'ps']),
  logs: () => run('docker', [...compose, 'logs', '--tail=250', ...process.argv.slice(3)]),
  test: () => {
    waitForReady();
    runBackend('test:security');
    runBackend('test:load');
    runBackend('test:assurance');
    runBackend('test:deployed-security');
    runBackend('test:deployed-stack');
  },
  load: () => {
    waitForReady();
    runBackend('test:deployed-stack');
  },
  chaos: () => run('node', ['scripts/chaos-drill.mjs']),
  restore: () => run('node', ['scripts/restore-drill.mjs']),
};

if (!commands[command]) {
  console.log(`Usage: ./priage-cloud <up|down|reset|status|logs|test|load|chaos|restore>

The cloud simulation is disposable: up starts with fresh volumes and down removes them.

Endpoints:
  API edge       http://localhost:8080
  Hospital app   http://localhost:8081
  Patient app    http://localhost:8082
  Grafana        http://localhost:3001  (priage / priage)
  Prometheus     http://localhost:9090
  PgBouncer      localhost:6432`);
  process.exit(command === 'help' ? 0 : 1);
}

commands[command]();

function runBackend(script) {
  run('npm', ['run', script], {
    cwd: resolve(root, 'backend'),
    env: {
      DATABASE_URL: 'postgresql://priage:priage@localhost:6432/priage?schema=public',
      BASE_URL: 'http://localhost:8080',
      DEPLOYED_TEST_BASE_URL: 'http://localhost:8080',
      ...process.env,
    },
  });
}

function waitForReady() {
  for (let attempt = 1; attempt <= 60; attempt += 1) {
    const result = spawnSync('curl', ['-fsS', 'http://localhost:8080/health/ready'], { stdio: 'ignore' });
    if (result.status === 0) return;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2000);
  }
  console.error('\nCloud simulation failed to become ready. Current service state:');
  spawnSync('docker', [...compose, 'ps', '-a'], { cwd: root, stdio: 'inherit' });
  console.error('\nRecent migration/backend/edge logs:');
  spawnSync('docker', [...compose, 'logs', '--tail=120', 'migrate', 'backend', 'edge'], {
    cwd: root,
    stdio: 'inherit',
  });
  throw new Error('Cloud simulation did not become ready within 120 seconds');
}

function printEndpoints() {
  console.log('Priage cloud simulation is ready: API :8080, Hospital :8081, Patient :8082, Grafana :3001');
}

function run(commandName, args, overrides = {}) {
  const result = spawnSync(commandName, args, {
    cwd: overrides.cwd || root,
    env: overrides.env || process.env,
    stdio: 'inherit',
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
