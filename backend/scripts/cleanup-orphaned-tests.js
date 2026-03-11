// One-time script to remove orphaned test hospitals from the database.
// Usage: node scripts/cleanup-orphaned-tests.js

require('dotenv/config');
const { Pool } = require('pg');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const testHospitals = await prisma.hospital.findMany({
    where: {
      OR: [
        { slug: { startsWith: 'e2e-test-' } },
        { slug: { startsWith: 'test-log-' } },
        { slug: { startsWith: 'smoke-' } },
        { slug: { startsWith: 'realtime-smoke-' } },
        { slug: { startsWith: 'platform-smoke-' } },
      ],
    },
    select: { id: true, name: true, slug: true },
  });

  console.log(`Found ${testHospitals.length} orphaned test hospitals:`);
  testHospitals.forEach((h) => console.log(`  - ${h.name} (${h.slug}) id=${h.id}`));

  if (testHospitals.length === 0) {
    console.log('Nothing to clean up.');
    return;
  }

  const hospitalIds = testHospitals.map((h) => h.id);

  const encounters = await prisma.encounter.findMany({
    where: { hospitalId: { in: hospitalIds } },
    select: { id: true },
  });
  const encounterIds = encounters.map((e) => e.id);

  const patients = await prisma.patientProfile.findMany({
    where: { encounters: { some: { hospitalId: { in: hospitalIds } } } },
    select: { id: true },
  });
  const patientIds = patients.map((p) => p.id);

  const users = await prisma.user.findMany({
    where: { hospitalId: { in: hospitalIds } },
    select: { id: true },
  });
  const userIds = users.map((u) => u.id);

  const intakeSessions = await prisma.intakeSession.findMany({
    where: { hospitalId: { in: hospitalIds } },
    select: { id: true },
  });
  const intakeSessionIds = intakeSessions.map((i) => i.id);

  const patientSessions = await prisma.patientSession.findMany({
    where: {
      OR: [
        patientIds.length > 0 ? { patientId: { in: patientIds } } : undefined,
        encounterIds.length > 0 ? { encounterId: { in: encounterIds } } : undefined,
      ].filter(Boolean),
    },
    select: { id: true },
  });
  const patientSessionIds = patientSessions.map((ps) => ps.id);

  console.log(`  Encounters: ${encounterIds.length}, Patients: ${patientIds.length}, Users: ${userIds.length}`);

  // Delete in FK dependency order
  const orFilter = (conditions) => ({ OR: conditions.filter(Boolean) });

  if (encounterIds.length > 0 || userIds.length > 0 || patientIds.length > 0) {
    await prisma.encounterReadCursor.deleteMany({
      where: orFilter([
        encounterIds.length > 0 ? { encounterId: { in: encounterIds } } : null,
        userIds.length > 0 ? { userId: { in: userIds } } : null,
        patientIds.length > 0 ? { patientId: { in: patientIds } } : null,
      ]),
    });
  }

  await prisma.message.deleteMany({ where: { hospitalId: { in: hospitalIds } } });
  await prisma.alert.deleteMany({ where: { hospitalId: { in: hospitalIds } } });
  await prisma.triageAssessment.deleteMany({ where: { hospitalId: { in: hospitalIds } } });
  await prisma.encounterEvent.deleteMany({ where: { hospitalId: { in: hospitalIds } } });

  if (intakeSessionIds.length > 0 || encounterIds.length > 0) {
    const sessionOrEncounter = [
      intakeSessionIds.length > 0 ? { intakeSessionId: { in: intakeSessionIds } } : null,
      encounterIds.length > 0 ? { encounterId: { in: encounterIds } } : null,
    ].filter(Boolean);

    await prisma.asset.deleteMany({ where: orFilter(sessionOrEncounter) });
    await prisma.contextItem.deleteMany({ where: orFilter(sessionOrEncounter) });
    await prisma.summaryProjection.deleteMany({ where: orFilter(sessionOrEncounter) });
    await prisma.partnerReference.deleteMany({ where: orFilter(sessionOrEncounter) });
    await prisma.commandResult.deleteMany({ where: orFilter(sessionOrEncounter) });
  }

  await prisma.logRecord.deleteMany({ where: { hospitalId: { in: hospitalIds } } });
  if (intakeSessionIds.length > 0) {
    await prisma.intakeSession.deleteMany({ where: { id: { in: intakeSessionIds } } });
  }
  if (patientSessionIds.length > 0) {
    await prisma.patientSession.deleteMany({ where: { id: { in: patientSessionIds } } });
  }
  if (encounterIds.length > 0) {
    await prisma.encounter.deleteMany({ where: { id: { in: encounterIds } } });
  }
  if (userIds.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }
  await prisma.hospitalConfig.deleteMany({ where: { hospitalId: { in: hospitalIds } } });
  await prisma.hospital.deleteMany({ where: { id: { in: hospitalIds } } });

  // Clean up orphaned patients (no remaining encounters)
  for (const pid of patientIds) {
    const remaining = await prisma.encounter.count({ where: { patientId: pid } });
    if (remaining === 0) {
      await prisma.patientSession.deleteMany({ where: { patientId: pid } });
      await prisma.patientProfile.delete({ where: { id: pid } }).catch(() => {});
    }
  }

  console.log(`\nDone — removed ${testHospitals.length} orphaned test hospitals and all related data.`);
}

main()
  .catch((err) => {
    console.error('Cleanup failed:', err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => {});
    await pool.end().catch(() => {});
  });
