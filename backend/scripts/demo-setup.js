// Runs the complete shared-demo setup without inheriting a developer's private
// TARGET_HOSPITAL_* seed selection.

require('dotenv').config();
const { spawnSync } = require('child_process');

const demoHospitalSlug = (process.env.DEMO_HOSPITAL_SLUG || 'demo-hospital').trim().toLowerCase();
const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';

function run(commandName, args, options = {}) {
  const result = spawnSync(commandName, args, {
    cwd: __dirname + '/..',
    stdio: 'inherit',
    ...options,
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

run(command, ['prisma', 'migrate', 'deploy']);
run(process.execPath, ['scripts/demo-bootstrap.js']);
run(process.execPath, ['scripts/demo-seed.js'], {
  env: {
    ...process.env,
    TARGET_HOSPITAL_ID: '',
    TARGET_HOSPITAL_SLUG: demoHospitalSlug,
  },
});
