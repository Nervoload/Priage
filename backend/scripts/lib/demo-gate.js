// backend/scripts/lib/demo-gate.js
// Resolves the DEMO_ACCESS_CODE gate for test scripts.
// If DEMO_ACCESS_CODE is set, acquires the cookie value and returns a header
// string that every HTTP request and Socket.IO handshake can include.
// If not set, returns empty strings so callers don't need conditionals.

const DEMO_CODE = (process.env.DEMO_ACCESS_CODE || '').trim();
const COOKIE_NAME = 'priage_demo_access';

/**
 * Returns the Cookie header value to include with requests.
 * Empty string when the gate is inactive.
 */
function demoCookieHeader() {
  if (!DEMO_CODE) return '';
  return `${COOKIE_NAME}=${encodeURIComponent(DEMO_CODE)}`;
}

/**
 * Returns extra headers for Socket.IO client connections.
 * Empty object when the gate is inactive.
 */
function demoSocketHeaders() {
  const cookie = demoCookieHeader();
  return cookie ? { cookie } : {};
}

/**
 * Returns true when DEMO_ACCESS_CODE is configured.
 */
function isDemoGateActive() {
  return DEMO_CODE.length > 0;
}

module.exports = { demoCookieHeader, demoSocketHeaders, isDemoGateActive };
