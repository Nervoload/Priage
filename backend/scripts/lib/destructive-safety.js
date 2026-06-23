const crypto = require('node:crypto');

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

function parseDestructiveAction(argv = process.argv.slice(2)) {
  const apply = argv.includes('--apply');
  const confirm = argv.find((argument) => argument.startsWith('--confirm='))?.slice('--confirm='.length);
  return { apply, confirm };
}

function inspectDatabaseTarget(databaseUrl) {
  let url;
  try {
    url = new URL(databaseUrl);
  } catch {
    throw new Error('DATABASE_URL must be a valid PostgreSQL connection URL');
  }

  if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
    throw new Error('Destructive maintenance is limited to PostgreSQL URLs');
  }

  const database = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (!database) {
    throw new Error('DATABASE_URL must name a database');
  }

  return {
    database,
    host: url.hostname.toLowerCase(),
    port: url.port || '5432',
    // Deliberately excludes username/password/query parameters.
    fingerprint: crypto.createHash('sha256').update(`${url.protocol}//${url.hostname}:${url.port || '5432'}/${database}`).digest('hex').slice(0, 12),
  };
}

/**
 * Refuses a dangerous target before a script constructs a database pool. The
 * opt-in is intentionally awkward: operators must opt into destructive test
 * data work, request --apply, and repeat the exact database name.
 */
function prepareDestructiveAction({
  scriptName,
  databaseUrl,
  argv = process.argv.slice(2),
  environment = process.env,
  requiredMarker = 'PRIAGE_ALLOW_DESTRUCTIVE_TEST_DATA',
}) {
  const target = inspectDatabaseTarget(databaseUrl);
  const nodeEnv = (environment.NODE_ENV || '').trim().toLowerCase();
  if (!['development', 'test'].includes(nodeEnv)) {
    throw new Error(`${scriptName} refuses to run unless NODE_ENV is development or test`);
  }
  if (!LOOPBACK_HOSTS.has(target.host)) {
    throw new Error(`${scriptName} refuses non-loopback database host ${target.host}`);
  }

  const action = parseDestructiveAction(argv);
  if (!action.apply) {
    return { mode: 'dry-run', target, requiredMarker };
  }
  if (environment[requiredMarker] !== '1') {
    throw new Error(`${scriptName} requires ${requiredMarker}=1 with --apply`);
  }
  if (action.confirm !== target.database) {
    throw new Error(`${scriptName} requires --confirm=${target.database} with --apply`);
  }
  return { mode: 'apply', target, requiredMarker };
}

function printDestructiveManifest({ scriptName, action, counts }) {
  const manifest = {
    script: scriptName,
    mode: action.mode,
    target: {
      host: action.target.host,
      port: action.target.port,
      database: action.target.database,
      fingerprint: action.target.fingerprint,
    },
    counts,
  };
  console.log(JSON.stringify(manifest, null, 2));
  if (action.mode === 'dry-run') {
    console.log(`Dry run only. To apply after reviewing this manifest: ${action.requiredMarker}=1 node scripts/${scriptName} --apply --confirm=${action.target.database}`);
  }
}

module.exports = {
  inspectDatabaseTarget,
  parseDestructiveAction,
  prepareDestructiveAction,
  printDestructiveManifest,
};
