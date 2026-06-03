#!/usr/bin/env node
// Static load-shape checks for realtime/polling changes.

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function check(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    console.error(error.message);
    process.exitCode = 1;
  }
}

function extractNumericConstant(source, name) {
  const match = source.match(new RegExp(`const\\s+${name}\\s*=\\s*([0-9_]+)`));
  assert.ok(match, `Missing ${name}`);
  return Number(match[1].replace(/_/g, ''));
}

async function checkAsync(name, fn) {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    console.error(error.message);
    process.exitCode = 1;
  }
}

function percentile(values, p) {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[index];
}

function requireEnv(name) {
  const value = process.env[name];
  assert.ok(value, `${name} is required`);
  return value;
}

async function timedFetch(url, options) {
  const started = Date.now();
  const response = await fetch(url, options);
  await response.arrayBuffer().catch(() => undefined);
  return { status: response.status, durationMs: Date.now() - started };
}

async function runLiveLoadChecks() {
  const baseUrl = process.env.LOAD_TEST_BASE_URL || process.env.BASE_URL || 'http://localhost:3000';
  const patientToken = requireEnv('LOAD_TEST_PATIENT_TOKEN');
  const encounterId = requireEnv('LOAD_TEST_ENCOUNTER_ID');
  const concurrency = Number.parseInt(process.env.LOAD_TEST_CONCURRENCY || '500', 10);
  const durationMs = Number.parseInt(process.env.LOAD_TEST_DURATION_MS || '15000', 10);
  const maxErrorRate = Number.parseFloat(process.env.LOAD_TEST_MAX_ERROR_RATE || '0.05');
  const maxP95Ms = Number.parseInt(process.env.LOAD_TEST_MAX_P95_MS || '1500', 10);
  const routes = [
    `/patient/encounters/${encounterId}`,
    `/patient/encounters/${encounterId}/messages?limit=1`,
    `/patient/encounters/${encounterId}/queue`,
  ];
  const deadline = Date.now() + durationMs;
  const latencies = [];
  let requests = 0;
  let errors = 0;

  async function worker(workerId) {
    let index = workerId % routes.length;
    while (Date.now() < deadline) {
      const route = routes[index % routes.length];
      index += 1;
      requests += 1;
      try {
        const result = await timedFetch(`${baseUrl}${route}`, {
          headers: { 'x-patient-token': patientToken },
        });
        latencies.push(result.durationMs);
        if (result.status >= 500 || result.status === 429) {
          errors += 1;
        }
      } catch {
        errors += 1;
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, (_, index) => worker(index)));

  const errorRate = requests === 0 ? 1 : errors / requests;
  const p95Ms = percentile(latencies, 95);
  const rps = requests / (durationMs / 1000);

  console.log(JSON.stringify({
    concurrency,
    durationMs,
    requests,
    rps: Number(rps.toFixed(2)),
    errorRate: Number(errorRate.toFixed(4)),
    p95Ms,
  }));

  assert.ok(errorRate <= maxErrorRate, `error rate ${errorRate} exceeds ${maxErrorRate}`);
  assert.ok(p95Ms <= maxP95Ms, `p95 ${p95Ms}ms exceeds ${maxP95Ms}ms`);
}

check('patient encounter workspace uses SSE plus slower fallback polling', () => {
  const source = read('Apps/PatientApp/src/features/encounter-workspace/EncounterWorkspace.tsx');
  assert.ok(source.includes('new EventSource'), 'Encounter workspace should open an SSE stream');
  assert.ok(source.includes("message.created"), 'SSE stream should react to message deltas');
  assert.ok(source.includes("encounter.updated"), 'SSE stream should react to encounter updates');
  assert.ok(extractNumericConstant(source, 'ENCOUNTER_FALLBACK_POLL_MS') >= 60_000);
  assert.ok(extractNumericConstant(source, 'MESSAGE_FALLBACK_POLL_MS') >= 30_000);
  assert.ok(extractNumericConstant(source, 'QUEUE_POLL_MS') >= 60_000);
});

check('patient messages page avoids 5 second active-thread polling', () => {
  const source = read('Apps/PatientApp/src/pages/MessagesPage.tsx');
  assert.ok(extractNumericConstant(source, 'ACTIVE_THREAD_POLL_MS') >= 30_000);
  assert.ok(source.includes('flushPatientMessageOutbox'), 'Messages page should drain queued sends');
});

check('hospital encounter realtime refetches are debounced', () => {
  const source = read('Apps/HospitalApp/src/app/HospitalApp.tsx');
  assert.ok(source.includes('scheduleFetchEncounters'), 'Hospital app should schedule encounter refetches');
  assert.ok(source.includes('encounterRefreshTimer'), 'Hospital app should keep one pending refetch timer');
  assert.ok(source.includes('window.clearTimeout'), 'Hospital app should clear stale refetch timers');
});

check('patient realtime endpoint verifies encounter ownership before streaming', () => {
  const source = read('backend/src/modules/encounters/patient-encounters.controller.ts');
  assert.ok(source.includes('@Sse'), 'Patient encounter events should expose SSE');
  assert.ok(source.includes('assertPatientOwnsEncounter'), 'SSE must verify ownership before stream starts');
  assert.ok(source.includes('keepalive'), 'SSE should send keepalive events');
});

check('Redis patient quotas include read, write, upload, and global buckets', () => {
  const source = read('backend/src/modules/auth/guards/patient-rate-limit.guard.ts');
  assert.ok(source.includes('PATIENT_RATE_LIMIT_PER_MINUTE'));
  assert.ok(source.includes('PATIENT_WRITE_RATE_LIMIT_PER_MINUTE'));
  assert.ok(source.includes('PATIENT_UPLOAD_RATE_LIMIT_PER_MINUTE'));
  assert.ok(source.includes('PATIENT_GLOBAL_RATE_LIMIT_PER_MINUTE'));
  assert.ok(source.includes('patient-session:${patient.sessionId}:write'));
});

check('500-patient fallback request budget stays below previous polling blast radius', () => {
  const workspace = read('Apps/PatientApp/src/features/encounter-workspace/EncounterWorkspace.tsx');
  const messagesPage = read('Apps/PatientApp/src/pages/MessagesPage.tsx');
  const patientCount = Number(process.env.LOAD_PATIENT_COUNT || 500);
  const encounterPollMs = extractNumericConstant(workspace, 'ENCOUNTER_FALLBACK_POLL_MS');
  const messagePollMs = Math.min(
    extractNumericConstant(workspace, 'MESSAGE_FALLBACK_POLL_MS'),
    extractNumericConstant(messagesPage, 'ACTIVE_THREAD_POLL_MS'),
  );
  const queuePollMs = extractNumericConstant(workspace, 'QUEUE_POLL_MS');
  const fallbackRps =
    patientCount * (1000 / encounterPollMs + 1000 / messagePollMs + 1000 / queuePollMs);
  const previousRps = patientCount * (1000 / 10_000 + 1000 / 5_000 + 1000 / 30_000);

  assert.ok(fallbackRps < previousRps / 2, `fallback RPS ${fallbackRps} is too high`);
  assert.ok(fallbackRps <= 40, `fallback RPS ${fallbackRps} exceeds budget`);

  console.log(JSON.stringify({
    patientCount,
    fallbackRps: Number(fallbackRps.toFixed(2)),
    previousRps: Number(previousRps.toFixed(2)),
  }));
});

(async () => {
  if (!process.exitCode && process.env.RUN_LIVE_LOAD_TEST === '1') {
    await checkAsync('live concurrent patient request harness stays within configured limits', runLiveLoadChecks);
  }

  if (process.exitCode) {
    process.exit(process.exitCode);
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
