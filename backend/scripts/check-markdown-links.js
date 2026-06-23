#!/usr/bin/env node

// Validates repository-local Markdown links without following external URLs.
// Kept deliberately dependency-free so it is safe to run in CI and offline.

const fs = require('node:fs');
const path = require('node:path');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const roots = [
  'README.md', 'SETUP.md', 'FEATURES.md',
  'backend/README.md', 'backend/docs', 'docs', 'Apps/HospitalApp/FEATURES.md',
];
const failures = [];

for (const root of roots) {
  for (const file of walk(path.join(repositoryRoot, root))) {
    if (!file.endsWith('.md')) continue;
    const source = fs.readFileSync(file, 'utf8');
    for (const match of source.matchAll(/\]\((?!https?:|mailto:|#)([^)#]+)(?:#[^)]+)?\)/g)) {
      const target = match[1];
      if (target.startsWith('/')) continue;
      if (!fs.existsSync(path.resolve(path.dirname(file), target))) {
        failures.push(`${relative(file)} -> ${target}`);
      }
    }
  }
}

if (failures.length > 0) {
  console.error(`Broken local Markdown links (${failures.length}):\n${failures.join('\n')}`);
  process.exitCode = 1;
} else {
  console.log('ok - local Markdown links resolve');
}

function walk(target) {
  if (!fs.existsSync(target)) return [];
  if (fs.statSync(target).isFile()) return [target];
  return fs.readdirSync(target, { withFileTypes: true }).flatMap((entry) => walk(path.join(target, entry.name)));
}

function relative(file) {
  return path.relative(repositoryRoot, file).split(path.sep).join('/');
}
