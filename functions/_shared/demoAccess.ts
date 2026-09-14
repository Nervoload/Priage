import {
  DEMO_SESSION_COOKIE_NAME,
  constantTimeEquals,
  hmacSha256Hex,
  signSessionId,
  validateDemoSession,
  type D1Database,
  type D1Value,
  type DemoSession,
} from '../../cloudflare/demo-session';

export { validateDemoSession };
export type { D1Database, DemoSession };

export type Env = {
  DEMO_DB?: D1Database;
  DEMO_CODE_PEPPER?: string;
  DEMO_SESSION_SECRET?: string;
};

export type PagesFunctionContext = {
  request: Request;
  env: Env;
  next?: () => Promise<Response>;
};

export type PagesFunction = (context: PagesFunctionContext) => Response | Promise<Response>;

const SESSION_TTL_SECONDS = 48 * 60 * 60;
const SESSION_TTL_MS = SESSION_TTL_SECONDS * 1000;
const VERIFY_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const SESSION_ACTION_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const MAX_VERIFY_IP_ATTEMPTS_PER_WINDOW = 30;
const MAX_VERIFY_EMAIL_ATTEMPTS_PER_WINDOW = 12;
const MAX_VERIFY_ATTEMPTS = 10;
const MAX_DEMO_EVENTS_PER_SESSION_WINDOW = 180;
const MAX_CALLBACK_REQUESTS_PER_SESSION_WINDOW = 5;
const MAX_JSON_BODY_BYTES = 16 * 1024;

class DemoAccessError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = 'DemoAccessError';
  }
}

class DemoConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DemoConfigurationError';
  }
}

export async function handleVerifyDemoCode(request: Request, env: Env): Promise<Response> {
  try {
    const body = await readJsonObject(request);
    const email = requireString(body.email, 'email', 254);
    const code = requireString(body.code, 'demo code', 32);
    const requestId = optionalString(body.requestId, 80) ?? optionalString(body.request_id, 80);
    const normalizedEmail = normalizeEmail(email);
    const normalizedCode = normalizeDemoCode(code);

    if (!normalizedCode) {
      throw new DemoAccessError('Enter the demo code from your email.');
    }

    const db = requireDb(env);
    const codePepper = requireEnv(env.DEMO_CODE_PEPPER, 'DEMO_CODE_PEPPER');
    const sessionSecret = requireEnv(env.DEMO_SESSION_SECRET, 'DEMO_SESSION_SECRET');
    const now = Date.now();
    const remoteIp = getClientIp(request);
    const windowStart = Math.floor(now / VERIFY_LIMIT_WINDOW_MS) * VERIFY_LIMIT_WINDOW_MS;
    const counterExpiresAt = windowStart + VERIFY_LIMIT_WINDOW_MS * 2;

    const emailAttemptCount = await incrementRateLimitCounter(db, {
      action: 'verify_email',
      identifierHash: await hmacSha256Hex(codePepper, `verify-email:${normalizedEmail}`),
      windowStart,
      expiresAt: counterExpiresAt,
    });
    const ipAttemptCount = remoteIp
      ? await incrementRateLimitCounter(db, {
          action: 'verify_ip',
          identifierHash: await hmacSha256Hex(codePepper, `verify-ip:${coarseIpPrefix(remoteIp)}`),
          windowStart,
          expiresAt: counterExpiresAt,
        })
      : 0;

    if (
      emailAttemptCount > MAX_VERIFY_EMAIL_ATTEMPTS_PER_WINDOW ||
      ipAttemptCount > MAX_VERIFY_IP_ATTEMPTS_PER_WINDOW
    ) {
      await recordDemoEvent(db, {
        eventType: 'verify_demo_rate_limited',
        createdAt: now,
        payload: {
          emailLimited: emailAttemptCount > MAX_VERIFY_EMAIL_ATTEMPTS_PER_WINDOW,
          ipLimited: ipAttemptCount > MAX_VERIFY_IP_ATTEMPTS_PER_WINDOW,
        },
      });
      return json({ ok: false, error: 'Unable to verify that demo code.' }, { status: 429 });
    }

    const submittedHash = await hmacSha256Hex(codePepper, `${normalizedEmail}:${normalizedCode}`);
    const foundRequest = await findRequestForVerification(db, normalizedEmail, submittedHash, requestId);

    if (!foundRequest) {
      return json({ ok: false, error: 'Unable to verify that demo code.' }, { status: 400 });
    }

    const inactive =
      foundRequest.status !== 'pending' ||
      foundRequest.expiresAt <= now ||
      foundRequest.verifyAttempts >= MAX_VERIFY_ATTEMPTS ||
      foundRequest.redemptionCount >= foundRequest.maxRedemptions;

    if (inactive) {
      await recordDemoEvent(db, {
        requestId: foundRequest.id,
        eventType: 'verify_demo_code_rejected',
        createdAt: now,
        payload: { reason: verificationRejectionReason(foundRequest, now) },
      });
      return json({ ok: false, error: 'Unable to verify that demo code.' }, { status: 400 });
    }

    if (!constantTimeEquals(submittedHash, foundRequest.codeHash)) {
      await db
        .prepare('UPDATE demo_requests SET verify_attempts = verify_attempts + 1 WHERE id = ?')
        .bind(foundRequest.id)
        .run();
      await recordDemoEvent(db, {
        requestId: foundRequest.id,
        eventType: 'verify_demo_code_failed',
        createdAt: now,
      });
      return json({ ok: false, error: 'Unable to verify that demo code.' }, { status: 400 });
    }

    const sessionId = crypto.randomUUID();
    const userAgent = request.headers.get('user-agent') ?? '';
    const userAgentHash = userAgent ? await hmacSha256Hex(codePepper, `ua:${userAgent}`) : null;
    const ipPrefixHash = remoteIp ? await hmacSha256Hex(codePepper, `ip-prefix:${coarseIpPrefix(remoteIp)}`) : null;
    const expiresAt = Math.min(now + SESSION_TTL_MS, foundRequest.expiresAt);

    await db
      .prepare(
        `INSERT INTO demo_sessions (
          id, request_id, email_normalized, created_at, expires_at, last_seen_at,
          user_agent_hash, ip_prefix_hash, revoked_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(sessionId, foundRequest.id, normalizedEmail, now, expiresAt, null, userAgentHash, ipPrefixHash, null)
      .run();

    await db
      .prepare('UPDATE demo_requests SET redemption_count = redemption_count + 1 WHERE id = ?')
      .bind(foundRequest.id)
      .run();

    await recordDemoEvent(db, {
      sessionId,
      requestId: foundRequest.id,
      eventType: 'verify_demo_code_succeeded',
      createdAt: now,
    });

    const signature = await signSessionId(sessionId, sessionSecret);
    const headers = new Headers();
    headers.set('set-cookie', buildSessionCookie(request, sessionId, signature, Math.floor((expiresAt - now) / 1000)));

    return json({ ok: true, expiresAt }, { headers });
  } catch (error) {
    if (error instanceof DemoAccessError) {
      return json({ ok: false, error: error.message }, { status: error.status });
    }

    console.error('verify-demo-code failed', error);
    return json(
      { ok: false, error: 'Unable to verify that demo code.' },
      { status: error instanceof DemoConfigurationError ? 500 : 400 },
    );
  }
}

export async function handleDemoSession(request: Request, env: Env): Promise<Response> {
  const session = await validateDemoSession(request, env);
  if (!session) {
    return json({ ok: false }, { status: 401 });
  }

  return json({
    ok: true,
    email: session.emailNormalized,
    expiresAt: session.expiresAt,
  });
}

export async function handleDemoEvent(request: Request, env: Env): Promise<Response> {
  const session = await validateDemoSession(request, env);
  if (!session) return json({ ok: false, error: 'Demo access required.' }, { status: 401 });

  const db = requireDb(env);
  const now = Date.now();
  const allowed = await enforceSessionActionLimit(db, env, session, {
    action: 'demo_event',
    maxAttempts: MAX_DEMO_EVENTS_PER_SESSION_WINDOW,
    now,
  });
  if (!allowed) return json({ ok: false, error: 'Too many demo events.' }, { status: 429 });

  const body = await readJsonObject(request);
  const eventType = optionalString(body.type, 120) ?? optionalString(body.eventType, 120) ?? 'demo_event';
  const metadata = isRecord(body.metadata) ? body.metadata : isRecord(body.payload) ? body.payload : undefined;

  await recordDemoEvent(db, {
    sessionId: session.id,
    requestId: session.requestId,
    eventType,
    createdAt: now,
    payload: metadata,
  });

  return json({ ok: true });
}

export async function handleCallbackRequest(request: Request, env: Env): Promise<Response> {
  const session = await validateDemoSession(request, env);
  if (!session) return json({ ok: false, error: 'Demo access required.' }, { status: 401 });

  const db = requireDb(env);
  const now = Date.now();
  const allowed = await enforceSessionActionLimit(db, env, session, {
    action: 'callback_request',
    maxAttempts: MAX_CALLBACK_REQUESTS_PER_SESSION_WINDOW,
    now,
  });
  if (!allowed) return json({ ok: false, error: 'Too many callback requests.' }, { status: 429 });

  const body = await readJsonObject(request);
  const name = optionalString(body.name, 180);
  const organization = optionalString(body.organization, 180);
  const message = optionalMultilineString(body.message, 1600);
  const requestedTime = optionalString(body.requestedTime, 240) ?? optionalString(body.requested_time, 240);

  await db
    .prepare(
      `INSERT INTO callback_requests (
        id, session_id, request_id, email_normalized, name, organization, message, requested_time, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      session.id,
      session.requestId,
      session.emailNormalized,
      name,
      organization,
      message,
      requestedTime,
      now,
    )
    .run();

  await recordDemoEvent(db, {
    sessionId: session.id,
    requestId: session.requestId,
    eventType: 'callback_requested',
    createdAt: now,
  });

  return json({ ok: true });
}

export function redirectToDemo(request: Request): Response {
  const url = new URL(request.url);
  const demoUrl = new URL('/demo/access', url.origin);
  demoUrl.searchParams.set('returnTo', url.pathname + url.search);
  return Response.redirect(demoUrl.toString(), 302);
}

export function json(
  body: Record<string, unknown>,
  init: { status?: number; headers?: HeadersInit } = {},
): Response {
  const headers = new Headers(init.headers);
  headers.set('content-type', 'application/json; charset=utf-8');
  headers.set('cache-control', 'no-store');

  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers,
  });
}

export function handleOptions(methods: string[]): Response {
  return new Response(null, {
    status: 204,
    headers: {
      allow: methods.join(', '),
      'cache-control': 'no-store',
    },
  });
}

function requireDb(env: Env): D1Database {
  if (!env.DEMO_DB) {
    throw new DemoConfigurationError('DEMO_DB binding is required.');
  }
  return env.DEMO_DB;
}

function requireEnv(value: string | undefined, name: string): string {
  if (!value) {
    throw new DemoConfigurationError(`${name} is required.`);
  }
  return value;
}

async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('application/json')) {
    throw new DemoAccessError('Send a valid JSON request body.');
  }

  let body: unknown;
  try {
    body = JSON.parse(await readLimitedBody(request));
  } catch {
    throw new DemoAccessError('Send a valid JSON request body.');
  }

  if (!isRecord(body)) {
    throw new DemoAccessError('Send a valid JSON request body.');
  }

  return body;
}

async function readLimitedBody(request: Request): Promise<string> {
  const contentLength = request.headers.get('content-length');
  if (contentLength && Number(contentLength) > MAX_JSON_BODY_BYTES) {
    throw new DemoAccessError('Request body is too large.');
  }

  if (!request.body) {
    throw new DemoAccessError('Send a valid JSON request body.');
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let receivedBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;

    receivedBytes += value.byteLength;
    if (receivedBytes > MAX_JSON_BODY_BYTES) {
      throw new DemoAccessError('Request body is too large.');
    }
    chunks.push(value);
  }

  const bodyBytes = new Uint8Array(receivedBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bodyBytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bodyBytes);
}

function requireString(value: unknown, label: string, maxLength: number): string {
  if (typeof value !== 'string') throw new DemoAccessError(`Enter ${label}.`);
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (!normalized) throw new DemoAccessError(`Enter ${label}.`);
  if (normalized.length > maxLength) throw new DemoAccessError(`${label} is too long.`);
  return normalized;
}

function optionalString(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().replace(/\s+/g, ' ');
  return normalized ? normalized.slice(0, maxLength) : null;
}

function optionalMultilineString(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().replace(/\r\n/g, '\n');
  return normalized ? normalized.slice(0, maxLength) : null;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizeDemoCode(code: string): string {
  return code.replace(/[^a-z0-9]/gi, '').toUpperCase();
}

async function findRequestForVerification(
  db: D1Database,
  emailNormalized: string,
  submittedHash: string,
  requestId: string | null,
): Promise<{
  id: string;
  codeHash: string;
  status: string;
  expiresAt: number;
  maxRedemptions: number;
  redemptionCount: number;
  verifyAttempts: number;
} | null> {
  const sql = requestId
    ? `SELECT * FROM demo_requests WHERE id = ? AND email_normalized = ? LIMIT 1`
    : `SELECT * FROM demo_requests WHERE email_normalized = ? AND code_hash = ? ORDER BY created_at DESC LIMIT 1`;
  const statement = requestId
    ? db.prepare(sql).bind(requestId, emailNormalized)
    : db.prepare(sql).bind(emailNormalized, submittedHash);
  const row = await statement.first<Record<string, D1Value>>();
  if (!row) return null;
  return {
    id: String(row.id),
    codeHash: String(row.code_hash),
    status: String(row.status),
    expiresAt: Number(row.expires_at),
    maxRedemptions: Number(row.max_redemptions),
    redemptionCount: Number(row.redemption_count),
    verifyAttempts: Number(row.verify_attempts),
  };
}

async function incrementRateLimitCounter(
  db: D1Database,
  input: { action: string; identifierHash: string; windowStart: number; expiresAt: number },
): Promise<number> {
  const key = `${input.action}:${input.identifierHash}:${input.windowStart}`;
  await db
    .prepare(
      `INSERT INTO demo_rate_limits (
        key, action, identifier_hash, window_start, count, expires_at
      ) VALUES (?, ?, ?, ?, 1, ?)
      ON CONFLICT(key) DO UPDATE SET count = count + 1, expires_at = excluded.expires_at`,
    )
    .bind(key, input.action, input.identifierHash, input.windowStart, input.expiresAt)
    .run();

  const row = await db
    .prepare('SELECT count FROM demo_rate_limits WHERE key = ? LIMIT 1')
    .bind(key)
    .first<{ count: number }>();
  return Number(row?.count ?? 1);
}

async function enforceSessionActionLimit(
  db: D1Database,
  env: Env,
  session: DemoSession,
  input: { action: string; maxAttempts: number; now: number },
): Promise<boolean> {
  const codePepper = requireEnv(env.DEMO_CODE_PEPPER, 'DEMO_CODE_PEPPER');
  const windowStart = Math.floor(input.now / SESSION_ACTION_LIMIT_WINDOW_MS) * SESSION_ACTION_LIMIT_WINDOW_MS;
  const count = await incrementRateLimitCounter(db, {
    action: input.action,
    identifierHash: await hmacSha256Hex(codePepper, `${input.action}:${session.id}`),
    windowStart,
    expiresAt: windowStart + SESSION_ACTION_LIMIT_WINDOW_MS * 2,
  });
  return count <= input.maxAttempts;
}

async function recordDemoEvent(
  db: D1Database,
  event: {
    sessionId?: string | null;
    requestId?: string | null;
    eventType: string;
    payload?: Record<string, unknown>;
    createdAt: number;
  },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO demo_events (
        id, session_id, request_id, event_type, payload_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      event.sessionId ?? null,
      event.requestId ?? null,
      event.eventType,
      event.payload ? JSON.stringify(event.payload).slice(0, 4000) : null,
      event.createdAt,
    )
    .run();
}

function verificationRejectionReason(
  row: { status: string; expiresAt: number; verifyAttempts: number; redemptionCount: number; maxRedemptions: number },
  now: number,
): string {
  if (row.status !== 'pending') return 'inactive';
  if (row.expiresAt <= now) return 'expired';
  if (row.verifyAttempts >= MAX_VERIFY_ATTEMPTS) return 'attempt_limit';
  if (row.redemptionCount >= row.maxRedemptions) return 'redemption_limit';
  return 'unknown';
}

function buildSessionCookie(
  request: Request,
  sessionId: string,
  signature: string,
  maxAgeSeconds = SESSION_TTL_SECONDS,
): string {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${DEMO_SESSION_COOKIE_NAME}=${sessionId}.${signature}; HttpOnly${secure}; SameSite=Lax; Path=/; Max-Age=${maxAgeSeconds}`;
}

function getClientIp(request: Request): string | null {
  return (
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    null
  );
}

function coarseIpPrefix(ip: string): string {
  if (ip.includes(':')) return ip.split(':').slice(0, 4).join(':');
  return ip.split('.').slice(0, 3).join('.');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
