const TENANT_PATTERN = /^(ed|clinic)(?:-[a-z0-9]+)*$/;

export function parseDevArgs(argv) {
  let tenantName = null;
  let instanceName = null;
  let all = false;
  const args = new Set();
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '-t' || arg === '--tenant') {
      const value = argv[++index];
      if (!value || value.startsWith('-')) throw new Error(`${arg} requires clinic or an existing instance name.`);
      tenantName = validateTenantName(value);
    } else if (arg.startsWith('--tenant=')) {
      tenantName = validateTenantName(arg.slice('--tenant='.length));
    } else if (arg === '--instance') {
      const value = argv[++index];
      if (!value || value.startsWith('-')) throw new Error('--instance requires an existing instance name.');
      instanceName = validateTenantName(value);
    } else if (arg.startsWith('--instance=')) {
      instanceName = validateTenantName(arg.slice('--instance='.length));
    } else if (arg === '-all' || arg === '--all') {
      all = true;
    } else {
      args.add(arg);
    }
  }
  if (Number(Boolean(tenantName)) + Number(Boolean(instanceName)) + Number(all) > 1) {
    throw new Error('Choose only one of -t, --instance, or -all.');
  }
  return { tenantName, instanceName, all, args };
}

export function validateTenantName(value) {
  if (!TENANT_PATTERN.test(value) || value.length > 48) {
    throw new Error('Tenant names must start with ed or clinic and use lowercase letters, numbers, and single dashes (for example clinic-1).');
  }
  return value;
}

export function workflowForTenant(name) {
  validateTenantName(name);
  return name === 'clinic' || name.startsWith('clinic-') ? 'CLINIC_APPOINTMENT' : 'ED';
}

export function portsForSlot(slot) {
  if (!Number.isInteger(slot) || slot < 0 || slot > 100) throw new Error('No more local tenant port slots are available.');
  return {
    backend: 3000 + slot,
    hospital: 5173 + slot * 2,
    patient: 5174 + slot * 2,
    postgres: 5432 + slot,
    redis: 6379 + slot,
  };
}

export function emptyRegistry() {
  return { version: 1, tenants: {} };
}

export function selectTenant(registry, requestedName, wantsKill) {
  if (requestedName) return requestedName;
  if (!wantsKill) return 'ed-1';
  const entries = Object.values(registry.tenants || {});
  const candidates = entries.filter((entry) => entry.running);
  candidates.sort((a, b) => (b.lastStartedAt || '').localeCompare(a.lastStartedAt || ''));
  return candidates[0]?.name || null;
}

export function clinicInstanceName(displayName, registry) {
  const label = displayName.trim();
  if (!label) throw new Error('Clinic name is required.');
  const normalized = label.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (!normalized || normalized === 'clinic') {
    let number = 1;
    while (registry.tenants[`clinic-${number}`]) number += 1;
    return `clinic-${number}`;
  }
  const base = (normalized.startsWith('clinic-') ? normalized : `clinic-${normalized}`)
    .slice(0, 42).replace(/-+$/g, '');
  let name = base;
  for (let suffix = 2; registry.tenants[name]; suffix += 1) {
    name = `${base}-${suffix}`;
  }
  return validateTenantName(name);
}

export function allTenantNames(registry, wantsKill) {
  const entries = Object.values(registry.tenants || {});
  if (!wantsKill && !entries.some((entry) => entry.name === 'ed-1')) {
    entries.push({ name: 'ed-1', slot: 0 });
  }
  return entries.sort((a, b) => a.slot - b.slot).map((entry) => entry.name);
}

export function createTenantEntry(registry, name) {
  validateTenantName(name);
  const existing = registry.tenants[name];
  if (existing) return existing;
  const used = new Set(Object.values(registry.tenants).map((entry) => entry.slot));
  const slot = name === 'ed-1' && !used.has(0) ? 0 : Array.from({ length: 101 }, (_, index) => index).find((index) => index > 0 && !used.has(index));
  if (slot === undefined) throw new Error('No more local tenant port slots are available.');
  const entry = { name, workflowProfile: workflowForTenant(name), slot, running: false, lastStartedAt: null };
  registry.tenants[name] = entry;
  return entry;
}

export function databaseNameForTenant(name) {
  validateTenantName(name);
  return name === 'ed-1' ? 'priage' : `priage_${name.replaceAll('-', '_')}`;
}
