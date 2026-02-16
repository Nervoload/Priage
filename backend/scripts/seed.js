// backend/scripts/seed.js
// ──────────────────────────────────────────────────────────────────────
// Creates test data for local development and smoke testing.
// Idempotent — safe to run multiple times (upserts where possible).
//
// Creates:
//   • 1 Hospital  ("Priage General")
//   • 4 Users     (one per role: ADMIN, DOCTOR, NURSE, STAFF)
//   • 3 Patients  with encounters in different statuses
//
// Usage:
//   cd backend && node scripts/seed.js
//
// All passwords: password123
// ──────────────────────────────────────────────────────────────────────

require('dotenv').config();
const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');

const connectionString =
  process.env.DATABASE_URL || 'postgresql://priage:priage@localhost:5432/priage';
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ─── Seed data ──────────────────────────────────────────────────────────────

const PASSWORD = 'password123';

const USERS = [
  { email: 'admin@priage.dev',  role: 'ADMIN'  },
  { email: 'doctor@priage.dev', role: 'DOCTOR' },
  { email: 'nurse@priage.dev',  role: 'NURSE'  },
  { email: 'staff@priage.dev',  role: 'STAFF'  },
];

const PATIENTS = [
  {
    email: 'alice@patient.dev',
    firstName: 'Alice',
    lastName: 'Johnson',
    phone: '555-0101',
    age: 34,
    gender: 'Female',
    encounter: {
      status: 'EXPECTED',
      chiefComplaint: 'Persistent chest pain radiating to left arm',
      details: 'Patient called ahead, reports pain started 2 hours ago. No prior cardiac history.',
    },
  },
  {
    email: 'bob@patient.dev',
    firstName: 'Bob',
    lastName: 'Martinez',
    phone: '555-0102',
    age: 72,
    gender: 'Male',
    encounter: {
      status: 'ADMITTED',
      chiefComplaint: 'Fall with suspected hip fracture',
      details: 'Fell at home, unable to bear weight on right leg. Alert and oriented.',
    },
  },
  {
    email: 'carol@patient.dev',
    firstName: 'Carol',
    lastName: 'Chen',
    phone: '555-0103',
    age: 28,
    gender: 'Female',
    encounter: {
      status: 'TRIAGE',
      chiefComplaint: 'Severe migraine with visual aura',
      details: 'Recurring migraines, this episode more intense than usual. Nausea present.',
    },
  },
];

// ─── Main ───────────────────────────────────────────────────────────────────

async function seed() {
  console.log('🌱 Seeding database...\n');

  const hashedPassword = await bcrypt.hash(PASSWORD, 10);

  // ── 1. Hospital ─────────────────────────────────────────────────────────

  let hospital = await prisma.hospital.findFirst({
    where: { slug: 'priage-general' },
  });

  if (!hospital) {
    hospital = await prisma.hospital.create({
      data: { name: 'Priage General Hospital', slug: 'priage-general' },
    });
    console.log(`✅ Created hospital: ${hospital.name} (id=${hospital.id})`);
  } else {
    console.log(`⏭️  Hospital exists: ${hospital.name} (id=${hospital.id})`);
  }

  // ── 2. Users (one per role) ─────────────────────────────────────────────

  const createdUsers = {};

  for (const u of USERS) {
    let user = await prisma.user.findUnique({ where: { email: u.email } });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: u.email,
          password: hashedPassword,
          role: u.role,
          hospitalId: hospital.id,
        },
      });
      console.log(`✅ Created ${u.role.padEnd(6)} → ${u.email} (id=${user.id})`);
    } else {
      console.log(`⏭️  ${u.role.padEnd(6)} exists → ${u.email} (id=${user.id})`);
    }
    createdUsers[u.role] = user;
  }

  // ── 3. Patients + Encounters ────────────────────────────────────────────

  for (const p of PATIENTS) {
    let patient = await prisma.patientProfile.findUnique({
      where: { email: p.email },
    });

    if (!patient) {
      patient = await prisma.patientProfile.create({
        data: {
          email: p.email,
          password: hashedPassword,
          firstName: p.firstName,
          lastName: p.lastName,
          phone: p.phone,
          age: p.age,
          gender: p.gender,
        },
      });
      console.log(`✅ Created patient: ${p.firstName} ${p.lastName} (id=${patient.id})`);
    } else {
      console.log(`⏭️  Patient exists: ${p.firstName} ${p.lastName} (id=${patient.id})`);
    }

    // Check if this patient already has an encounter at this hospital
    const existingEncounter = await prisma.encounter.findFirst({
      where: {
        patientId: patient.id,
        hospitalId: hospital.id,
      },
    });

    if (!existingEncounter) {
      // Build timestamp data based on status
      const now = new Date();
      const timestamps = { expectedAt: now };
      if (p.encounter.status !== 'EXPECTED') {
        timestamps.arrivedAt = new Date(now.getTime() + 5 * 60_000); // +5min
      }
      if (p.encounter.status === 'TRIAGE') {
        timestamps.triagedAt = new Date(now.getTime() + 15 * 60_000); // +15min
      }

      const encounter = await prisma.encounter.create({
        data: {
          status: p.encounter.status,
          chiefComplaint: p.encounter.chiefComplaint,
          details: p.encounter.details,
          hospitalId: hospital.id,
          patientId: patient.id,
          ...timestamps,
        },
      });

      console.log(
        `✅ Created encounter #${encounter.id}: ${p.firstName} → ${p.encounter.status}`,
      );

      // Create an initial event for the encounter
      await prisma.encounterEvent.create({
        data: {
          type: 'ENCOUNTER_CREATED',
          encounterId: encounter.id,
          hospitalId: hospital.id,
          metadata: {
            chiefComplaint: p.encounter.chiefComplaint,
            source: 'seed-script',
          },
          processedAt: now,
        },
      });

      // For TRIAGE patients, create a triage assessment
      if (p.encounter.status === 'TRIAGE') {
        const nurseUser = createdUsers['NURSE'];
        const assessment = await prisma.triageAssessment.create({
          data: {
            ctasLevel: 3,
            priorityScore: 60,
            chiefComplaint: p.encounter.chiefComplaint,
            painLevel: 6,
            vitalSigns: {
              bloodPressure: '128/84',
              heartRate: 88,
              temperature: 37.1,
              respiratoryRate: 18,
              oxygenSaturation: 97,
            },
            note: 'Initial triage assessment — seed data',
            createdByUserId: nurseUser.id,
            encounterId: encounter.id,
            hospitalId: hospital.id,
          },
        });

        // Link as current triage
        await prisma.encounter.update({
          where: { id: encounter.id },
          data: {
            currentTriageId: assessment.id,
            currentCtasLevel: 3,
            currentPriorityScore: 60,
          },
        });

        console.log(
          `✅ Created triage assessment #${assessment.id} for ${p.firstName} (CTAS 3)`,
        );
      }
    } else {
      console.log(
        `⏭️  Encounter exists for ${p.firstName} (id=${existingEncounter.id}, status=${existingEncounter.status})`,
      );
    }
  }

  // ── Summary ─────────────────────────────────────────────────────────────

  console.log('\n' + '─'.repeat(60));
  console.log('🎉 Seed complete!\n');
  console.log('  Hospital:  Priage General Hospital');
  console.log('  Password:  password123  (all accounts)\n');
  console.log('  Staff logins:');
  for (const u of USERS) {
    console.log(`    ${u.role.padEnd(6)}  ${u.email}`);
  }
  console.log('\n  Patients:');
  for (const p of PATIENTS) {
    console.log(
      `    ${(p.firstName + ' ' + p.lastName).padEnd(16)} ${p.encounter.status.padEnd(10)} "${p.encounter.chiefComplaint.slice(0, 45)}…"`,
    );
  }
  console.log('─'.repeat(60) + '\n');
}

seed()
  .catch((err) => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
