export type D1Value = string | number | null;

type D1PreparedStatement = {
  bind(...values: D1Value[]): D1PreparedStatement;
  first<T = Record<string, D1Value>>(): Promise<T | null>;
  run(): Promise<unknown>;
};

export type D1Database = {
  prepare(query: string): D1PreparedStatement;
};

export type DemoSessionValidationEnv = {
  DEMO_DB?: D1Database;
  DEMO_SESSION_SECRET?: string;
};

export type DemoSession = {
  id: string;
  requestId: string;
  emailNormalized: string;
  expiresAt: number;
};

export const DEMO_SESSION_COOKIE_NAME = 'priage_demo_session';

export async function validateDemoSession(
  request: Request,
  env: DemoSessionValidationEnv,
  options: { touch?: boolean } = {},
): Promise<DemoSession | null> {
  const db = env.DEMO_DB;
  const sessionSecret = env.DEMO_SESSION_SECRET;
  if (!db || !sessionSecret) return null;

  const cookieValue = parseCookies(request.headers.get('cookie') || '')[DEMO_SESSION_COOKIE_NAME];
  if (!cookieValue) return null;

  const separatorIndex = cookieValue.indexOf('.');
  if (separatorIndex <= 0 || separatorIndex !== cookieValue.lastIndexOf('.')) return null;

  const sessionId = cookieValue.slice(0, separatorIndex);
  const signature = cookieValue.slice(separatorIndex + 1);
  if (!sessionId || sessionId.length > 128 || !/^[a-f0-9]{64}$/.test(signature)) return null;

  const expectedSignature = await signSessionId(sessionId, sessionSecret);
  if (!constantTimeEquals(signature, expectedSignature)) return null;

  const now = Date.now();
  const row = await db
    .prepare(
      `SELECT
        id,
        request_id,
        email_normalized,
        expires_at,
        revoked_at
      FROM demo_sessions
      WHERE id = ?
      LIMIT 1`,
    )
    .bind(sessionId)
    .first<Record<string, D1Value>>();

  if (!row || row.revoked_at !== null) return null;

  const expiresAt = Number(row.expires_at);
  if (!Number.isFinite(expiresAt) || expiresAt <= now) return null;

  if (options.touch !== false) {
    await db
      .prepare('UPDATE demo_sessions SET last_seen_at = ? WHERE id = ?')
      .bind(now, sessionId)
      .run();
  }

  return {
    id: String(row.id),
    requestId: String(row.request_id),
    emailNormalized: String(row.email_normalized),
    expiresAt,
  };
}

export async function signSessionId(sessionId: string, sessionSecret: string): Promise<string> {
  return hmacSha256Hex(sessionSecret, sessionId);
}

export async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function constantTimeEquals(a: string, b: string): boolean {
  let mismatch = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    mismatch |= (a.charCodeAt(index) || 0) ^ (b.charCodeAt(index) || 0);
  }
  return mismatch === 0;
}

function parseCookies(header: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const part of header.split(';')) {
    const [name, ...valueParts] = part.trim().split('=');
    if (!name) continue;
    cookies[name] = valueParts.join('=');
  }
  return cookies;
}
