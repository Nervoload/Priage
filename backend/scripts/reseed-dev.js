#!/usr/bin/env node
// backend/scripts/reseed-dev.js
// Preserves staff/hospital setup while wiping patient-facing dev data.

require('dotenv').config();

const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const { prepareDestructiveAction, printDestructiveManifest } = require('./lib/destructive-safety');

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

async function main() {
  const action = prepareDestructiveAction({
    scriptName: 'reseed-dev.js',
    databaseUrl: connectionString,
  });
  const pool = new Pool({ connectionString });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const manifest = await buildManifest(prisma);
    printDestructiveManifest({ scriptName: 'reseed-dev.js', action, counts: manifest });
    if (action.mode === 'dry-run') return;

    console.log('🧹 Clearing patient-facing development data...');

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

    console.log('✅ Patient-facing development data cleared.');
  } finally {
    await prisma.$disconnect().catch(() => {});
    await pool.end().catch(() => {});
  }
}

async function buildManifest(prisma) {
  const patientFacingAssetWhere = {
    OR: [
      { context: 'MESSAGE_ATTACHMENT' },
      { context: 'INTAKE_IMAGE' },
      { encounterId: { not: null } },
      { patientSessionId: { not: null } },
      { intakeSessionId: { not: null } },
      { createdByPatientId: { not: null } },
    ],
  };
  const patientFacingContextWhere = {
    OR: [{ patientId: { not: null } }, { encounterId: { not: null } }, { intakeSessionId: { not: null } }],
  };
  const patientFacingProjectionWhere = {
    OR: [{ encounterId: { not: null } }, { intakeSessionId: { not: null } }],
  };
  const patientFacingLogWhere = {
    OR: [{ patientId: { not: null } }, { encounterId: { not: null } }],
  };
  const [
    encounterReadCursors, messages, alerts, triageAssessments, encounterEvents,
    assets, contextItems, summaryProjections, partnerReferences, commandResults,
    intakeSessions, patientSessions, encounters, patientProfiles, logRecords,
  ] = await Promise.all([
    prisma.encounterReadCursor.count(), prisma.message.count(), prisma.alert.count(),
    prisma.triageAssessment.count(), prisma.encounterEvent.count(), prisma.asset.count({ where: patientFacingAssetWhere }),
    prisma.contextItem.count({ where: patientFacingContextWhere }), prisma.summaryProjection.count({ where: patientFacingProjectionWhere }),
    prisma.partnerReference.count({ where: patientFacingProjectionWhere }), prisma.commandResult.count({ where: patientFacingProjectionWhere }),
    prisma.intakeSession.count(), prisma.patientSession.count(), prisma.encounter.count(), prisma.patientProfile.count(),
    prisma.logRecord.count({ where: patientFacingLogWhere }),
  ]);
  return {
    encounterReadCursors, messages, alerts, triageAssessments, encounterEvents,
    assets, contextItems, summaryProjections, partnerReferences, commandResults,
    intakeSessions, patientSessions, encounters, patientProfiles, logRecords,
  };
}

main()
  .catch((error) => {
    console.error('❌ reseed-dev failed:', error.message);
    process.exitCode = 1;
  });
