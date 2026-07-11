#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputRoot = join(projectRoot, 'dist', 'static-demo');
const requiredFiles = [
  'demo/index.html',
  'demo/patient/index.html',
  'demo/care/index.html',
];
const requiredDirectories = [
  'demo/assets',
  'demo/patient/assets',
  'demo/care/assets',
];
const forbiddenPatterns = [
  { label: 'localhost:3000', pattern: /localhost:3000/ },
  { label: 'absolute localhost URL', pattern: /http:\/\/localhost/ },
  { label: 'plaintext demo-code propagation', pattern: /demoCode/ },
  { label: 'session-id URL propagation', pattern: /demoSessionId/ },
];
const textExtensions = new Set(['.css', '.html', '.js', '.json', '.map', '.mjs', '.txt']);

const failures = [];

for (const relativePath of requiredFiles) {
  const path = join(outputRoot, relativePath);
  if (!existsSync(path) || !statSync(path).isFile()) failures.push(`Missing file: ${relativePath}`);
}

for (const relativePath of requiredDirectories) {
  const path = join(outputRoot, relativePath);
  if (!existsSync(path) || !statSync(path).isDirectory()) failures.push(`Missing directory: ${relativePath}`);
}

if (existsSync(join(outputRoot, 'demo', 'hospital'))) {
  failures.push('Legacy canonical build directory must not exist: demo/hospital');
}

for (const filePath of walkFiles(outputRoot)) {
  if (!textExtensions.has(extensionOf(filePath))) continue;
  const contents = readFileSync(filePath, 'utf8');
  for (const forbidden of forbiddenPatterns) {
    if (forbidden.pattern.test(contents)) {
      failures.push(`${forbidden.label} found in ${filePath.slice(outputRoot.length + 1)}`);
    }
  }
}

if (failures.length > 0) {
  console.error('Static demo release check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Static demo release check passed.');

function walkFiles(root) {
  if (!existsSync(root)) return [];
  const files = [];
  for (const entry of readdirSync(root)) {
    const path = join(root, entry);
    if (statSync(path).isDirectory()) files.push(...walkFiles(path));
    else files.push(path);
  }
  return files;
}

function extensionOf(path) {
  const leaf = path.slice(path.lastIndexOf('/') + 1);
  const dot = leaf.lastIndexOf('.');
  return dot >= 0 ? leaf.slice(dot).toLowerCase() : '';
}
