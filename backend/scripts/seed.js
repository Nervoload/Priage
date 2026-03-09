// backend/scripts/seed.js
// ──────────────────────────────────────────────────────────────────────
// Creates test data for local development and smoke testing.
// Idempotent — safe to run multiple times (upserts where possible).
//
// Creates:
//   • 1 Hospital  ("Priage General")
//   • 4 Users     (one per role: ADMIN, DOCTOR, NURSE, STAFF)
//   • 5 Patients  (4 with encounters + 1 signed-in demo user with no encounter)
//   • Patient sessions for demo/testing
//   • Starter patient/staff messages on active encounters
//
// Usage:
//   cd backend && node scripts/seed.js
//
// All passwords: password123
// ──────────────────────────────────────────────────────────────────────

require('dotenv').config();
const bcrypt = require('bcrypt');
const { randomUUID } = require('crypto');
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
    sessionToken: 'seed-alice-session',
    starterMessages: [],
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
    sessionToken: 'seed-bob-session',
    starterMessages: [
      { sender: 'PATIENT', content: 'The pain is sharp when I try to move my right leg.' },
      { sender: 'USER', senderRole: 'NURSE', content: 'We have your arrival recorded. Please stay seated and avoid bearing weight.' },
      { sender: 'USER', senderRole: 'DOCTOR', content: 'Orthopedics has been alerted and your imaging order is queued.' },
    ],
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
    sessionToken: 'seed-carol-session',
    starterMessages: [
      { sender: 'PATIENT', content: 'The lights are making this worse and I am feeling nauseous.' },
      { sender: 'USER', senderRole: 'NURSE', content: 'A nurse is assessing you now. Let us know if the pain spikes further.' },
      { sender: 'USER', senderRole: 'DOCTOR', content: 'Neurology consult is aware of your migraine history and current aura.' },
    ],
  },
  {
    email: 'diana@patient.dev',
    firstName: 'Diana',
    lastName: 'Patel',
    phone: '555-0104',
    age: 41,
    gender: 'Female',
    encounter: {
      status: 'WAITING',
      chiefComplaint: 'Deep laceration on left forearm',
      details: 'Cut while cooking, bleeding controlled at intake. Reports tingling in fingers.',
    },
    sessionToken: 'seed-diana-session',
    starterMessages: [
      { sender: 'PATIENT', content: 'The bandage is soaking through again. Should I press harder?' },
      { sender: 'USER', senderRole: 'STAFF', content: 'Registration is complete. Keep pressure applied and stay near triage.' },
      { sender: 'USER', senderRole: 'NURSE', content: 'Keep firm pressure on the area. We have flagged your chart for reassessment.' },
    ],
  },
  {
    email: 'evan@patient.dev',
    firstName: 'Evan',
    lastName: 'Ross',
    phone: '555-0105',
    age: 31,
    gender: 'Male',
    encounter: null,
    sessionToken: 'seed-evan-session',
    starterMessages: [],
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

  // ── 3. Patients + Encounters + Patient-side demo data ──────────────────

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

    let encounter = null;

    if (p.encounter) {
      // Check if this patient already has an encounter at this hospital
      encounter = await prisma.encounter.findFirst({
        where: {
          patientId: patient.id,
          hospitalId: hospital.id,
        },
      });

      if (!encounter) {
        // Build timestamp data based on status
        const now = new Date();
        const timestamps = { expectedAt: now };
        if (p.encounter.status !== 'EXPECTED') {
          timestamps.arrivedAt = new Date(now.getTime() + 5 * 60_000); // +5min
        }
        if (p.encounter.status === 'TRIAGE' || p.encounter.status === 'WAITING') {
          timestamps.triagedAt = new Date(now.getTime() + 15 * 60_000); // +15min
        }
        if (p.encounter.status === 'WAITING') {
          timestamps.waitingAt = new Date(now.getTime() + 30 * 60_000); // +30min
        }

        encounter = await prisma.encounter.create({
          data: {
            publicId: `enc_${randomUUID()}`,
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

        // For TRIAGE/WAITING patients, create a triage assessment
        if (p.encounter.status === 'TRIAGE' || p.encounter.status === 'WAITING') {
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
          `⏭️  Encounter exists for ${p.firstName} (id=${encounter.id}, status=${encounter.status})`,
        );
      }
    } else {
      console.log(`ℹ️  No seeded encounter for ${p.firstName} (account-only demo user).`);
    }

    const demoSession = await prisma.patientSession.findUnique({
      where: { token: p.sessionToken },
    });

    if (!demoSession) {
      const session = await prisma.patientSession.create({
        data: {
          token: p.sessionToken,
          patientId: patient.id,
          encounterId: encounter?.id ?? null,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });
      console.log(`✅ Created patient session for ${p.firstName} (session id=${session.id})`);
    } else {
      await prisma.patientSession.update({
        where: { id: demoSession.id },
        data: {
          patientId: patient.id,
          encounterId: encounter?.id ?? null,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });
      console.log(`⏭️  Patient session exists for ${p.firstName} (session id=${demoSession.id})`);
    }

    if (encounter && p.starterMessages.length > 0) {
      const existingMessages = await prisma.message.count({
        where: { encounterId: encounter.id, hospitalId: hospital.id },
      });

      if (existingMessages === 0) {
        for (const starter of p.starterMessages) {
          await prisma.message.create({
            data: {
              senderType: starter.sender,
              createdByPatientId: starter.sender === 'PATIENT' ? patient.id : null,
              createdByUserId: starter.sender === 'USER'
                ? createdUsers[starter.senderRole || 'NURSE'].id
                : null,
              content: starter.content,
              encounterId: encounter.id,
              hospitalId: hospital.id,
              isInternal: false,
            },
          });
        }
        console.log(`✅ Seeded ${p.starterMessages.length} starter messages for ${p.firstName}`);
      } else {
        console.log(`⏭️  Messages already exist for ${p.firstName} (encounter #${encounter.id})`);
      }
    }
  }

  // ── Summary ─────────────────────────────────────────────────────────────

  console.log('\n' + '─'.repeat(60));
  console.log('🎉 Seed complete!\n');
  console.log(`  Hospital:  ${hospital.name}`);
  console.log(`  Hospital ID: ${hospital.id}`);
  console.log(`  Hospital slug: ${hospital.slug}`);
  console.log('  Password:  password123  (all accounts)\n');
  console.log('  Staff logins:');
  for (const u of USERS) {
    console.log(`    ${u.role.padEnd(6)}  ${u.email}`);
  }
  console.log('\n  Patient logins:');
  for (const p of PATIENTS) {
    console.log(
      `    ${p.email.padEnd(24)} ${(p.firstName + ' ' + p.lastName).padEnd(16)} session=${p.sessionToken}`,
    );
  }
  console.log('\n  Patient encounters:');
  for (const p of PATIENTS) {
    if (!p.encounter) {
      console.log(
        `    ${(p.firstName + ' ' + p.lastName).padEnd(16)} NO_VISIT   "Account ready for new visit demo"`,
      );
      continue;
    }
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
