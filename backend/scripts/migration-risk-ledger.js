#!/usr/bin/env node

// Read-only inventory of paths that can delete, cascade, or discard records.
// It is intentionally broad: a false positive receives review; a missed
// destructive path is unacceptable for a clinical system.

const fs = require('node:fs');
const path = require('node:path');

const backendRoot = path.resolve(__dirname, '..');
const repositoryRoot = path.resolve(backendRoot, '..');
const targets = [
  { kind: 'migration', root: path.join(backendRoot, 'prisma', 'migrations'), extensions: new Set(['.sql']) },
  { kind: 'maintenance_script', root: path.join(backendRoot, 'scripts'), extensions: new Set(['.js', '.mjs']) },
  { kind: 'runtime_cleanup', root: path.join(backendRoot, 'src'), extensions: new Set(['.ts']) },
];
const rules = [
  { category: 'schema_drop', pattern: /\bDROP\s+(?:TABLE|COLUMN|INDEX|TYPE)\b/gi },
  { category: 'database_delete', pattern: /\b(?:DELETE\s+FROM|TRUNCATE)\b/gi },
  { category: 'foreign_key_cascade', pattern: /\bON\s+DELETE\s+(?:CASCADE|SET\s+NULL)\b/gi },
  { category: 'orm_delete', pattern: /\.(?:deleteMany|delete)\s*\(/g },
  { category: 'object_storage_delete', pattern: /\.storage\.delete\s*\(/g },
];

const entries = targets.flatMap((target) => scanTarget(target));
const report = {
  ledgerVersion: 1,
  generatedAt: new Date().toISOString(),
  entryCount: entries.length,
  countsByCategory: Object.fromEntries(rules.map((rule) => [
    rule.category,
    entries.filter((entry) => entry.category === rule.category).length,
  ])),
  entries,
  reviewerReminder: 'Every entry needs tenant scope, pre/post counts, recovery/rollback notes, and an owner before a destructive change ships. This inventory does not authorize deletion.',
};

if (process.argv.includes('--summary')) {
  process.stdout.write(`${JSON.stringify({
    ledgerVersion: report.ledgerVersion,
    entryCount: report.entryCount,
    countsByCategory: report.countsByCategory,
  })}\n`);
} else {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

function scanTarget(target) {
  return walk(target.root)
    .filter((file) => target.extensions.has(path.extname(file)))
    .flatMap((file) => scanFile(file, target.kind));
}

function scanFile(file, kind) {
  const source = fs.readFileSync(file, 'utf8');
  return rules.flatMap((rule) => {
    rule.pattern.lastIndex = 0;
    const entries = [];
    for (const match of source.matchAll(rule.pattern)) {
      const before = source.slice(0, match.index);
      entries.push({
        kind,
        category: rule.category,
        file: path.relative(repositoryRoot, file).split(path.sep).join('/'),
        line: before.split('\n').length,
        match: match[0].replace(/\s+/g, ' '),
      });
    }
    return entries;
  });
}

function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(absolute) : [absolute];
  });
}
