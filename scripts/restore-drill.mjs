#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

const compose = ['compose', '-f', 'docker-compose.cloud.yml', 'exec', '-T', 'postgres'];
const restoreDatabase = 'priage_restore_drill';

await assertStackReady();
assertSourceSchema();

console.log('[restore] Capturing encrypted-backup-equivalent logical snapshot from the simulation database');
const dump = runCapture(['pg_dump', '-U', 'priage', '-d', 'priage', '-Fc'], 256 * 1024 * 1024);
run(['dropdb', '-U', 'priage', '--if-exists', restoreDatabase]);
run(['createdb', '-U', 'priage', restoreDatabase]);
run(['pg_restore', '-U', 'priage', '-d', restoreDatabase, '--no-owner', '--no-privileges'], dump);

const sourceCounts = runCapture([
  'psql', '-U', 'priage', '-d', 'priage', '-Atc',
  'SELECT (SELECT count(*) FROM "Hospital"), (SELECT count(*) FROM "Encounter"), (SELECT count(*) FROM "SensitiveReadAuditLog");',
]).toString().trim();
const restoredCounts = runCapture([
  'psql', '-U', 'priage', '-d', restoreDatabase, '-Atc',
  'SELECT (SELECT count(*) FROM "Hospital"), (SELECT count(*) FROM "Encounter"), (SELECT count(*) FROM "SensitiveReadAuditLog");',
]).toString().trim();

if (sourceCounts !== restoredCounts) {
  throw new Error(`restore integrity mismatch: source=${sourceCounts}, restored=${restoredCounts}`);
}

run(['dropdb', '-U', 'priage', restoreDatabase]);
console.log(`[restore] Restore drill passed with integrity counts ${sourceCounts}`);

async function assertStackReady() {
  try {
    const response = await fetch('http://localhost:8080/health/ready');
    if (response.ok) return;
  } catch {
    // Report the same actionable error for connection failures and unhealthy responses.
  }
  throw new Error('restore drill requires a fully healthy stack; run ./priage-cloud up first');
}

function assertSourceSchema() {
  const table = runCapture([
    'psql', '-U', 'priage', '-d', 'priage', '-Atc',
    `SELECT to_regclass('"Hospital"');`,
  ]).toString().trim();
  if (table !== '"Hospital"') {
    throw new Error('restore drill requires a migrated source database; run ./priage-cloud up first');
  }
}

function run(args, input) {
  const result = spawnSync('docker', [...compose, ...args], {
    input,
    stdio: input ? ['pipe', 'inherit', 'inherit'] : 'inherit',
    maxBuffer: 256 * 1024 * 1024,
  });
  if (result.status !== 0) throw new Error(`${args[0]} failed`);
}

function runCapture(args, maxBuffer = 16 * 1024 * 1024) {
  const result = spawnSync('docker', [...compose, ...args], {
    encoding: null,
    maxBuffer,
  });
  if (result.status !== 0) {
    throw new Error(`${args[0]} failed: ${result.stderr?.toString() || 'unknown error'}`);
  }
  return result.stdout;
}
