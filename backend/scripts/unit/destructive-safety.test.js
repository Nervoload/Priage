const assert = require('node:assert/strict');
const test = require('node:test');

const { prepareDestructiveAction } = require('../lib/destructive-safety');

const localUrl = 'postgresql://priage:priage@localhost:5432/priage_test';

test('maintenance scripts default to a non-mutating dry run', () => {
  const action = prepareDestructiveAction({
    scriptName: 'cleanup-orphaned-tests.js',
    databaseUrl: localUrl,
    argv: [],
    environment: { NODE_ENV: 'test' },
  });

  assert.equal(action.mode, 'dry-run');
  assert.equal(action.target.database, 'priage_test');
});

test('production-like environments are refused before a database connection is created', () => {
  assert.throws(
    () => prepareDestructiveAction({
      scriptName: 'reseed-dev.js',
      databaseUrl: 'postgresql://prod:secret@db.prod.example:5432/clinical',
      argv: ['--apply', '--confirm=clinical'],
      environment: { NODE_ENV: 'production', PRIAGE_ALLOW_DESTRUCTIVE_TEST_DATA: '1' },
    }),
    /NODE_ENV is development or test/,
  );
});

test('apply requires marker and an exact target confirmation', () => {
  const input = {
    scriptName: 'reseed-dev.js',
    databaseUrl: localUrl,
    argv: ['--apply', '--confirm=wrong'],
    environment: { NODE_ENV: 'development', PRIAGE_ALLOW_DESTRUCTIVE_TEST_DATA: '1' },
  };
  assert.throws(() => prepareDestructiveAction(input), /--confirm=priage_test/);
  assert.throws(
    () => prepareDestructiveAction({ ...input, argv: ['--apply', '--confirm=priage_test'], environment: { NODE_ENV: 'development' } }),
    /PRIAGE_ALLOW_DESTRUCTIVE_TEST_DATA=1/,
  );
  assert.equal(
    prepareDestructiveAction({ ...input, argv: ['--apply', '--confirm=priage_test'] }).mode,
    'apply',
  );
});
