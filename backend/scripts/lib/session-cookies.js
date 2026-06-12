const { createHash, randomBytes } = require('crypto');

const PATIENT_SESSION_COOKIE = 'priage_patient_session';

function getSetCookieHeaders(headers) {
  if (Array.isArray(headers?.['set-cookie'])) {
    return headers['set-cookie'];
  }
  if (headers?.['set-cookie']) {
    return [headers['set-cookie']];
  }
  if (typeof headers?.getSetCookie === 'function') {
    return headers.getSetCookie();
  }
  const combined = headers?.get?.('set-cookie');
  return combined ? [combined] : [];
}

function extractCookieValue(headers, cookieName) {
  for (const cookie of getSetCookieHeaders(headers)) {
    const match = String(cookie).match(new RegExp(`${cookieName}=([^;]+)`));
    if (match?.[1]) {
      return decodeURIComponent(match[1]);
    }
  }
  return null;
}

function extractCookieHeader(headers, cookieName) {
  const value = extractCookieValue(headers, cookieName);
  return value ? `${cookieName}=${encodeURIComponent(value)}` : null;
}

function extractPatientCookieHeader(headers) {
  return extractCookieHeader(headers, PATIENT_SESSION_COOKIE);
}

function buildPatientCookieHeader(token) {
  return `${PATIENT_SESSION_COOKIE}=${encodeURIComponent(token)}`;
}

function generatePatientSessionToken() {
  return randomBytes(32).toString('base64url');
}

function hashPatientSessionToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

function hashPatientCookie(patientCookie) {
  const prefix = `${PATIENT_SESSION_COOKIE}=`;
  const encodedValue = String(patientCookie || '').startsWith(prefix)
    ? String(patientCookie).slice(prefix.length).split(';')[0]
    : '';
  if (!encodedValue) {
    return null;
  }
  return hashPatientSessionToken(decodeURIComponent(encodedValue));
}

module.exports = {
  PATIENT_SESSION_COOKIE,
  buildPatientCookieHeader,
  extractCookieHeader,
  extractCookieValue,
  extractPatientCookieHeader,
  generatePatientSessionToken,
  getSetCookieHeaders,
  hashPatientCookie,
  hashPatientSessionToken,
};
