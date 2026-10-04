#!/usr/bin/env node
// Disposable local data so the gated clinic UI can be exercised without operator setup.
require('dotenv').config();

const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

async function main() {
  const tenantName = process.env.PRIAGE_DEV_TENANT_NAME;
  const clinicId = Number(process.env.PILOT_CLINIC_ID);
  const url = new URL(process.env.DATABASE_URL || '');
  if (process.env.NODE_ENV !== 'development' || !/^clinic(?:-[a-z0-9]+)*$/.test(tenantName || '')
    || !['localhost', '127.0.0.1'].includes(url.hostname)
    || url.pathname !== `/priage_${tenantName.replaceAll('-', '_')}`
    || !Number.isInteger(clinicId) || clinicId < 1) {
    throw new Error('Local clinic preview seed requires a named clinic tenant and its loopback development database');
  }

  const pool = new Pool({ connectionString: url.toString() });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  try {
    const clinic = await prisma.hospital.findUnique({ where: { id: clinicId }, include: { config: true } });
    if (!clinic || clinic.slug !== tenantName || clinic.config?.config?.workflowProfile !== 'CLINIC_APPOINTMENT') {
      throw new Error('The selected clinic does not match the named development tenant');
    }
    const entry = await prisma.clinicEntrySettings.findUnique({ where: { hospitalId: clinicId } });
    if (!entry) {
      const acceptsWalkIns = process.env.PRIAGE_DEV_CLINIC_ACCEPTS_WALK_INS !== 'false';
      await prisma.$transaction(async (tx) => {
        await tx.clinicEntrySettings.create({ data: {
          hospitalId: clinicId, canonicalAlias: tenantName, directoryListed: false, acceptsWalkIns,
        } });
        await tx.clinicEntryAlias.create({ data: { hospitalId: clinicId, alias: tenantName } });
      });
      console.log(`[dev-clinic] Created local clinic entry at /${tenantName}/start; walk-ins ${acceptsWalkIns ? 'enabled' : 'disabled'}.`);
    }
    const timezone = process.env.PRIAGE_DEV_CLINIC_TIMEZONE || 'America/Toronto';
    new Intl.DateTimeFormat('en-CA', { timeZone: timezone });
    const schedule = await prisma.clinicSchedule.findUnique({ where: { hospitalId: clinicId } });
    if (!schedule) {
      await prisma.clinicSchedule.create({ data: {
        hospitalId: clinicId, timezone, slotMinutes: 30, capacity: 1, holdMinutes: 1440,
        weeklyWindows: [1, 2, 3, 4, 5].map((day) => ({ day, start: '09:00', end: '17:00' })),
      } });
      console.log(`[dev-clinic] Added mock weekday appointment hours (09:00–17:00 ${timezone}).`);
    }
    for (const kind of ['TERMS', 'PRIVACY']) {
      const published = await prisma.legalDocumentVersion.findFirst({ where: { kind, publishedAt: { not: null } } });
      if (published) continue;
      await prisma.legalDocumentVersion.create({ data: {
        kind, version: 'local-mock-preview-v1',
        bodyMarkdown: `# Local mock ${kind === 'TERMS' ? 'Terms' : 'Privacy'}\n\nDevelopment-only placeholder for testing the appointment flow. This text is not approved for patients or use outside this local mock database.`,
        publishedAt: new Date(),
      } });
      console.log(`[dev-clinic] Added mock ${kind} text for the local preview.`);
    }
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error) => { console.error(`[dev-clinic] ${error.message}`); process.exitCode = 1; });
