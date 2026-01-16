const { PrismaClient } = require('@prisma/client');
const { randomUUID } = require('crypto');

const prisma = new PrismaClient();

const baseUrl = process.env.API_BASE_URL ?? 'http://localhost:3000';
const hospitalId = process.env.HOSPITAL_ID ? Number(process.env.HOSPITAL_ID) : null;

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
    ...options,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Request failed ${response.status} ${response.statusText}: ${text}`);
  }

  return response.json();
}

async function main() {
  if (!hospitalId || Number.isNaN(hospitalId)) {
    throw new Error('HOSPITAL_ID must be set to an existing hospital id for this smoke test.');
  }

  const patient = await prisma.patientProfile.create({
    data: {
      email: `${randomUUID()}@encounter-smoke.local`,
      password: randomUUID(),
      firstName: 'Encounter',
      lastName: 'Smoke',
    },
  });

  const encounter = await request('/encounters', {
    method: 'POST',
    body: JSON.stringify({
      patientId: patient.id,
      hospitalId,
      chiefComplaint: 'Headache and dizziness',
      details: 'Symptoms started this morning.',
    }),
  });

  console.log('Created encounter:', encounter.id);

  const transitions = [
    { path: `/encounters/${encounter.id}/arrived`, label: 'arrived' },
    { path: `/encounters/${encounter.id}/start-exam`, label: 'start-exam' },
    { path: `/encounters/${encounter.id}/waiting`, label: 'waiting' },
    { path: `/encounters/${encounter.id}/discharge`, label: 'discharge' },
  ];

  for (const transition of transitions) {
    const updated = await request(transition.path, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    console.log(`Transitioned (${transition.label}) ->`, updated.status);
  }

  const events = await prisma.encounterEvent.findMany({
    where: { encounterId: encounter.id },
    orderBy: { createdAt: 'asc' },
  });

  console.log('Encounter events:');
  for (const event of events) {
    console.log(`- ${event.type} @ ${event.createdAt.toISOString()}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
