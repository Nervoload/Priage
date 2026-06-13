#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

const compose = ['compose', '-f', 'docker-compose.cloud.yml'];
const scenarios = [
  { service: 'redis', label: 'distributed cache, rate limits, and realtime broker' },
  { service: 'pgbouncer', label: 'database connection proxy' },
];

await assertStackReady();

for (const scenario of scenarios) {
  console.log(`\n[chaos] Interrupting ${scenario.label}`);
  try {
    docker('stop', scenario.service);
    await waitForHealth(false, 30_000);
    console.log(`[chaos] readiness correctly failed while ${scenario.service} was unavailable`);
  } finally {
    docker('start', scenario.service);
  }
  await waitForHealth(true, 90_000);
  console.log(`[chaos] service recovered after ${scenario.service} restart`);
}

console.log('\n[chaos] Recovery drill passed.');

async function assertStackReady() {
  try {
    const response = await fetch('http://localhost:8080/health/ready');
    if (response.ok) return;
  } catch {
    // Report the same actionable error for connection failures and unhealthy responses.
  }
  throw new Error('chaos drill requires a fully healthy stack; run ./priage-cloud up first');
}

function docker(action, service) {
  const result = spawnSync('docker', [...compose, action, service], { stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`docker compose ${action} ${service} failed`);
}

async function waitForHealth(expectedReady, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    let ready = false;
    try {
      const response = await fetch('http://localhost:8080/health/ready');
      ready = response.ok;
    } catch {
      ready = false;
    }
    if (ready === expectedReady) return;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`readiness did not become ${expectedReady ? 'healthy' : 'unhealthy'} within ${timeoutMs}ms`);
}
