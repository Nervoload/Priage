#!/usr/bin/env node

import { mkdirSync, rmSync } from 'node:fs';
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
