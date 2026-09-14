const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

test('deprecated command warns, forwards arguments, and preserves child exit status', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'priage-deprecated-command-'));
  const target = path.join(directory, 'target.js');
  fs.writeFileSync(target, 'process.stdout.write(process.argv.slice(2).join(",")); process.exitCode = 7;');
  const wrapper = path.resolve(__dirname, '..', 'deprecated-command.js');
  const result = spawnSync(process.execPath, [wrapper, 'old:command', 'new:command', target, 'one', 'two'], {
    encoding: 'utf8',
  });
  assert.equal(result.status, 7);
  assert.match(result.stderr, /Deprecated command "old:command"; use "new:command" instead/);
  assert.equal(result.stdout, 'one,two');
  fs.rmSync(directory, { recursive: true, force: true });
});
