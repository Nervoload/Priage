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
const demoRootDir = join(outDir, 'demo');

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
  '--base',
  '/demo/',
  '--outDir',
  '../../dist/static-demo/demo',
  '--emptyOutDir=false',
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
    '/ /demo 302',
    '/demo /demo/index.html 200',
    '/demo/ /demo/index.html 200',
    '/demo/access /demo/index.html 200',
    '/demo/access/* /demo/index.html 200',
    '/demo/patient /demo/patient/index.html 200',
    '/demo/patient/* /demo/patient/index.html 200',
    '/demo/hospital /demo/hospital/index.html 200',
    '/demo/hospital/* /demo/hospital/index.html 200',
    '/demo/care /demo/hospital 302',
    '/demo/care/* /demo/hospital/:splat 302',
    '/patient /demo/patient 302',
    '/patient/* /demo/patient/:splat 302',
    '/care /demo/hospital 302',
    '/care/* /demo/hospital/:splat 302',
    '/hospital /demo/hospital 302',
    '/hospital/* /demo/hospital/:splat 302',
    '',
  ].join('\n'),
);

writeFileSync(
  join(outDir, '_routes.json'),
  JSON.stringify({
    version: 1,
    include: [
      '/api/*',
      '/demo/patient',
      '/demo/patient/*',
      '/demo/hospital',
      '/demo/hospital/*',
      '/demo/care',
      '/demo/care/*',
      '/patient',
      '/patient/*',
      '/hospital',
      '/hospital/*',
      '/care',
      '/care/*',
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
    '/demo/*',
    '  Cache-Control: no-store',
    '',
  ].join('\n'),
);

console.log(`Static demo build ready: ${demoRootDir}`);

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
