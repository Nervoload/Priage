#!/usr/bin/env node
// backend/scripts/reseed-dev.js
// Preserves staff/hospital setup while wiping patient-facing dev data.

require('dotenv').config();

const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

const args = new Set(process.argv.slice(2));

if (args.has('--help') || args.has('-h')) {
  console.log(`Usage: node scripts/reseed-dev.js

Deletes patient-facing development data while preserving hospitals, staff users,
configs, partner credentials, and webhook subscriptions.
`);
  process.exit(0);
}

const connectionString =
  process.env.DATABASE_URL || 'postgresql://priage:priage@localhost:5432/priage';
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🧹 Clearing patient-facing dev data...');

  await prisma.$transaction(async (tx) => {
    const correlatedLogs = await tx.logRecord.findMany({
      where: {
        OR: [{ patientId: { not: null } }, { encounterId: { not: null } }],
        correlationId: { not: null },
      },
      select: { correlationId: true },
      distinct: ['correlationId'],
    });

    const correlations = correlatedLogs
      .map((entry) => entry.correlationId)
      .filter(Boolean);

    await tx.encounterReadCursor.deleteMany({});
    await tx.message.deleteMany({});
    await tx.alert.deleteMany({});
    await tx.triageAssessment.deleteMany({});
    await tx.encounterEvent.deleteMany({});
    await tx.asset.deleteMany({
      where: {
        OR: [
          { context: 'MESSAGE_ATTACHMENT' },
          { context: 'INTAKE_IMAGE' },
          { encounterId: { not: null } },
          { patientSessionId: { not: null } },
          { intakeSessionId: { not: null } },
          { createdByPatientId: { not: null } },
        ],
      },
    });
    await tx.contextItem.deleteMany({
      where: {
        OR: [
          { patientId: { not: null } },
          { encounterId: { not: null } },
          { intakeSessionId: { not: null } },
        ],
      },
    });
    await tx.summaryProjection.deleteMany({
      where: {
        OR: [{ encounterId: { not: null } }, { intakeSessionId: { not: null } }],
      },
    });
    await tx.partnerReference.deleteMany({
      where: {
        OR: [{ encounterId: { not: null } }, { intakeSessionId: { not: null } }],
      },
    });
    await tx.commandResult.deleteMany({
      where: {
        OR: [{ encounterId: { not: null } }, { intakeSessionId: { not: null } }],
      },
    });
    await tx.intakeSession.deleteMany({});
    await tx.patientSession.deleteMany({});
    await tx.encounter.deleteMany({});
    await tx.patientProfile.deleteMany({});
    await tx.logRecord.deleteMany({
      where: {
        OR: [{ patientId: { not: null } }, { encounterId: { not: null } }],
      },
    });

    if (correlations.length > 0) {
      await tx.errorReportSnapshot.deleteMany({
        where: { correlationId: { in: correlations } },
      });
    }
  });

  console.log('✅ Patient-facing dev data cleared.');
}

main()
  .catch((error) => {
    console.error('❌ reseed-dev failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => {});
    await pool.end().catch(() => {});
  });
