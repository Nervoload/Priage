import test from 'node:test';
import assert from 'node:assert/strict';
import { allTenantNames, clinicInstanceName, createTenantEntry, databaseNameForTenant, emptyRegistry, parseDevArgs, portsForSlot, selectTenant, workflowForTenant } from './dev-tenant-config.mjs';

test('tenant flag and test flag are distinct', () => {
  assert.deepEqual(parseDevArgs(['-t', 'clinic', 'test']), { tenantName: 'clinic', instanceName: null, all: false, args: new Set(['test']) });
  assert.deepEqual(parseDevArgs(['--instance', 'clinic-1', '-k']), { tenantName: null, instanceName: 'clinic-1', all: false, args: new Set(['-k']) });
  assert.deepEqual(parseDevArgs(['-all', 'fullseed']), { tenantName: null, instanceName: null, all: true, args: new Set(['fullseed']) });
  assert.throws(() => parseDevArgs(['-t']), /requires clinic/);
  assert.throws(() => parseDevArgs(['-t', 'bad name']), /Tenant names/);
  assert.throws(() => parseDevArgs(['-all', '-t', 'clinic']), /Choose only one/);
  assert.equal(workflowForTenant('clinic-1'), 'CLINIC_APPOINTMENT');
  assert.equal(workflowForTenant('ed-2'), 'ED');
});

test('default targets most recently started running tenant for stop', () => {
  const registry = emptyRegistry();
  const ed = createTenantEntry(registry, 'ed-1');
  const clinic = createTenantEntry(registry, 'clinic-1');
  assert.equal(ed.slot, 0);
  assert.equal(clinic.slot, 1);
  ed.running = true; ed.lastStartedAt = '2026-09-28T10:00:00.000Z';
  clinic.running = true; clinic.lastStartedAt = '2026-09-28T11:00:00.000Z';
  assert.equal(selectTenant(registry, null, true), 'clinic-1');
  assert.equal(selectTenant(registry, null, false), 'ed-1');
  ed.lastStartedAt = '2026-09-28T12:00:00.000Z';
  assert.equal(selectTenant(registry, null, true), 'ed-1');
  ed.running = false;
  assert.equal(selectTenant(registry, null, true), 'clinic-1');
  assert.equal(selectTenant(registry, 'ed-1', true), 'ed-1');
});

test('new clinic names are unique and all includes every registered instance', () => {
  const registry = emptyRegistry();
  assert.deepEqual(allTenantNames(registry, false), ['ed-1']);
  assert.deepEqual(allTenantNames(registry, true), []);
  assert.equal(clinicInstanceName('Clinic', registry), 'clinic-1');
  assert.equal(clinicInstanceName('診療所', registry), 'clinic-1');
  assert.equal(clinicInstanceName('Clinic 1', registry), 'clinic-1');
  createTenantEntry(registry, 'clinic-1');
  assert.equal(clinicInstanceName('Clinic', registry), 'clinic-2');
  assert.equal(clinicInstanceName('Clinic 1', registry), 'clinic-1-2');
  const ed = createTenantEntry(registry, 'ed-1');
  assert.deepEqual(allTenantNames(registry, false), ['ed-1', 'clinic-1']);
  assert.deepEqual(allTenantNames(registry, true), ['ed-1', 'clinic-1']);
  assert.equal(ed.slot, 0);
});

test('tenant ports and database names are isolated', () => {
  assert.deepEqual(portsForSlot(0), { backend: 3000, hospital: 5173, patient: 5174, postgres: 5432, redis: 6379 });
  assert.deepEqual(portsForSlot(1), { backend: 3001, hospital: 5175, patient: 5176, postgres: 5433, redis: 6380 });
  assert.equal(databaseNameForTenant('ed-1'), 'priage');
  assert.equal(databaseNameForTenant('clinic-1'), 'priage_clinic_1');
});
