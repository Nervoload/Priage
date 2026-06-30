#!/usr/bin/env node

import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');
const hospitalAppDir = join(projectRoot, 'Apps', 'HospitalApp');
const patientAppDir = join(projectRoot, 'Apps', 'PatientApp');
const outDir = join(projectRoot, 'dist', 'static-demo');

const demoEnv = {
  ...process.env,
  VITE_DEMO_MODE: 'static',
  VITE_API_URL: 'static-demo',
  VITE_DEMO_EVENT_ENDPOINT: '/api/demo-events',
};

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

run('npx', [
  'vite',
  'build',
  '--config',
  '../DemoShell/vite.config.ts',
  '--outDir',
  '../../dist/static-demo',
  '--emptyOutDir',
], {
  cwd: hospitalAppDir,
  env: demoEnv,
});

run('npm', ['run', 'build:demo'], {
  cwd: hospitalAppDir,
  env: demoEnv,
});

run('npm', ['run', 'build:demo'], {
  cwd: patientAppDir,
  env: demoEnv,
});

writeFileSync(
  join(outDir, '_redirects'),
  [
    '/demo /index.html 200',
    '/patient /patient/index.html 200',
    '/patient/* /patient/index.html 200',
    '/care /care/index.html 200',
    '/care/* /care/index.html 200',
    '/hospital /care/index.html 200',
    '/hospital/* /care/index.html 200',
    '/* /index.html 200',
    '',
  ].join('\n'),
);

writeFileSync(
  join(outDir, '_routes.json'),
  JSON.stringify({
    version: 1,
    include: [
      '/api/*',
      '/patient',
      '/patient/*',
      '/care',
      '/care/*',
      '/hospital',
      '/hospital/*',
    ],
    exclude: [],
  }, null, 2),
);

writeFileSync(
  join(outDir, '_headers'),
  [
    '/*',
    '  X-Content-Type-Options: nosniff',
    '  X-Frame-Options: DENY',
    '  Referrer-Policy: strict-origin-when-cross-origin',
    '  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    "  Content-Security-Policy: default-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; upgrade-insecure-requests",
    '',
    '/demo',
    '  Cache-Control: no-store',
    '',
    '/patient',
    '  Cache-Control: no-store',
    '',
    '/patient/*',
    '  Cache-Control: no-store',
    '',
    '/care',
    '  Cache-Control: no-store',
    '',
    '/care/*',
    '  Cache-Control: no-store',
    '',
    '/hospital',
    '  Cache-Control: no-store',
    '',
    '/hospital/*',
    '  Cache-Control: no-store',
    '',
  ].join('\n'),
);

console.log(`Static demo build ready: ${outDir}`);

function run(command, args, options) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    ...options,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}
