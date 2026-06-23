#!/usr/bin/env node

const { spawnSync } = require('node:child_process');
const path = require('node:path');

const [deprecatedName, replacementName, target, ...argumentsToForward] = process.argv.slice(2);

if (!deprecatedName || !replacementName || !target) {
  throw new Error('Usage: deprecated-command <deprecated-name> <replacement-name> <target-script> [args...]');
}

process.stderr.write(`Deprecated command \"${deprecatedName}\"; use \"${replacementName}\" instead. It will be removed after the next clean release.\n`);
const result = spawnSync(process.execPath, [path.resolve(__dirname, '..', target), ...argumentsToForward], {
  stdio: 'inherit',
});

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
