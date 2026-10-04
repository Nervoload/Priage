#!/usr/bin/env node

const { randomUUID } = require('crypto');
const bcrypt = require('bcrypt');
const { PrismaClient, EventType } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');

const SHARED_LEGACY_PASSWORD = '00000';

async function main() {
  require('dotenv').config();
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  const apply = process.argv.includes('--apply');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  const report = { affected: [], manualReview: [], alreadySafe: [] };
  const seenPatients = new Set();
  let cursor;

  try {
    do {
      const events = await prisma.encounterEvent.findMany({
        where: { type: EventType.ENCOUNTER_CREATED },
        orderBy: { id: 'asc' },
        take: 200,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        select: {
          id: true,
          metadata: true,
          encounter: {
            select: {
              id: true,
              hospitalId: true,
              patientId: true,
              patient: { select: { email: true, phone: true, password: true, accountEnabled: true } },
              contact: { select: { id: true } },
            },
          },
        },
      });
      if (events.length === 0) break;
      cursor = events[events.length - 1].id;

      for (const event of events) {
        if (!isStaffCreatedEvent(event.metadata) || !event.encounter) continue;
        const encounter = event.encounter;
        if (seenPatients.has(encounter.patientId)) {
          // Legacy staff creation normally made one profile per encounter.
          // Flag unexpected reuse instead of silently losing a later visit's contact.
          report[encounter.contact ? 'alreadySafe' : 'manualReview'].push({
            patientId: encounter.patientId,
            encounterId: encounter.id,
          });
          continue;
        }
        seenPatients.add(encounter.patientId);

        const reference = { patientId: encounter.patientId, encounterId: encounter.id };
        const classification = await processStaffCreatedEncounter(prisma, encounter, apply);
        report[classification].push(reference);
      }
    } while (true);

    console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', ...report }, null, 2));
    if (report.manualReview.length > 0) process.exitCode = 2;
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

function isStaffCreatedEvent(metadata) {
  return metadata !== null
    && typeof metadata === 'object'
    && !Array.isArray(metadata)
    && metadata.createdFrom === 'hospital_admittance';
}

async function processStaffCreatedEncounter(prisma, encounter, apply) {
  if (!encounter.patient.accountEnabled && encounter.patient.email.endsWith('@intake.local')) {
    return encounter.contact ? 'alreadySafe' : 'manualReview';
  }
  if (!await bcrypt.compare(SHARED_LEGACY_PASSWORD, encounter.patient.password)) {
    return 'manualReview';
  }
  if (!apply) return 'affected';

  await prisma.$transaction(async (tx) => {
    const current = await tx.patientProfile.findUniqueOrThrow({ where: { id: encounter.patientId } });
    if (!await bcrypt.compare(SHARED_LEGACY_PASSWORD, current.password)) {
      throw new Error(`Profile ${encounter.patientId} changed during remediation; rerun and review`);
    }
    if (!encounter.contact) {
      await tx.encounterContact.create({
        data: {
          encounterId: encounter.id,
          hospitalId: encounter.hospitalId,
          email: current.email,
          phone: current.phone,
          source: 'STAFF_ADMITTANCE_BACKFILL',
        },
      });
    }
    await tx.patientSession.deleteMany({ where: { patientId: encounter.patientId } });
    await tx.patientProfile.update({
      where: { id: encounter.patientId },
      data: {
        email: `${randomUUID()}@intake.local`,
        password: await bcrypt.hash(`disabled:${randomUUID()}`, 10),
        accountEnabled: false,
      },
    });
  });
  return 'affected';
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`[staff-created-profile-backfill] ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { isStaffCreatedEvent, processStaffCreatedEncounter };
