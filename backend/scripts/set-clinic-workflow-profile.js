#!/usr/bin/env node
// Operator-only workflow profile change. Dry-run unless --apply is supplied.
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

async function main() {
  const args = process.argv.slice(2);
  const value = (name) => args[args.indexOf(name) + 1];
  const hospitalId = Number(value('--hospital-id'));
  const profile = value('--profile');
  const apply = args.includes('--apply');
  if (!Number.isInteger(hospitalId) || hospitalId < 1 || !['ED', 'CLINIC_APPOINTMENT'].includes(profile)) {
    throw new Error('Usage: node scripts/set-clinic-workflow-profile.js --hospital-id N --profile ED|CLINIC_APPOINTMENT [--apply]');
  }
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  try {
    const result = await prisma.$transaction(async (tx) => {
      const hospital = await tx.hospital.findUnique({ where: { id: hospitalId }, select: { id: true, name: true } });
      if (!hospital) throw new Error(`Hospital ${hospitalId} does not exist`);
      const existing = await tx.hospitalConfig.findUnique({ where: { hospitalId }, select: { config: true } });
      const stored = existing?.config && typeof existing.config === 'object' && !Array.isArray(existing.config) ? existing.config : {};
      const current = stored.workflowProfile === 'CLINIC_APPOINTMENT' ? 'CLINIC_APPOINTMENT' : 'ED';
      const activeCount = await tx.encounter.count({ where: { hospitalId, status: { in: ['INTAKE', 'REQUESTED', 'EXPECTED', 'ADMITTED', 'TRIAGE', 'WAITING'] } } });
      if (apply && current !== profile && activeCount > 0) throw new Error(`Refusing to change profile while ${activeCount} active encounters exist`);
      if (apply && current !== profile) {
        await tx.hospitalConfig.upsert({ where: { hospitalId }, create: { hospitalId, config: { ...stored, version: 2, workflowProfile: profile } }, update: { config: { ...stored, version: 2, workflowProfile: profile } } });
      }
      return { mode: apply ? 'apply' : 'dry-run', hospital, current, requested: profile, activeCount, changed: apply && current !== profile };
    });
    console.log(JSON.stringify(result, null, 2));
  } finally { await prisma.$disconnect(); await pool.end(); }
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
