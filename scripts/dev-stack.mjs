#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');
const backendDir = join(projectRoot, 'backend');
const patientAppDir = join(projectRoot, 'Apps', 'PatientApp');
const hospitalAppDir = join(projectRoot, 'Apps', 'HospitalApp');
const versionFile = join(projectRoot, 'VERSION');
const runtimeDir = join(projectRoot, '.priage-dev');

const args = new Set(process.argv.slice(2));
const wantsHelp = args.has('--help') || args.has('-h');
const wantsReseed = args.has('reseed');
const wantsSmoke = args.has('test') || args.has('-t');
const wantsLogs = args.has('logs') || args.has('-l');
const wantsVerbose = args.has('--verbose') || args.has('-v');
const wantsKill = args.has('kill') || args.has('-k') || args.has('--kill');

const services = [
  {
    id: 'backend',
    name: 'backend',
    title: 'Priage Dev: Backend',
    cwd: backendDir,
    port: 3000,
    command: 'npm run start:dev',
    env: (version) => ({
      APP_VERSION: version,
      ...(wantsVerbose ? { LOG_LEVEL: 'verbose' } : {}),
    }),
  },
  {
    id: 'hospital',
    name: 'hospital',
    title: 'Priage Dev: Hospital',
    cwd: hospitalAppDir,
    port: 5173,
    command: 'npm run dev -- --host 0.0.0.0 --port 5173 --strictPort',
    env: () => ({}),
  },
  {
    id: 'patient',
    name: 'patient',
    title: 'Priage Dev: Patient',
    cwd: patientAppDir,
    port: 5174,
    command: 'npm run dev -- --host 0.0.0.0 --port 5174 --strictPort',
    env: () => ({}),
  },
];

if (wantsHelp) {
  printUsage();
  process.exit(0);
}

main().catch((error) => {
  console.error(`\n[priage-dev] ${error.message}`);
  process.exit(1);
});

async function main() {
  ensureRuntimeDir();

  if (wantsKill) {
    stopServices();
    console.log('Priage dev services stopped.');
    return;
  }

  ensureFileExists(versionFile, 'Missing VERSION file.');
  const version = readVersion();

  console.log(`Priage v${version}`);
  warnOnVersionDrift(version);
  ensurePlatform();
  ensurePrerequisites();
  ensureDockerServices();
  installDependencies();
  runPrismaSetup();
  runStep('Ensuring local dev accounts', 'node', ['scripts/bootstrap-dev-accounts.js'], {
    cwd: backendDir,
    env: { PRIAGE_DEV_RUNTIME_DIR: runtimeDir },
  });
  const devAccountEnv = loadDevAccountEnv();
  if (wantsReseed) {
    runStep('Reseeding patient-facing dev data', 'node', ['scripts/reseed-dev.js'], {
      cwd: backendDir,
      env: devAccountEnv,
    });
    runStep('Running standard seed script', 'node', ['scripts/seed.js'], {
      cwd: backendDir,
      env: buildSeedEnv(devAccountEnv),
    });
  }
  const launchedServices = launchServices(version, devAccountEnv);
  if (wantsSmoke || wantsLogs) {
    await waitForBackend(launchedServices);
  }
  if (wantsLogs && !wantsSmoke) {
    const loggingScript = wantsVerbose ? 'test:logging:verbose' : 'test:logging';
    runStep('Running logging tests', 'npm', ['run', loggingScript], {
      cwd: backendDir,
      env: devAccountEnv,
    });
  }
  if (wantsSmoke) {
    await waitForFrontendService(services[1], 'http://localhost:5173', launchedServices);
    await waitForFrontendService(services[2], 'http://localhost:5174', launchedServices);
    runStep('Running developer confidence pipeline', 'npm', ['run', 'test:dev-pipeline'], {
      cwd: backendDir,
      env: devAccountEnv,
    });
  }
  console.log('Dev stack launcher finished.');
}

function printUsage() {
  console.log(`Usage: ./priage-dev [reseed] [test|-t] [logs|-l] [--verbose|-v]

Options:
  kill, -k, --kill
            Stop Priage dev services and close their Terminal windows
  reseed    Wipe patient-facing dev data and run backend/scripts/seed.js
  test, -t  Wait for the API and run the backend confidence pipeline
  logs, -l  Wait for the API and run the logging test suite
  --verbose, -v
            Start the backend with LOG_LEVEL=verbose and run test
            scripts in verbose mode (extra NestJS + test detail)
  --help    Show this help text
`);
}

function ensurePlatform() {
  if (process.platform !== 'darwin') {
    throw new Error('This launcher currently supports macOS only because it opens Terminal.app tabs.');
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
    { label: 'open', cmd: 'sh', args: ['-lc', 'command -v open >/dev/null'] },
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
  mkdirSync(runtimeDir, { recursive: true });
}

function ensureDockerServices() {
  console.log('\n== Docker ==');
  const servicesOutput = capture('docker', ['compose', 'config', '--services'], { cwd: projectRoot }).trim();
  const expectedServices = servicesOutput.split('\n').map((line) => line.trim()).filter(Boolean);
  const currentState = getComposeState();

  const missingServices = expectedServices.filter((name) => !currentState.has(name));
  const stoppedServices = expectedServices.filter((name) => {
    const entry = currentState.get(name);
    return entry && !isRunningStatus(entry.state);
  });

  if (missingServices.length > 0) {
    console.log(`[priage-dev] Missing containers for: ${missingServices.join(', ')}.`);
    runStep('Creating docker services', 'docker', ['compose', 'up', '-d'], { cwd: projectRoot });
    verifyDockerRunning(expectedServices);
    return;
  }

  if (stoppedServices.length > 0) {
    console.log(`[priage-dev] Starting stopped services: ${stoppedServices.join(', ')}.`);
    runStep('Starting docker services', 'docker', ['compose', 'up', '-d'], { cwd: projectRoot });
    verifyDockerRunning(expectedServices);
    return;
  }

  console.log('[priage-dev] Docker services already running.');
}

function getComposeState() {
  const output = capture('docker', ['compose', 'ps', '--all', '--format', 'json'], { cwd: projectRoot }).trim();
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
  runStep('Generating Prisma client', 'npx', ['prisma', 'generate'], { cwd: backendDir });
  runStep('Applying Prisma migrations', 'npx', ['prisma', 'migrate', 'deploy'], { cwd: backendDir });
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
    removeWindowFile(service);
    removeCommandFile(service);
    removeHistoryFile(service);
    removeLauncherFile(service);
    const portOwner = findPortOwner(service.port);
    if (portOwner) {
      console.warn(
        `[priage-dev] Port ${service.port} is already in use by PID ${portOwner.pid} (${portOwner.command}); skipping ${service.name} launch.`,
      );
      continue;
    }

    const env = {
      ...sharedEnv,
      ...service.env(version),
    };
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
  return join(service.cwd, '.priage-dev-launch');
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
  chmodSync(commandFile, 0o755);

  writeFileSync(
    launcherFile,
    `#!/bin/zsh
export HISTFILE=${shellQuote(historyFile)}
unsetopt SHARE_HISTORY INC_APPEND_HISTORY INC_APPEND_HISTORY_TIME
exec ${shellQuote(commandFile)}
`,
  );
  chmodSync(launcherFile, 0o755);

  const openResult = spawnSync('open', ['-a', 'Terminal', service.cwd], {
    encoding: 'utf8',
  });
  if (openResult.status !== 0) {
    process.stderr.write(openResult.stderr ?? '');
    throw new Error('Failed to open Terminal.app.');
  }

  const launchCommand = 'exec ./.priage-dev-launch';

  const script = `
tell application "Terminal"
  activate
  delay 0.35
  set targetWindow to front window
  set targetTab to selected tab of targetWindow
  set custom title of targetTab to ${appleScriptQuote(service.title)}
  do script ${appleScriptQuote(launchCommand)} in targetTab
  return id of targetWindow
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

async function waitForBackend(launchedServices = new Set()) {
  console.log('\n== Backend Readiness ==');
  const timeoutMs = 90_000;
  const intervalMs = 1_500;
  const deadline = Date.now() + timeoutMs;
  const readinessUrl = 'http://localhost:3000/health/ready';
  const backendService = services[0];

  while (Date.now() < deadline) {
    ensureManagedServiceAlive(backendService, launchedServices);
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 1_500);
      const response = await fetch(readinessUrl, {
        method: 'GET',
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!response.ok) {
        await sleep(intervalMs);
        continue;
      }

      const payload = await response.json().catch(() => null);
      if (!payload || payload.ok !== true || payload.status !== 'ready') {
        await sleep(intervalMs);
        continue;
      }

      // Give the watch-mode process a brief settle period before kicking off smoke tests.
      await sleep(1_000);
      console.log(`[priage-dev] Backend is ready via ${readinessUrl}.`);
      return;
    } catch {
      await sleep(intervalMs);
    }
  }

  throw new Error(`Backend did not become ready via ${readinessUrl} within 90 seconds.`);
}

async function waitForFrontendService(service, url, launchedServices = new Set()) {
  console.log(`\n== ${service.title} Readiness ==`);
  const timeoutMs = 90_000;
  const intervalMs = 1_500;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    ensureManagedServiceAlive(service, launchedServices);
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 1_500);
      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (response.ok) {
        console.log(`[priage-dev] ${service.name} is ready via ${url}.`);
        return;
      }
    } catch {
      // Poll until timeout.
    }
    await sleep(intervalMs);
  }

  throw new Error(`${service.title} did not become ready via ${url} within 90 seconds.`);
}

function ensureManagedServiceAlive(service, launchedServices) {
  if (!launchedServices.has(service.id)) {
    return;
  }

  const pid = readManagedPid(service);
  if (!pid) {
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
