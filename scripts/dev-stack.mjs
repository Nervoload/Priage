#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { allTenantNames, clinicInstanceName, createTenantEntry, databaseNameForTenant, emptyRegistry, parseDevArgs, portsForSlot, selectTenant } from './dev-tenant-config.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');
const backendDir = join(projectRoot, 'backend');
const patientAppDir = join(projectRoot, 'Apps', 'PatientApp');
const hospitalAppDir = join(projectRoot, 'Apps', 'HospitalApp');
const versionFile = join(projectRoot, 'VERSION');
const rootRuntimeDir = process.env.PRIAGE_DEV_RUNTIME_DIR || join(projectRoot, '.priage-dev');
const rawArgs = process.argv.slice(2);
if (rawArgs.includes('cloud')) {
  const cloudArgs = rawArgs.filter((value) => value !== 'cloud');
  const result = spawnSync('node', [join(projectRoot, 'scripts', 'cloud-stack.mjs'), ...(cloudArgs.length > 0 ? cloudArgs : ['up'])], {
    cwd: projectRoot,
    stdio: 'inherit',
  });
  process.exit(result.status ?? 1);
}
let parsedArgs;
try {
  parsedArgs = parseDevArgs(rawArgs);
} catch (error) {
  console.error(`[priage-dev] ${error.message}`);
  process.exit(1);
}
const { tenantName: requestedTenant, instanceName, all: wantsAll, args } = parsedArgs;
const wantsHelp = args.has('--help') || args.has('-h');
const wantsNewUser = args.has('newuser') || args.has('-u');
const wantsReseed = args.has('reseed');
const wantsFullseed = args.has('fullseed');
const wantsSmoke = args.has('test') || args.has('-T');
const wantsLogs = args.has('logs') || args.has('-l');
const wantsVerbose = args.has('--verbose') || args.has('-v');
const wantsKill = args.has('kill') || args.has('-k') || args.has('--kill');
const registry = readRegistry();
if (wantsHelp) {
  printUsage();
  process.exit(0);
}
if (wantsAll) {
  const names = allTenantNames(registry, wantsKill);
  if (!names.length) console.log('[priage-dev] No registered tenant instances to operate on.');
  let failed = false;
  for (const name of names) {
    console.log(`\n[priage-dev] ${name}: ${[...args].join(' ') || 'start'}`);
    const result = spawnSync(process.execPath, [fileURLToPath(import.meta.url), '--instance', name, ...args], {
      cwd: projectRoot, stdio: 'inherit', env: process.env,
    });
    if (result.status !== 0) {
      failed = true;
      console.error(`[priage-dev] ${name} failed; continuing with the other instances.`);
    }
  }
  process.exit(failed ? 1 : 0);
}
let selectedTenantName;
try {
  if (instanceName && instanceName !== 'ed-1' && !registry.tenants[instanceName]) {
    throw new Error(`Unknown instance ${instanceName}. Run ./priage-dev -t clinic to create a clinic.`);
  }
  if (requestedTenant === 'clinic') {
    if (wantsKill) throw new Error('-t clinic creates a new clinic; use --instance NAME -k or -all -k to stop one.');
    if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error('-t clinic needs an interactive terminal to collect clinic details.');
    const details = await promptClinicDetails();
    selectedTenantName = clinicInstanceName(details.name, registry);
    const created = createTenantEntry(registry, selectedTenantName);
    created.clinicDetails = details;
    writeRegistry();
    console.log(`[priage-dev] Created ${details.name} as ${selectedTenantName}; each instance has its own database and ports.`);
  } else {
    if (requestedTenant?.startsWith('clinic-') && !registry.tenants[requestedTenant]) {
      throw new Error(`Unknown clinic instance ${requestedTenant}. Run ./priage-dev -t clinic to create it.`);
    }
    selectedTenantName = selectTenant(registry, instanceName || requestedTenant, wantsKill);
  }
} catch (error) {
  console.error(`[priage-dev] ${error.message}`);
  process.exit(1);
}
const tenant = selectedTenantName && !wantsKill ? createTenantEntry(registry, selectedTenantName) : registry.tenants[selectedTenantName];
const ports = tenant ? portsForSlot(tenant.slot) : null;
const runtimeDir = tenant?.name === 'ed-1' ? rootRuntimeDir : join(rootRuntimeDir, 'tenants', tenant?.name || 'none');
const isClinic = tenant?.workflowProfile === 'CLINIC_APPOINTMENT';
const databaseUrl = tenant ? `postgresql://priage:priage@localhost:${ports.postgres}/${databaseNameForTenant(tenant.name)}?schema=public` : null;
const composeArgs = tenant?.name === 'ed-1'
  ? ['compose']
  : ['compose', '-f', 'docker-compose.dev-tenant.yml', '-p', `priage-dev-${tenant?.name}`];
const composeEnv = tenant?.name === 'ed-1'
  ? { POSTGRES_USER: 'priage', POSTGRES_PASSWORD: 'priage', POSTGRES_DB: 'priage' }
  : { POSTGRES_DB: tenant ? databaseNameForTenant(tenant.name) : '', POSTGRES_HOST_PORT: String(ports?.postgres || ''), REDIS_HOST_PORT: String(ports?.redis || '') };

const services = [
  {
    id: 'backend',
    name: 'backend',
    title: `Priage ${tenant?.name}: Backend`,
    cwd: backendDir,
    port: ports?.backend,
    command: 'npm run start:dev',
    env: (version, instanceEnv) => ({
      APP_VERSION: version,
      CLINIC_EMAIL_MODE: process.env.CLINIC_EMAIL_MODE || 'capture',
      PATIENT_APP_URL: process.env.PATIENT_APP_URL || `http://localhost:${ports?.patient}`,
      ...instanceEnv,
      ...(wantsVerbose ? { LOG_LEVEL: 'verbose' } : {}),
    }),
  },
  {
    id: 'hospital',
    name: 'hospital',
    title: `Priage ${tenant?.name}: Hospital`,
    cwd: hospitalAppDir,
    port: ports?.hospital,
    command: `npm run dev -- --host 0.0.0.0 --port ${ports?.hospital} --strictPort`,
    env: () => ({ VITE_API_URL: `http://localhost:${ports?.backend}`, VITE_CLINIC_PILOT_MODE: String(isClinic),
      VITE_HOSPITAL_SLUG: isClinic ? tenant.name : '', VITE_PATIENT_APP_URL: `http://localhost:${ports?.patient}` }),
  },
  {
    id: 'patient',
    name: 'patient',
    title: `Priage ${tenant?.name}: Patient`,
    cwd: patientAppDir,
    port: ports?.patient,
    command: `npm run dev -- --host 0.0.0.0 --port ${ports?.patient} --strictPort`,
    env: () => ({ VITE_API_URL: `http://localhost:${ports?.backend}`, VITE_CLINIC_PILOT_MODE: String(isClinic) }),
  },
];
const backendService = services[0];
const hospitalService = services[1];
const patientService = services[2];
const backendReadinessUrl = `http://localhost:${backendService.port}/health/ready`;
const hospitalAppUrl = `http://localhost:${hospitalService.port}`;
const patientAppUrl = `http://localhost:${patientService.port}`;

main().catch((error) => {
  console.error(`\n[priage-dev] ${error.message}`);
  process.exit(1);
});

async function main() {
  if (!tenant) {
    console.log('[priage-dev] No running tenant instance to stop.');
    return;
  }
  ensureRuntimeDir();

  if (wantsKill) {
    stopServices();
    stopDockerServices();
    tenant.running = false;
    writeRegistry();
    console.log(`[priage-dev] ${tenant.name} processes and containers stopped. Its database remains available when restarted.`);
    return;
  }

  ensureFileExists(versionFile, 'Missing VERSION file.');
  const version = readVersion();

  console.log(`Priage v${version} · ${tenant.name} (${tenant.workflowProfile})`);
  warnOnVersionDrift(version);
  ensurePlatform();
  ensureEnvFiles();
  ensurePrerequisites();
  const stackStatus = await getStackStatus();
  logStackStatus(stackStatus);

  const shouldRunStartup = !stackStatus.ready;
  if (shouldRunStartup) {
    console.log('\n== Startup ==');
    console.log('[priage-dev] Stack is not fully ready; running startup flow.');
    ensureDockerServices(stackStatus.docker);
    installDependencies();
    runPrismaSetup();
  } else {
    console.log('\n== Startup ==');
    console.log('[priage-dev] Stack already fully running; skipping startup flow.');
    if (wantsVerbose) {
      console.warn(
        '[priage-dev] --verbose only affects freshly launched backend processes; the current backend log level is unchanged.',
      );
    }
  }

  let devAccountEnv = loadDevAccountEnv();
  let instanceEnv = buildInstanceEnv(devAccountEnv);
  if (shouldRunStartup || wantsNewUser) {
    const bootstrapArgs = ['scripts/bootstrap-dev-accounts.js'];
    if (wantsNewUser) {
      bootstrapArgs.push('--create-extra-user');
    }

    const bootstrapLabel = wantsNewUser && !shouldRunStartup
      ? 'Adding one new hospital user'
      : 'Ensuring local dev accounts';
    runStep(bootstrapLabel, 'node', bootstrapArgs, {
      cwd: backendDir,
      env: { ...instanceEnv, PRIAGE_DEV_RUNTIME_DIR: runtimeDir, PRIAGE_DEV_TENANT_NAME: tenant.name,
        PRIAGE_DEV_WORKFLOW_PROFILE: tenant.workflowProfile,
        ...(tenant.clinicDetails ? { PRIAGE_DEV_CLINIC_DETAILS: JSON.stringify(tenant.clinicDetails) } : {}) },
    });
    devAccountEnv = loadDevAccountEnv();
    instanceEnv = buildInstanceEnv(devAccountEnv);
  }

  if (isClinic && (shouldRunStartup || wantsReseed || wantsFullseed)) {
    runStep('Ensuring local clinic preview schedule and mock legal copy', 'node', ['scripts/seed-local-clinic-preview.js'], {
      cwd: backendDir, env: { ...instanceEnv, PRIAGE_DEV_TENANT_NAME: tenant.name,
        ...(tenant.clinicDetails ? { PRIAGE_DEV_CLINIC_TIMEZONE: tenant.clinicDetails.timezone,
          PRIAGE_DEV_CLINIC_ACCEPTS_WALK_INS: String(tenant.clinicDetails.acceptsWalkIns ?? true) } : {}) },
    });
  }

  if (wantsReseed || wantsFullseed) {
    runStep('Reseeding patient-facing dev data', 'node', ['scripts/reseed-dev.js'], {
      cwd: backendDir, env: instanceEnv,
    });
    if (!isClinic) {
      const seedLabel = wantsFullseed
      ? 'Running full demo seed script'
      : 'Running standard seed script';
      const seedScript = wantsFullseed ? 'scripts/demo-seed.js' : 'scripts/seed.js';
      runStep(seedLabel, 'node', [seedScript], {
        cwd: backendDir, env: { ...instanceEnv, ...buildSeedEnv(devAccountEnv) },
      });
    }
  }

  tenant.running = true;
  tenant.lastStartedAt = new Date().toISOString();
  writeRegistry();
  const launchedServices = shouldRunStartup ? launchServices(version, instanceEnv) : new Set();
  if (shouldRunStartup) {
    await waitForBackend(launchedServices);
    await waitForFrontendService(hospitalService, hospitalAppUrl, launchedServices);
    await waitForFrontendService(patientService, patientAppUrl, launchedServices);
  }
  if (wantsLogs && !wantsSmoke) {
    const loggingScript = wantsVerbose ? 'test:logging:verbose' : 'test:logging';
    runStep('Running logging tests', 'npm', ['run', loggingScript], {
      cwd: backendDir,
      env: { ...instanceEnv, ...devAccountEnv },
    });
  }
  if (wantsSmoke) {
    if (isClinic) {
      runStep('Testing clinic intake preview', 'npm', ['run', 'test:clinic-intake-smoke'], {
        cwd: backendDir, env: { ...instanceEnv, CLINIC_SMOKE_BASE_URL: `http://localhost:${ports.backend}` },
      });
      runStep('Testing clinic booking preview', 'npm', ['run', 'test:clinic-booking-smoke'], {
        cwd: backendDir, env: { ...instanceEnv, CLINIC_SMOKE_BASE_URL: `http://localhost:${ports.backend}`,
          ...(tenant.clinicDetails ? { PRIAGE_DEV_CLINIC_TIMEZONE: tenant.clinicDetails.timezone } : {}) },
      });
    } else {
      runStep('Running developer confidence pipeline', 'npm', ['run', 'test:dev-pipeline'], {
        cwd: backendDir, env: { ...instanceEnv, ...devAccountEnv, BASE_URL: `http://localhost:${ports.backend}` },
      });
    }
  }
  if (isClinic && wantsFullseed) {
    runStep('Seeding clinic preview visits and appointments', 'node', ['scripts/seed-local-clinic-demo.js'], {
      cwd: backendDir, env: { ...instanceEnv, ...devAccountEnv, CLINIC_SEED_BASE_URL: `http://localhost:${ports.backend}` },
    });
  }
  console.log(`[priage-dev] ${tenant.name}: API http://localhost:${ports.backend} · clinic app http://localhost:${ports.hospital} · patient app http://localhost:${ports.patient}`);
  console.log(`[priage-dev] Local staff credentials: ${join(runtimeDir, 'accounts.json')}`);
  console.log('Dev stack launcher finished.');
}

function printUsage() {
  console.log(`Usage: ./priage-dev [-t clinic | --instance NAME | -all] [newuser|-u] [reseed|fullseed] [test|-T] [logs|-l] [--verbose|-v]

Options:
  cloud [up|test|load|chaos|restore|down]
            Run the Dockerized cloud-shaped developer environment
  -t clinic Create a new clinic and prompt for its name, contact details, timezone, and walk-in choice
  --instance NAME
            Select an existing instance by its internal name (for example clinic-1)
  -all, --all
            Apply the operation to every registered instance (including ED on startup)
            With -k, stop every instance while keeping each database volume
  (no flag) Start or reuse the ED instance (ed-1)
  kill, -k, --kill
            Stop only the selected instance's processes and containers; without a selector, stop the latest running instance
  newuser, -u
            Create another hospital user for this dev environment
  reseed    Wipe patient-facing dev data; ED instances also run backend/scripts/seed.js
  fullseed  Wipe patient-facing data and seed ED demo visits or clinic mock intake/booking visits
  test, -T  Wait for the API and run its workflow-specific confidence pipeline
  logs, -l  Wait for the API and run the logging test suite
  --verbose, -v
            Start the backend with LOG_LEVEL=verbose and run test
            scripts in verbose mode (extra NestJS + test detail)
  --help    Show this help text
`);
}

async function promptClinicDetails() {
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  try {
    let name = '';
    while (!name) name = (await prompt.question('Clinic name: ')).trim();
    const address = (await prompt.question('Clinic address (optional): ')).trim();
    const phone = (await prompt.question('Clinic phone (optional): ')).trim();
    let timezone = '';
    while (!timezone) {
      timezone = (await prompt.question('Clinic timezone [America/Toronto]: ')).trim() || 'America/Toronto';
      try { new Intl.DateTimeFormat('en-CA', { timeZone: timezone }); }
      catch { console.log('Enter a valid IANA timezone.'); timezone = ''; }
    }
    const checkInInstructions = (await prompt.question('Check-in instructions (optional): ')).trim();
    let acceptsWalkIns = true;
    while (true) {
      const answer = (await prompt.question('Accept walk-ins for local clinic testing? [Y/n]: ')).trim().toLowerCase();
      if (!answer || answer === 'y' || answer === 'yes') break;
      if (answer === 'n' || answer === 'no') { acceptsWalkIns = false; break; }
      console.log('Enter yes or no.');
    }
    return { name, address: address || null, phone: phone || null, timezone,
      checkInInstructions: checkInInstructions || null, acceptsWalkIns };
  } finally {
    prompt.close();
  }
}

function readRegistry() {
  const registryPath = join(rootRuntimeDir, 'registry.json');
  if (existsSync(registryPath)) {
    try {
      const parsed = JSON.parse(readFileSync(registryPath, 'utf8'));
      if (parsed.version === 1 && parsed.tenants && typeof parsed.tenants === 'object') return parsed;
    } catch {
      throw new Error('Local tenant registry is unreadable; inspect .priage-dev/registry.json before continuing.');
    }
    throw new Error('Local tenant registry has an unsupported format.');
  }
  const result = emptyRegistry();
  // Import the earlier single ED launcher without stopping or replacing its processes.
  if (existsSync(join(rootRuntimeDir, 'accounts.json')) || ['backend', 'hospital', 'patient'].some((id) => existsSync(join(rootRuntimeDir, `${id}.pid`)))) {
    const legacy = createTenantEntry(result, 'ed-1');
    legacy.running = ['backend', 'hospital', 'patient'].some((id) => {
      const pidFile = join(rootRuntimeDir, `${id}.pid`);
      return existsSync(pidFile) && processExists(readFileSync(pidFile, 'utf8').trim());
    });
    legacy.lastStartedAt = new Date().toISOString();
  }
  return result;
}

function writeRegistry() {
  mkdirSync(rootRuntimeDir, { recursive: true, mode: 0o700 });
  const registryPath = join(rootRuntimeDir, 'registry.json');
  const temporaryPath = `${registryPath}.tmp`;
  writeFileSync(temporaryPath, `${JSON.stringify(registry, null, 2)}\n`, { mode: 0o600 });
  renameSync(temporaryPath, registryPath);
}

function buildInstanceEnv(accountEnv) {
  if (isClinic && accountEnv.PRIAGE_DEV_ADMIN_HOSPITAL_SLUG && accountEnv.PRIAGE_DEV_ADMIN_HOSPITAL_SLUG !== tenant.name) {
    throw new Error(`The saved clinic staff account belongs to ${accountEnv.PRIAGE_DEV_ADMIN_HOSPITAL_SLUG}, not ${tenant.name}.`);
  }
  return {
    DATABASE_URL: databaseUrl,
    NODE_ENV: 'development',
    REDIS_HOST: 'localhost',
    REDIS_PORT: String(ports.redis),
    REDIS_CONNECTION_NAME: `priage-dev-${tenant.name}`,
    PORT: String(ports.backend),
    CORS_ORIGINS: `http://localhost:${ports.hospital},http://localhost:${ports.patient}`,
    AUTH_COOKIE_NAMESPACE: tenant.name === 'ed-1' ? '' : tenant.name,
    ...(isClinic ? { TRIAGE_INTERVIEW_MODE: 'deterministic' } : {}),
    CLINIC_PREVIEW_ENABLED: String(isClinic),
    PILOT_CLINIC_ID: isClinic ? String(accountEnv.PRIAGE_DEV_ADMIN_HOSPITAL_ID || '') : '',
  };
}

function ensurePlatform() {
  if (process.platform !== 'darwin') {
    throw new Error('This launcher currently supports macOS only because it opens Terminal.app tabs.');
  }
}

function ensureEnvFiles() {
  const envPairs = [
    { cwd: backendDir, label: 'backend' },
    { cwd: hospitalAppDir, label: 'Hospital App' },
    { cwd: patientAppDir, label: 'Patient App' },
  ];

  for (const pair of envPairs) {
    const examplePath = join(pair.cwd, '.env.example');
    const envPath = join(pair.cwd, '.env');

    if (!existsSync(examplePath) || existsSync(envPath)) {
      continue;
    }

    copyFileSync(examplePath, envPath);
    console.log(`[priage-dev] Created ${relativeFromRoot(envPath)} from ${relativeFromRoot(examplePath)}.`);
  }
}

function ensureFileExists(filePath, message) {
  if (!existsSync(filePath)) {
    throw new Error(message);
  }
}

function readVersion() {
  return readFileSync(versionFile, 'utf8').trim();
}

function warnOnVersionDrift(version) {
  const packageFiles = [
    join(backendDir, 'package.json'),
    join(patientAppDir, 'package.json'),
    join(hospitalAppDir, 'package.json'),
  ];

  for (const packageFile of packageFiles) {
    const pkg = JSON.parse(readFileSync(packageFile, 'utf8'));
    if (pkg.version !== version) {
      console.warn(`[priage-dev] Warning: ${relativeFromRoot(packageFile)} version ${pkg.version} does not match VERSION ${version}.`);
    }
  }
}

function relativeFromRoot(targetPath) {
  return targetPath.replace(`${projectRoot}/`, '');
}

function ensurePrerequisites() {
  const checks = [
    { label: 'docker', cmd: 'docker', args: ['--version'] },
    { label: 'docker compose', cmd: 'docker', args: ['compose', 'version'] },
    { label: 'node', cmd: 'node', args: ['--version'] },
    { label: 'npm', cmd: 'npm', args: ['--version'] },
    { label: 'npx', cmd: 'npx', args: ['--version'] },
    { label: 'osascript', cmd: 'osascript', args: ['-e', 'return "ok"'] },
    { label: 'lsof', cmd: 'sh', args: ['-lc', 'command -v lsof >/dev/null'] },
  ];

  for (const check of checks) {
    const result = spawnSync(check.cmd, check.args, { encoding: 'utf8' });
    if (result.status !== 0) {
      throw new Error(`Required tool not available: ${check.label}`);
    }
  }
}

function ensureRuntimeDir() {
  mkdirSync(runtimeDir, { recursive: true, mode: 0o700 });
}

async function getStackStatus() {
  const docker = getDockerStatus();
  const [backendReady, hospitalReady, patientReady] = await Promise.all([
    checkBackendReady(),
    checkFrontendReady(hospitalAppUrl),
    checkFrontendReady(patientAppUrl),
  ]);

  return {
    docker,
    backendReady,
    hospitalReady,
    patientReady,
    ready: docker.ready && backendReady && hospitalReady && patientReady && services.every((service) => !!readManagedPid(service)),
  };
}

function logStackStatus(stackStatus) {
  console.log('\n== Stack Check ==');
  console.log(`[priage-dev] Docker: ${formatDockerStatus(stackStatus.docker)}.`);
  console.log(`[priage-dev] Backend: ${stackStatus.backendReady ? 'ready' : 'not ready'}.`);
  console.log(`[priage-dev] Hospital app: ${stackStatus.hospitalReady ? 'ready' : 'not ready'}.`);
  console.log(`[priage-dev] Patient app: ${stackStatus.patientReady ? 'ready' : 'not ready'}.`);
}

function formatDockerStatus(dockerStatus) {
  if (dockerStatus.ready) {
    return 'ready';
  }

  const issues = [];
  if (dockerStatus.missingServices.length > 0) {
    issues.push(`missing ${dockerStatus.missingServices.join(', ')}`);
  }
  if (dockerStatus.stoppedServices.length > 0) {
    issues.push(`stopped ${dockerStatus.stoppedServices.join(', ')}`);
  }

  return issues.length > 0 ? `not ready (${issues.join('; ')})` : 'not ready';
}

function getExpectedDockerServices() {
  const servicesOutput = capture('docker', [...composeArgs, 'config', '--services'], {
    cwd: projectRoot,
    env: composeEnv,
  }).trim();
  return servicesOutput
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function getDockerStatus() {
  const expectedServices = getExpectedDockerServices();
  const currentState = getComposeState();

  const missingServices = expectedServices.filter((name) => !currentState.has(name));
  const stoppedServices = expectedServices.filter((name) => {
    const entry = currentState.get(name);
    return entry && !isRunningStatus(entry.state);
  });

  return {
    expectedServices,
    missingServices,
    stoppedServices,
    ready: missingServices.length === 0 && stoppedServices.length === 0,
  };
}

function ensureDockerServices(dockerStatus = getDockerStatus()) {
  console.log('\n== Docker ==');
  const {
    expectedServices,
    missingServices,
    stoppedServices,
  } = dockerStatus;

  if (missingServices.length > 0) {
    console.log(`[priage-dev] Missing containers for: ${missingServices.join(', ')}.`);
    runStep('Creating docker services', 'docker', [...composeArgs, 'up', '-d', '--wait'], { cwd: projectRoot, env: composeEnv });
    verifyDockerRunning(expectedServices);
    return;
  }

  if (stoppedServices.length > 0) {
    console.log(`[priage-dev] Starting stopped services: ${stoppedServices.join(', ')}.`);
    runStep('Starting docker services', 'docker', [...composeArgs, 'up', '-d', '--wait'], { cwd: projectRoot, env: composeEnv });
    verifyDockerRunning(expectedServices);
    return;
  }

  console.log('[priage-dev] Docker services already running.');
}

function getComposeState() {
  const output = capture('docker', [...composeArgs, 'ps', '--all', '--format', 'json'], { cwd: projectRoot, env: composeEnv }).trim();
  if (!output) {
    return new Map();
  }

  let rows;
  try {
    rows = JSON.parse(output);
  } catch {
    rows = output
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  }

  const list = Array.isArray(rows) ? rows : [rows];
  return new Map(
    list
      .filter((row) => row && row.Service)
      .map((row) => [
        row.Service,
        {
          state: row.State ?? row.Status ?? '',
          name: row.Name ?? row.Service,
        },
      ]),
  );
}

function isRunningStatus(state) {
  return String(state).toLowerCase().includes('running');
}

function verifyDockerRunning(expectedServices) {
  const state = getComposeState();
  const notRunning = expectedServices.filter((name) => {
    const entry = state.get(name);
    return !entry || !isRunningStatus(entry.state);
  });

  if (notRunning.length > 0) {
    throw new Error(`Docker services failed to start: ${notRunning.join(', ')}`);
  }
}

function installDependencies() {
  console.log('\n== Dependencies ==');
  ensureDependenciesInstalled('backend', backendDir);
  ensureDependenciesInstalled('PatientApp', patientAppDir);
  ensureDependenciesInstalled('HospitalApp', hospitalAppDir);
}

function ensureDependenciesInstalled(name, cwd) {
  const nodeModulesPath = join(cwd, 'node_modules');
  if (existsSync(nodeModulesPath)) {
    console.log(`[priage-dev] ${name} dependencies already present; skipping npm install.`);
    return;
  }

  runStep(`Installing ${name} dependencies`, 'npm', ['install'], { cwd });
}

function runPrismaSetup() {
  console.log('\n== Prisma ==');
  runStep('Generating Prisma client', 'npx', ['prisma', 'generate'], { cwd: backendDir, env: { DATABASE_URL: databaseUrl } });
  runStep('Applying Prisma migrations', 'npx', ['prisma', 'migrate', 'deploy'], { cwd: backendDir, env: { DATABASE_URL: databaseUrl } });
}

function runStep(label, cmd, commandArgs, options = {}) {
  console.log(`\n[priage-dev] ${label}`);
  const result = spawnSync(cmd, commandArgs, {
    cwd: options.cwd ?? projectRoot,
    stdio: 'inherit',
    env: { ...process.env, ...(options.env ?? {}) },
  });
  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status ?? 'unknown'}.`);
  }
}

function capture(cmd, commandArgs, options = {}) {
  const result = spawnSync(cmd, commandArgs, {
    cwd: options.cwd ?? projectRoot,
    encoding: 'utf8',
    env: { ...process.env, ...(options.env ?? {}) },
  });
  if (result.status !== 0) {
    const stderr = result.stderr?.trim();
    throw new Error(stderr || `${cmd} ${commandArgs.join(' ')} failed.`);
  }
  return result.stdout ?? '';
}

function launchServices(version, sharedEnv = {}) {
  console.log('\n== Dev Servers ==');
  const launched = new Set();
  for (const service of services) {
    clearStalePidFile(service);
    const portOwner = findPortOwner(service.port);
    if (portOwner) {
      if (!readManagedPid(service)) {
        throw new Error(`Port ${service.port} belongs to an unmanaged process (PID ${portOwner.pid}); refusing to attach ${tenant.name} to it.`);
      }
      console.log(`[priage-dev] Reusing ${tenant.name} ${service.name} on port ${service.port}.`);
      continue;
    }

    const oldPid = readManagedPid(service);
    if (oldPid) terminatePid(oldPid, `${tenant.name} stale ${service.name}`);
    closeTerminalWindow(service);
    removeWindowFile(service);
    removeCommandFile(service);
    removeHistoryFile(service);
    removeLauncherFile(service);

    const env = service.env(version, sharedEnv);
    openTerminalWindow(service, env);
    launched.add(service.id);
    console.log(`[priage-dev] Opened ${service.name} on port ${service.port}.`);
  }
  return launched;
}

function stopServices() {
  console.log('\n== Stop Dev Servers ==');
  for (const service of services) {
    const managedPid = readManagedPid(service);
    if (managedPid) {
      terminatePid(managedPid, `${service.name} service`);
      removePidFile(service);
    } else {
      console.log(`[priage-dev] No managed PID found for ${service.name}; skipping process stop.`);
    }

    closeTerminalWindow(service);
    removeWindowFile(service);
    removeCommandFile(service);
    removeHistoryFile(service);
    removeLauncherFile(service);
  }
}

function stopDockerServices() {
  console.log(`\n== Stop ${tenant.name} Containers ==`);
  runStep('Stopping selected tenant containers', 'docker', [...composeArgs, 'stop'], { cwd: projectRoot, env: composeEnv });
}

function pidFileFor(service) {
  return join(runtimeDir, `${service.id}.pid`);
}

function windowFileFor(service) {
  return join(runtimeDir, `${service.id}.window`);
}

function commandFileFor(service) {
  return join(runtimeDir, `${service.id}.command`);
}

function historyFileFor(service) {
  return join(runtimeDir, `${service.id}.history`);
}

function launcherFileFor(service) {
  return join(runtimeDir, `${service.id}.launch`);
}

function readManagedPid(service) {
  const pidFile = pidFileFor(service);
  if (!existsSync(pidFile)) {
    return null;
  }

  const pid = readFileSync(pidFile, 'utf8').trim();
  if (!pid || !processExists(pid)) {
    removePidFile(service);
    return null;
  }

  return pid;
}

function clearStalePidFile(service) {
  const pidFile = pidFileFor(service);
  if (!existsSync(pidFile)) {
    return;
  }

  const pid = readFileSync(pidFile, 'utf8').trim();
  if (!pid || !processExists(pid)) {
    removePidFile(service);
  }
}

function removePidFile(service) {
  rmSync(pidFileFor(service), { force: true });
}

function readManagedWindowId(service) {
  const windowFile = windowFileFor(service);
  if (!existsSync(windowFile)) {
    return null;
  }

  const windowId = readFileSync(windowFile, 'utf8').trim();
  if (!windowId) {
    removeWindowFile(service);
    return null;
  }

  return windowId;
}

function removeWindowFile(service) {
  rmSync(windowFileFor(service), { force: true });
}

function removeCommandFile(service) {
  rmSync(commandFileFor(service), { force: true });
}

function removeHistoryFile(service) {
  rmSync(historyFileFor(service), { force: true });
}

function removeLauncherFile(service) {
  rmSync(launcherFileFor(service), { force: true });
}

function findPortOwner(port) {
  const result = spawnSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-Fpc'], {
    encoding: 'utf8',
  });

  if (result.status !== 0 || !result.stdout.trim()) {
    return null;
  }

  let pid = null;
  let command = null;
  for (const line of result.stdout.split('\n')) {
    if (line.startsWith('p') && pid === null) {
      pid = line.slice(1);
    } else if (line.startsWith('c') && command === null) {
      command = line.slice(1);
    }
  }

  if (!pid) {
    return null;
  }

  return {
    pid,
    command: command || 'unknown',
  };
}

function openTerminalWindow(service, env) {
  const pidFile = pidFileFor(service);
  const commandFile = commandFileFor(service);
  const historyFile = historyFileFor(service);
  const launcherFile = launcherFileFor(service);
  const envExports = Object.entries(env)
    .map(([key, value]) => `export ${key}=${shellQuote(String(value))}`)
    .join('\n');
  const scriptLines = [
    '#!/bin/zsh',
    `cd ${shellQuote(service.cwd)}`,
    `mkdir -p ${shellQuote(runtimeDir)}`,
    `rm -f ${shellQuote(pidFile)}`,
    `printf '\\033]1;${service.title}\\007\\033]2;${service.title}\\007'`,
    `echo $$ > ${shellQuote(pidFile)}`,
    `trap 'rm -f ${shellQuote(pidFile)}' EXIT`,
    ...(envExports ? [envExports] : []),
    `exec ${service.command}`,
  ];

  writeFileSync(commandFile, `${scriptLines.join('\n')}\n`);
  chmodSync(commandFile, 0o700);

  writeFileSync(
    launcherFile,
    `#!/bin/zsh
export HISTFILE=${shellQuote(historyFile)}
unsetopt SHARE_HISTORY INC_APPEND_HISTORY INC_APPEND_HISTORY_TIME
exec ${shellQuote(commandFile)}
`,
  );
  chmodSync(launcherFile, 0o755);

  const launchCommand = `exec ${shellQuote(launcherFile)}`;

  const script = `
tell application "Terminal"
  activate
  set targetTab to do script ""
  delay 2
  do script ((ASCII character 21) & ${appleScriptQuote(launchCommand)}) in targetTab
  set custom title of targetTab to ${appleScriptQuote(service.title)}
  return id of front window
end tell
`;

  const result = spawnSync('osascript', ['-e', script], {
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    process.stderr.write(result.stderr ?? '');
    throw new Error('Failed to open separate Terminal.app windows.');
  }

  const windowId = result.stdout?.trim();
  if (!windowId) {
    throw new Error(`Failed to capture Terminal window id for ${service.name}.`);
  }

  writeFileSync(windowFileFor(service), `${windowId}\n`);
}

function closeTerminalWindow(service) {
  const windowId = readManagedWindowId(service);
  if (windowId) {
    const script = `
tell application "Terminal"
  if exists window id ${windowId} then
    close window id ${windowId} saving no
  end if
end tell
`;

    spawnSync('osascript', ['-e', script], { stdio: 'ignore' });
    return;
  }

  const script = `
tell application "Terminal"
  repeat with w in (every window)
    try
      repeat with t in tabs of w
        if custom title of t is ${appleScriptQuote(service.title)} then
          close w saving no
          exit repeat
        end if
      end repeat
    end try
  end repeat
end tell
`;

  spawnSync('osascript', ['-e', script], { stdio: 'ignore' });
}

function processExists(pid) {
  const result = spawnSync('kill', ['-0', String(pid)], { stdio: 'ignore' });
  return result.status === 0;
}

function waitForProcessExit(pid, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!processExists(pid)) {
      return true;
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 150);
  }
  return !processExists(pid);
}

function forceTerminatePid(pid, label) {
  const result = spawnSync('kill', ['-KILL', String(pid)], { encoding: 'utf8' });
  if (result.status === 0) {
    console.log(`[priage-dev] Force-stopped ${label} (PID ${pid}).`);
  } else {
    console.warn(`[priage-dev] Could not force-stop ${label} (PID ${pid}).`);
  }
}

function terminatePid(pid, label) {
  const termResult = spawnSync('kill', ['-TERM', String(pid)], { encoding: 'utf8' });
  if (termResult.status !== 0) {
    console.warn(`[priage-dev] Could not stop ${label} (PID ${pid}).`);
    return;
  }

  if (waitForProcessExit(pid, 4_000)) {
    console.log(`[priage-dev] Stopped ${label} (PID ${pid}).`);
    return;
  }

  console.warn(`[priage-dev] ${label} (PID ${pid}) did not exit after SIGTERM; sending SIGKILL.`);
  forceTerminatePid(pid, label);
}

function shellQuote(value) {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function appleScriptQuote(value) {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

async function checkBackendReady() {
  return fetchWithTimeout(backendReadinessUrl, async (response) => {
    if (!response.ok) {
      return false;
    }

    const payload = await response.json().catch(() => null);
    return Boolean(payload && payload.ok === true && payload.status === 'ready');
  });
}

async function checkFrontendReady(url) {
  return fetchWithTimeout(url, async (response) => response.ok);
}

async function fetchWithTimeout(url, parser) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1_500);

  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
    });
    return await parser(response);
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function waitForBackend(launchedServices = new Set()) {
  console.log('\n== Backend Readiness ==');
  const timeoutMs = 90_000;
  const intervalMs = 1_500;
  const deadline = Date.now() + timeoutMs;
  const pidGraceDeadline = Date.now() + 15_000;

  while (Date.now() < deadline) {
    ensureManagedServiceAlive(backendService, launchedServices, pidGraceDeadline);
    if (await checkBackendReady()) {
      // Give the watch-mode process a brief settle period before kicking off smoke tests.
      await sleep(1_000);
      console.log(`[priage-dev] Backend is ready via ${backendReadinessUrl}.`);
      return;
    }

    await sleep(intervalMs);
  }

  throw new Error(`Backend did not become ready via ${backendReadinessUrl} within 90 seconds.`);
}

async function waitForFrontendService(service, url, launchedServices = new Set()) {
  console.log(`\n== ${service.title} Readiness ==`);
  const timeoutMs = 90_000;
  const intervalMs = 1_500;
  const deadline = Date.now() + timeoutMs;
  const pidGraceDeadline = Date.now() + 15_000;

  while (Date.now() < deadline) {
    ensureManagedServiceAlive(service, launchedServices, pidGraceDeadline);
    if (await checkFrontendReady(url)) {
      console.log(`[priage-dev] ${service.name} is ready via ${url}.`);
      return;
    }

    await sleep(intervalMs);
  }

  throw new Error(`${service.title} did not become ready via ${url} within 90 seconds.`);
}

function ensureManagedServiceAlive(service, launchedServices, pidGraceDeadline) {
  if (!launchedServices.has(service.id)) {
    return;
  }

  const pid = readManagedPid(service);
  if (!pid && Date.now() >= pidGraceDeadline) {
    throw new Error(`${service.title} exited before readiness completed.`);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadDevAccountEnv() {
  const manifestPath = join(runtimeDir, 'accounts.json');
  if (!existsSync(manifestPath)) {
    return {};
  }

  try {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    const env = {};
    if (manifest?.admin?.email) {
      env.PRIAGE_DEV_ADMIN_EMAIL = manifest.admin.email;
    }
    if (manifest?.admin?.password) {
      env.PRIAGE_DEV_ADMIN_PASSWORD = manifest.admin.password;
    }
    if (manifest?.admin?.hospitalSlug) {
      env.PRIAGE_DEV_ADMIN_HOSPITAL_SLUG = manifest.admin.hospitalSlug;
    }
    if (manifest?.admin?.hospitalId) {
      env.PRIAGE_DEV_ADMIN_HOSPITAL_ID = String(manifest.admin.hospitalId);
    }

    const lastAccount = Array.isArray(manifest?.accounts) && manifest.accounts.length > 0
      ? manifest.accounts.at(-1)
      : null;
    if (lastAccount?.email) {
      env.PRIAGE_DEV_LAST_USER_EMAIL = lastAccount.email;
    }
    if (lastAccount?.password) {
      env.PRIAGE_DEV_LAST_USER_PASSWORD = lastAccount.password;
    }
    if (lastAccount?.role) {
      env.PRIAGE_DEV_LAST_USER_ROLE = lastAccount.role;
    }
    if (lastAccount?.hospitalSlug) {
      env.PRIAGE_DEV_LAST_USER_HOSPITAL_SLUG = lastAccount.hospitalSlug;
    }

    return env;
  } catch {
    return {};
  }
}

function buildSeedEnv(devAccountEnv) {
  const targetHospitalSlug = devAccountEnv.PRIAGE_DEV_ADMIN_HOSPITAL_SLUG
    || devAccountEnv.PRIAGE_DEV_LAST_USER_HOSPITAL_SLUG;
  return {
    ...devAccountEnv,
    ...(targetHospitalSlug ? { TARGET_HOSPITAL_SLUG: targetHospitalSlug } : {}),
  };
}
