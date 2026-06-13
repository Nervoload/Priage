const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildPatientCookieHeader,
  generatePatientSessionToken,
  hashPatientCookie,
  hashPatientSessionToken,
} = require('../lib/session-cookies');

test('patient session tokens are opaque, unique, and hashable without persistence of raw material', () => {
  const first = generatePatientSessionToken();
  const second = generatePatientSessionToken();
  assert.notEqual(first, second);
  assert.match(first, /^[A-Za-z0-9_-]{40,}$/);
  assert.equal(hashPatientSessionToken(first).length, 64);
  assert.notEqual(hashPatientSessionToken(first), first);
  assert.equal(hashPatientSessionToken(first), hashPatientSessionToken(first));
});

test('patient cookie hashing decodes the cookie value and matches the server-side token hash', () => {
  const token = generatePatientSessionToken();
  const cookie = buildPatientCookieHeader(token);
  assert.equal(hashPatientCookie(cookie), hashPatientSessionToken(token));
  assert.equal(hashPatientCookie('unrelated=value'), null);
});
