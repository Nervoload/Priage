#!/usr/bin/env node
// Service-level rehearsal against a loopback mock DB. It creates no usable staff credentials.
require('dotenv').config();
require('reflect-metadata');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { writeFileSync } = require('node:fs');
const { PrismaClient, Role } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const { NotificationsService } = require('../dist/modules/notifications/notifications.service');
const { NotificationDeliveryService } = require('../dist/modules/notifications/notification-delivery.service');
const { NotificationProvider } = require('../dist/modules/notifications/notification-provider');
const { AppointmentRecoveryService } = require('../dist/modules/notifications/appointment-recovery.service');
const { ClinicAppointmentsService } = require('../dist/modules/clinic/clinic-appointments.service');
const { decrypt, digest } = require('../dist/modules/notifications/notification-core');
if (!process.env.DATABASE_URL || !['localhost', '127.0.0.1'].includes(new URL(process.env.DATABASE_URL).hostname)) throw new Error('Use a loopback mock database');
process.env.CLINIC_EMAIL_MODE = 'capture'; process.env.NODE_ENV = 'development';
const run = randomUUID().slice(0, 8);
const keep = process.env.CLINIC_COMMUNICATIONS_KEEP_FIXTURES === 'true';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });
let hospital; let succeeded = false; const patients = []; const rateKeys = [];
async function main() {
  hospital = await db.hospital.create({ data: { name: 'Mock Communications Clinic', slug: 'communications-' + run, config: { create: { config: { workflowProfile: 'CLINIC_APPOINTMENT' } } },
    clinicEntrySettings: { create: { directoryListed: false, acceptsWalkIns: true, canonicalAlias: 'communications-' + run } }, clinicEntryAliases: { create: { alias: 'communications-' + run } },
    clinicSchedule: { create: { timezone: 'America/Toronto', slotMinutes: 30, capacity: 50, holdMinutes: 60, weeklyWindows: Array.from({ length: 7 }, (_, day) => ({ day, start: '08:00', end: '20:00' })) } } } });
  const staffUser = await db.user.create({ data: { email: 'communications-staff-' + run + '@example.com', password: '!disabled-test-identity', hospitalId: hospital.id, role: Role.ADMIN } });
  const staff = { hospitalId: hospital.id, userId: staffUser.id, role: Role.ADMIN };
  const pilot = { assertTenantEnabled: (id) => { assert.equal(id, hospital.id); return id; }, assertPreviewEnabled: () => hospital.id };
  const events = { emitEncounterEventTx: (tx, event) => tx.encounterEvent.create({ data: { encounterId: event.encounterId, hospitalId: event.hospitalId, type: event.type, metadata: event.metadata, ...event.actor } }), dispatchEncounterEventAndMarkProcessed: async () => {} };
  const notifications = new NotificationsService(db, pilot, events);
  const delivery = new NotificationDeliveryService(db, notifications, new NotificationProvider());
  const recovery = new AppointmentRecoveryService(db, pilot);
  const appointments = new ClinicAppointmentsService(db, pilot, {}, {}, events, { record: async () => {} }, notifications);
  await notifications.updateSettings(staff, { enabled: true, replyTo: 'desk@example.com', contactPhone: '555-0100', reminderMinutes: [1440, 120], expectedVersion: 0 });
  const available = await appointments.availability(undefined, 7, hospital.id);
  const start = available.slots.find((slot) => new Date(slot.startAt).getTime() > Date.now() + 48 * 3600000).startAt;
  async function fixture(startAt = start) {
    const patient = await db.patientProfile.create({ data: { email: randomUUID() + '@intake.local', password: '!disabled', accountEnabled: false } }); patients.push(patient.id);
    const encounter = await db.encounter.create({ data: { publicId: randomUUID(), hospitalId: hospital.id, patientId: patient.id, status: 'REQUESTED', chiefComplaint: 'MOCK CLINICAL CONTENT MUST NOT LEAK', contact: { create: { email: 'communications-' + run + '@example.com', source: 'clinic_guest' } } } });
    const appointment = await db.clinicAppointment.create({ data: { publicId: randomUUID(), requestKey: randomUUID(), hospitalId: hospital.id, encounterId: encounter.id, requestedStartAt: new Date(startAt), endAt: new Date(new Date(startAt).getTime() + 1800000), timezone: 'America/Toronto', slotMinutes: 30, expiresAt: new Date(Date.now() + 3600000) } });
    return appointment;
  }
  const first = await fixture();
  assert.equal(await db.notificationOutbox.count({ where: { appointmentId: first.id } }), 0);
  await assert.rejects(db.$transaction(async (tx) => { await notifications.appointmentChangedTx(tx, { ...first, status: 'CONFIRMED', confirmedStartAt: first.requestedStartAt }, 'confirm', false); throw new Error('force rollback'); }), /force rollback/);
  assert.equal(await db.notificationOutbox.count({ where: { appointmentId: first.id } }), 0);
  const commandKey = randomUUID();
  const confirmed = await appointments.staffCommand(staff, first.id, commandKey, 'confirm', undefined, 1);
  const duplicate = await appointments.staffCommand(staff, first.id, commandKey, 'confirm', undefined, 1);
  assert.equal(duplicate.revision, confirmed.revision);
  assert.equal(await db.notificationOutbox.count({ where: { appointmentId: first.id } }), 3);
  await Promise.all([delivery.deliverPending(), new NotificationDeliveryService(db, notifications, new NotificationProvider()).deliverPending()]);
  let notice = await db.notificationOutbox.findFirstOrThrow({ where: { appointmentId: first.id, purpose: 'confirmation' }, include: { attempts: true } });
  assert.equal(notice.status, 'ACCEPTED'); assert.equal(notice.attempts.length, 1); assert.equal(notice.deliveredAt, null);
  assert.ok(!notice.payload.text.includes('MOCK CLINICAL'));
  // Recover a stale claim after a crash, reusing the exact frozen provider request.
  const payloadBeforeRestart = notice.payload;
  await db.notificationOutbox.update({ where: { id: notice.id }, data: { status: 'PROCESSING', claimedAt: new Date(Date.now() - 121000), claimToken: 'stale-worker', providerEmailId: null } });
  await new NotificationDeliveryService(db, notifications, new NotificationProvider()).deliverPending();
  notice = await db.notificationOutbox.findUniqueOrThrow({ where: { id: notice.id } });
  assert.equal(notice.status, 'ACCEPTED'); assert.deepEqual(notice.payload, payloadBeforeRestart);
  const arrival = await fixture(); const beforeArrival = await appointments.staffCommand(staff, arrival.id, randomUUID(), 'confirm', undefined, 1);
  await appointments.staffCommand(staff, arrival.id, randomUUID(), 'arrive', undefined, beforeArrival.revision);
  assert.equal(await db.notificationOutbox.count({ where: { appointmentId: arrival.id, purpose: 'reminder', status: 'QUEUED' } }), 0);
  const ip = 'mock-ip-' + run; const email = notice.recipientEmail;
  for (const key of ['recovery-email:' + email, 'recovery-ip:' + ip, 'recovery-cooldown:' + email + ':' + first.publicId]) rateKeys.push(digest(key));
  const requested = await recovery.request(hospital.id, first.publicId, email, ip);
  const codeRow = await db.notificationOutbox.findUniqueOrThrow({ where: { challengeId: requested.challengeId } }); const code = decrypt(codeRow.secretEncrypted);
  assert.equal(codeRow.payload, null);
  await delivery.deliverPending();
  const inbox = await notifications.history(staff, first.id);
  assert.ok(inbox.find((row) => row.purpose === 'recovery').payload.text.includes(code));
  for (let attempt = 0; attempt < 2; attempt++) await assert.rejects(recovery.verify(hospital.id, requested.challengeId, code === '000000' ? '111111' : '000000'));
  assert.equal((await db.appointmentRecoveryChallenge.findUniqueOrThrow({ where: { id: requested.challengeId } })).attempts, 2);
  const verified = await recovery.verify(hospital.id, requested.challengeId, code);
  await assert.rejects(recovery.verify(hospital.id, requested.challengeId, code));
  const context = await recovery.authenticate(verified.token);
  const state = await appointments.recoveryState(context);
  assert.equal(state.reference, first.publicId); assert.equal(state.verificationFresh, true);
  assert.ok(!JSON.stringify(state).match(/MOCK CLINICAL|patientId|codeHash|accountEnabled/));
  assert.equal((await db.notificationOutbox.findUniqueOrThrow({ where: { id: codeRow.id } })).payloadEncrypted, null);
  const nextSlot = available.slots.find((slot) => new Date(slot.startAt).getTime() > new Date(start).getTime() + 3600000).startAt;
  const changed = await appointments.recoveryCommand(context, randomUUID(), 'reschedule', nextSlot, confirmed.revision);
  assert.equal(changed.appointment.status, 'REQUESTED'); assert.equal(changed.encounter.status, 'REQUESTED');
  assert.equal(await db.notificationOutbox.count({ where: { appointmentId: first.id, purpose: 'reminder', status: 'QUEUED' } }), 0);
  assert.equal(await db.notificationOutbox.count({ where: { appointmentId: first.id, purpose: 'change_pending', status: 'QUEUED' } }), 1);
  await assert.rejects(appointments.recoveryCommand(context, randomUUID(), 'cancel', undefined, confirmed.revision));
  await db.appointmentRecoverySession.update({ where: { id: context.sessionId }, data: { verifiedAt: new Date(Date.now() - 601000) } });
  await assert.rejects(appointments.recoveryCommand(context, randomUUID(), 'cancel', undefined, changed.revision), /Verify your email again/);
  await db.$transaction(async (tx) => { await tx.encounterContact.update({ where: { encounterId: first.encounterId }, data: { email: 'corrected-' + run + '@example.com', version: { increment: 1 }, verifiedAt: null } }); await notifications.contactChangedTx(tx, await tx.clinicAppointment.findUniqueOrThrow({ where: { id: first.id } })); });
  await assert.rejects(recovery.authenticate(verified.token));
  const second = await fixture(); const two = await appointments.staffCommand(staff, second.id, randomUUID(), 'confirm', undefined, 1);
  const concurrent = await Promise.allSettled([appointments.staffCommand(staff, second.id, randomUUID(), 'cancel', undefined, two.revision), appointments.staffCommand(staff, second.id, randomUUID(), 'arrive', undefined, two.revision)]);
  assert.equal(concurrent.filter((item) => item.status === 'fulfilled').length, 1);
  assert.equal(await db.notificationOutbox.count({ where: { appointmentId: second.id, purpose: 'reminder', status: 'QUEUED' } }), 0);
  const policyRace = await fixture();
  await Promise.all([
    appointments.staffCommand(staff, policyRace.id, randomUUID(), 'confirm', undefined, 1),
    notifications.updateSettings(staff, { enabled: true, replyTo: 'desk@example.com', reminderMinutes: [180], expectedVersion: 1 }),
  ]);
  const policyReminders = await db.notificationOutbox.findMany({ where: { appointmentId: policyRace.id, purpose: 'reminder', status: 'QUEUED' } });
  assert.equal(policyReminders.length, 1);
  assert.equal(policyReminders[0].dueAt.getTime(), policyRace.requestedStartAt.getTime() - 180 * 60000);
  await notifications.updateSettings(staff, { enabled: true, replyTo: 'desk@example.com', reminderMinutes: [1440, 120], expectedVersion: 2 });
  const near = await fixture(new Date(Date.now() + 60 * 60000).toISOString());
  await appointments.staffCommand(staff, near.id, randomUUID(), 'confirm', undefined, 1);
  assert.equal(await db.notificationOutbox.count({ where: { appointmentId: near.id, purpose: 'reminder' } }), 0);
  const limitAppointment = await fixture();
  const limitEmail = 'limit-' + run + '@example.com'; await db.encounterContact.update({ where: { encounterId: limitAppointment.encounterId }, data: { email: limitEmail } });
  const limited = await recovery.request(hospital.id, limitAppointment.publicId, limitEmail, ip + '-limits');
  const limitedRow = await db.notificationOutbox.findUniqueOrThrow({ where: { challengeId: limited.challengeId } }); const goodCode = decrypt(limitedRow.secretEncrypted);
  for (let attempt = 0; attempt < 5; attempt++) await assert.rejects(recovery.verify(hospital.id, limited.challengeId, goodCode === '000000' ? '111111' : '000000'));
  await assert.rejects(recovery.verify(hospital.id, limited.challengeId, goodCode));
  const cooled = await recovery.request(hospital.id, limitAppointment.publicId, limitEmail, ip + '-limits');
  assert.equal(await db.appointmentRecoveryChallenge.count({ where: { id: cooled.challengeId } }), 0);
  await db.appointmentRecoveryChallenge.update({ where: { id: limited.challengeId }, data: { attempts: 0, expiresAt: new Date(Date.now() - 1) } });
  await assert.rejects(recovery.verify(hospital.id, limited.challengeId, goodCode));
  await assert.rejects(recovery.verify(hospital.id + 1000, limited.challengeId, goodCode));
  await delivery.deliverPending();
  succeeded = true;
  console.log('PASS: rollback, no request email, deduplication, concurrent workers/commands, minimal payloads, reminders, verified recovery/replay/guessing/expiry, pending changes, contact revocation and arrival/cancellation.');
  if (keep) {
    const browser = await fixture(); await appointments.staffCommand(staff, browser.id, randomUUID(), 'confirm', undefined, 1); await delivery.deliverPending();
    writeFileSync('/tmp/priage-communications-fixture.json', JSON.stringify({ hospitalId: hospital.id, patientId: (await db.encounter.findUniqueOrThrow({ where: { id: browser.encounterId } })).patientId, alias: hospital.slug, reference: browser.publicId, email, appointmentId: browser.id }, null, 2), { mode: 0o600 });
    console.log('Mock browser fixture saved at /tmp/priage-communications-fixture.json');
  }
}
main().catch((error) => { console.error(error.stack); process.exitCode = 1; }).finally(async () => {
  if (hospital && (!keep || !succeeded)) { await db.encounter.deleteMany({ where: { hospitalId: hospital.id } }); await db.user.deleteMany({ where: { hospitalId: hospital.id } }); await db.hospital.delete({ where: { id: hospital.id } }); await db.patientProfile.deleteMany({ where: { id: { in: patients } } }); await db.recoveryRateLimit.deleteMany({ where: { key: { in: rateKeys } } }); }
  await db.$disconnect(); await pool.end();
});
