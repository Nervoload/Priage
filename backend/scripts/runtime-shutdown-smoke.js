#!/usr/bin/env node

require('dotenv').config();

const { spawn } = require('child_process');
const { randomUUID } = require('crypto');
const { Pool } = require('pg');
const Redis = require('ioredis');
const { io } = require('socket.io-client');

const required = ['DATABASE_URL', 'REDIS_HOST', 'RUNTIME_TEST_EMAIL', 'RUNTIME_TEST_PASSWORD', 'RUNTIME_TEST_HOSPITAL_SLUG'];
const missing = required.filter((name) => !process.env[name]);
if (missing.length) {
  console.error(`Missing runtime shutdown test configuration: ${missing.join(', ')}`);
  process.exit(1);
}

const port = Number.parseInt(process.env.RUNTIME_SHUTDOWN_PORT || '33119', 10);
const baseUrl = `http://127.0.0.1:${port}`;
const runId = randomUUID().slice(0, 12);
const databaseName = `priage-shutdown-${runId}`;
const redisName = `priage-shutdown-${runId}`;
const child = spawn(process.execPath, ['dist/main.js'], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    PORT: String(port),
    NODE_ENV: 'test',
    DATABASE_APPLICATION_NAME: databaseName,
    REDIS_CONNECTION_NAME: redisName,
    TRIAGE_INTERVIEW_MODE: 'deterministic',
    ALERT_RULE_ENGINE_MODE: 'shadow',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
child.stdout.pipe(process.stdout);
child.stderr.pipe(process.stderr);

main().catch((error) => {
  console.error(`[runtime-shutdown] ${error.message}`);
  child.kill('SIGKILL');
  process.exitCode = 1;
});

async function main() {
  await waitForHealth();
  const login = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: baseUrl },
    body: JSON.stringify({
      email: process.env.RUNTIME_TEST_EMAIL,
      password: process.env.RUNTIME_TEST_PASSWORD,
      hospitalSlug: process.env.RUNTIME_TEST_HOSPITAL_SLUG,
    }),
  });
  if (!login.ok) throw new Error(`Staff login failed with ${login.status}`);
  const cookie = login.headers.get('set-cookie')?.split(';')[0];
  if (!cookie) throw new Error('Staff login did not set a session cookie');
  const socket = io(baseUrl, {
    transports: ['websocket'],
    extraHeaders: { Cookie: cookie },
    reconnection: false,
  });
  await waitForSocket(socket);

  const disconnected = new Promise((resolve) => socket.once('disconnect', resolve));
  const exited = new Promise((resolve) => child.once('exit', (code, signal) => resolve({ code, signal })));
  child.kill('SIGTERM');
  const [exit] = await Promise.all([
    withTimeout(exited, 10_000, 'backend did not exit after SIGTERM'),
    withTimeout(disconnected, 10_000, 'Socket.IO connection was not closed during shutdown'),
  ]);
  socket.close();
  if (exit.code !== 0 && exit.signal !== 'SIGTERM') {
    throw new Error(`backend exited unexpectedly: ${JSON.stringify(exit)}`);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const redis = new Redis({
    host: process.env.REDIS_HOST,
    port: Number.parseInt(process.env.REDIS_PORT || '6379', 10),
    username: process.env.REDIS_USERNAME || undefined,
    password: process.env.REDIS_PASSWORD || undefined,
    db: Number.parseInt(process.env.REDIS_DB || '0', 10),
    tls: ['1', 'true', 'yes', 'on'].includes((process.env.REDIS_TLS || '').toLowerCase()) ? {} : undefined,
  });
  try {
    const databaseConnections = await pool.query(
      'SELECT count(*)::int AS count FROM pg_stat_activity WHERE application_name = $1',
      [databaseName],
    );
    if (databaseConnections.rows[0].count !== 0) throw new Error('Prisma/pg connections remained after shutdown');
    const redisConnections = (await redis.client('LIST'))
      .split('\n')
      .filter((line) => line.includes(`name=${redisName}`));
    if (redisConnections.length !== 0) throw new Error('Redis or BullMQ connections remained after shutdown');
  } finally {
    await pool.end();
    redis.disconnect();
  }
  console.log('[runtime-shutdown] SIGTERM closed Socket.IO, Prisma, Redis, and BullMQ handles cleanly.');
}

async function waitForHealth() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/health/live`);
      if (response.ok) return;
    } catch {
      // Process is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('backend did not become live');
}

function waitForSocket(socket) {
  return withTimeout(new Promise((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('connect_error', reject);
  }), 10_000, 'Socket.IO did not connect');
}

function withTimeout(promise, timeoutMs, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(message)), timeoutMs)),
  ]);
}
