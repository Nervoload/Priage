#!/usr/bin/env node

import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { createReadStream, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const runtimeDir = join(projectRoot, '.priage-dev');
const accessFile = join(runtimeDir, 'demo-access.json');
const eventLogFile = join(runtimeDir, 'demo-events.jsonl');
const staticRoot = join(projectRoot, 'dist', 'static-demo');
const port = Number.parseInt(readArg('--port') || process.env.PRIAGE_DEMO_PORT || '5175', 10);
const host = readArg('--host') || process.env.PRIAGE_DEMO_HOST || '127.0.0.1';
const cookieName = 'priage_demo_session';
const protectedPrefixes = [
  '/demo/patient',
  '/demo/hospital',
  '/demo/care',
  '/patient',
  '/care',
  '/hospital',
];

if (!Number.isInteger(port) || port <= 0) {
  throw new Error(`Invalid demo server port: ${port}`);
}

const server = createServer((request, response) => {
  void handleRequest(request, response).catch((error) => {
    console.error('[local-demo] request failed', error);
    sendText(response, 500, 'Local demo server error.');
  });
});

server.on('error', (error) => {
  console.error(`[local-demo] Failed to listen on ${host}:${port}.`, error);
  process.exit(1);
});

server.listen(port, host, () => {
  console.log(`[local-demo] Serving protected static demo at http://localhost:${port}/demo`);
});

async function handleRequest(request, response) {
  const url = new URL(request.url || '/', `http://${request.headers.host || `localhost:${port}`}`);
  const legacyRedirect = legacyDemoRedirect(url);
  if (legacyRedirect) {
    response.writeHead(302, {
      location: legacyRedirect,
      'cache-control': 'no-store',
    });
    response.end();
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/demo-session') {
    const session = validateSession(request);
    if (!session) return sendJson(response, 401, { ok: false });
    return sendJson(response, 200, {
      ok: true,
      sessionId: session.sessionId,
      email: session.email,
      expiresAt: session.expiresAt,
    });
  }

  if (request.method === 'POST' && url.pathname === '/api/verify-demo-code') {
    return handleVerify(request, response);
  }

  if (request.method === 'POST' && url.pathname === '/api/demo-events') {
    if (!validateSession(request)) return sendJson(response, 401, { ok: false, error: 'Demo access required.' });
    const body = await readJsonBody(request).catch(() => ({}));
    appendEvent('demo_event', body);
    return sendJson(response, 200, { ok: true });
  }

  if (request.method === 'POST' && url.pathname === '/api/callback-request') {
    const session = validateSession(request);
    if (!session) return sendJson(response, 401, { ok: false, error: 'Demo access required.' });
    const body = await readJsonBody(request).catch(() => ({}));
    appendEvent('callback_requested', { sessionId: session.sessionId, ...body });
    return sendJson(response, 200, { ok: true });
  }

  if (url.pathname.startsWith('/api/')) {
    return sendJson(response, 404, { ok: false, error: 'Unknown local demo API route.' });
  }

  const isProtected = protectedPrefixes.some((prefix) => url.pathname === prefix || url.pathname.startsWith(`${prefix}/`));
  if (isProtected && !validateSession(request)) {
    const acceptsHtml = String(request.headers.accept || '').includes('text/html');
    if (acceptsHtml || protectedPrefixes.includes(url.pathname)) {
      response.writeHead(302, {
        location: `/demo?returnTo=${encodeURIComponent(url.pathname + url.search)}`,
        'cache-control': 'no-store',
      });
      response.end();
      return;
    }
    return sendText(response, 403, 'Demo access required.');
  }

  return serveStatic(url.pathname, response);
}

async function handleVerify(request, response) {
  const config = readAccessConfig();
  const body = await readJsonBody(request);
  const email = normalizeEmail(body.email);
  const code = normalizeCode(body.code);
  const submittedHash = hmacHex(config.codePepper, `${email}:${code}`);

  if (email !== normalizeEmail(config.email) || !constantTimeEquals(submittedHash, config.codeHash) || Date.now() >= config.expiresAt) {
    appendEvent('verify_demo_code_failed', { email });
    return sendJson(response, 400, { ok: false, error: 'Unable to verify that demo code.' });
  }

  const sessionId = randomUUID();
  const expiresAt = Math.min(Date.now() + 48 * 60 * 60 * 1000, config.expiresAt);
  const signature = signSession(sessionId, config.sessionSecret);
  const cookie = `${cookieName}=${sessionId}.${signature}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${Math.floor((expiresAt - Date.now()) / 1000)}`;

  appendEvent('verify_demo_code_succeeded', { email, sessionId });
  return sendJson(response, 200, { ok: true, sessionId, expiresAt }, { 'set-cookie': cookie });
}

function serveStatic(pathname, response) {
  let mappedPath = pathname;
  if (mappedPath === '/') mappedPath = '/demo/index.html';
  if (mappedPath === '/demo' || mappedPath === '/demo/' || mappedPath === '/demo/access') {
    mappedPath = '/demo/index.html';
  }
  if (mappedPath.startsWith('/demo/access/') && !hasFileExtension(mappedPath)) mappedPath = '/demo/index.html';
  if (mappedPath === '/demo/patient') mappedPath = '/demo/patient/index.html';
  if (mappedPath === '/demo/hospital') mappedPath = '/demo/hospital/index.html';
  if (mappedPath.startsWith('/demo/patient/') && !hasFileExtension(mappedPath)) {
    mappedPath = '/demo/patient/index.html';
  }
  if (mappedPath.startsWith('/demo/hospital/') && !hasFileExtension(mappedPath)) {
    mappedPath = '/demo/hospital/index.html';
  }

  const filePath = resolve(staticRoot, `.${decodeURIComponent(mappedPath)}`);
  const withinStaticRoot = filePath === staticRoot || filePath.startsWith(`${staticRoot}/`);
  if (!withinStaticRoot || !existsSync(filePath) || !statSync(filePath).isFile()) {
    const fallback = join(staticRoot, 'index.html');
    if (existsSync(fallback)) return streamFile(fallback, response, 'text/html; charset=utf-8', true);
    return sendText(response, 404, 'Not found.');
  }

  return streamFile(filePath, response, contentTypeFor(filePath), shouldNoStore(pathname));
}

function streamFile(filePath, response, contentType, noStore) {
  response.writeHead(200, {
    'content-type': contentType,
    'cache-control': noStore ? 'no-store' : 'public, max-age=3600',
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'referrer-policy': 'strict-origin-when-cross-origin',
  });
  createReadStream(filePath).pipe(response);
}

function shouldNoStore(pathname) {
  return pathname === '/demo' || protectedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function legacyDemoRedirect(url) {
  const legacyPairs = [
    ['/demo/care', '/demo/hospital'],
    ['/patient', '/demo/patient'],
    ['/care', '/demo/hospital'],
    ['/hospital', '/demo/hospital'],
  ];

  for (const [from, to] of legacyPairs) {
    if (url.pathname === from || url.pathname.startsWith(`${from}/`)) {
      return `${to}${url.pathname.slice(from.length)}${url.search}`;
    }
  }

  return null;
}

function readAccessConfig() {
  if (!existsSync(accessFile)) {
    throw new Error(`Missing local demo access file: ${accessFile}. Run ./priage-dev demo first.`);
  }
  return JSON.parse(readFileSync(accessFile, 'utf8'));
}

function validateSession(request) {
  let config;
  try {
    config = readAccessConfig();
  } catch {
    return null;
  }

  const cookie = parseCookies(request.headers.cookie || '')[cookieName];
  if (!cookie) return null;
  const [sessionId, signature] = cookie.split('.');
  if (!sessionId || !signature) return null;
  if (!constantTimeEquals(signature, signSession(sessionId, config.sessionSecret))) return null;
  if (Date.now() >= config.expiresAt) return null;
  return { sessionId, email: normalizeEmail(config.email), expiresAt: config.expiresAt };
}

function parseCookies(header) {
  const cookies = {};
  for (const part of header.split(';')) {
    const [name, ...valueParts] = part.trim().split('=');
    if (name) cookies[name] = valueParts.join('=');
  }
  return cookies;
}

function readJsonBody(request) {
  return new Promise((resolvePromise, reject) => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > 16 * 1024) {
        request.destroy();
        reject(new Error('Request body is too large.'));
      }
    });
    request.on('end', () => {
      try {
        resolvePromise(JSON.parse(body || '{}'));
      } catch (error) {
        reject(error);
      }
    });
    request.on('error', reject);
  });
}

function appendEvent(type, payload) {
  mkdirSync(runtimeDir, { recursive: true });
  writeFileSync(
    eventLogFile,
    `${JSON.stringify({ type, payload, createdAt: new Date().toISOString() })}\n`,
    { flag: 'a' },
  );
}

function sendJson(response, status, body, headers = {}) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    ...headers,
  });
  response.end(JSON.stringify(body));
}

function sendText(response, status, body) {
  response.writeHead(status, {
    'content-type': 'text/plain; charset=utf-8',
    'cache-control': 'no-store',
  });
  response.end(body);
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeCode(value) {
  return String(value || '').replace(/[^a-z0-9]/gi, '').toUpperCase();
}

function signSession(sessionId, sessionSecret) {
  return hmacHex(sessionSecret, sessionId);
}

function hmacHex(secret, message) {
  return createHmac('sha256', secret).update(message).digest('hex');
}

function constantTimeEquals(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function hasFileExtension(pathname) {
  return Boolean(extname(pathname));
}

function contentTypeFor(filePath) {
  switch (extname(filePath).toLowerCase()) {
    case '.html':
      return 'text/html; charset=utf-8';
    case '.js':
      return 'text/javascript; charset=utf-8';
    case '.css':
      return 'text/css; charset=utf-8';
    case '.json':
      return 'application/json; charset=utf-8';
    case '.svg':
      return 'image/svg+xml';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.ico':
      return 'image/x-icon';
    default:
      return 'application/octet-stream';
  }
}

function readArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}
