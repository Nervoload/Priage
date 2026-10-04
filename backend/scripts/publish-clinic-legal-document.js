#!/usr/bin/env node
// Operator-only. Supply clinic/legal-approved copy; no default text is shipped.
require('dotenv').config();
const { readFileSync } = require('node:fs');
const { createHash } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

async function main() {
  const args = process.argv.slice(2);
  const value = (flag) => args[args.indexOf(flag) + 1];
  const kind = value('--kind');
  const version = value('--version');
  const file = value('--file');
  const apply = args.includes('--apply');
  if (!['TERMS', 'PRIVACY'].includes(kind) || !version || version.length > 80 || !file) {
    throw new Error('Usage: node scripts/publish-clinic-legal-document.js --kind TERMS|PRIVACY --version VERSION --file APPROVED.md [--apply]');
  }
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  const bodyMarkdown = readFileSync(file, 'utf8');
  if (!bodyMarkdown.trim() || bodyMarkdown.length > 200_000) throw new Error('Document must contain approved text under 200,000 characters');
  const digest = createHash('sha256').update(bodyMarkdown).digest('hex');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  try {
    const existing = await prisma.legalDocumentVersion.findUnique({ where: { kind_version: { kind, version } } });
    if (existing) throw new Error(`Version ${kind}/${version} already exists and cannot be overwritten`);
    if (!apply) {
      console.log(JSON.stringify({ mode: 'dry-run', kind, version, sha256: digest, characters: bodyMarkdown.length, published: false }, null, 2));
      return;
    }
    const created = await prisma.legalDocumentVersion.create({ data: { kind, version, bodyMarkdown, publishedAt: new Date() }, select: { id: true, kind: true, version: true, publishedAt: true } });
    console.log(JSON.stringify({ mode: 'published', ...created, sha256: digest }, null, 2));
  } finally { await prisma.$disconnect(); await pool.end(); }
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
