import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHmac } from 'crypto';
import { assertProviderConfiguration, decrypt, digest, encrypt, renderEmail, validateReminderMinutes } from '../src/modules/notifications/notification-core';
import { NotificationProvider, EmailSendError } from '../src/modules/notifications/notification-provider';
import { NotificationDeliveryService } from '../src/modules/notifications/notification-delivery.service';
const email = () => renderEmail({ purpose: 'confirmation', clinicName: '<Mock Clinic>', recipient: 'mock@example.com', replyTo: 'desk@example.com', startAt: new Date('2026-11-01T06:30:00Z'), timezone: 'America/Toronto', manageUrl: 'https://priage.ca/mock/appointment#ref=opaque', notificationId: 'notice' });

describe('clinic email policy and secrets', () => {
  afterEach(() => vi.unstubAllEnvs());
  it('bounds and normalizes reminder offsets', () => {
    expect(validateReminderMinutes([120, 1440])).toEqual([1440, 120]); expect(validateReminderMinutes([])).toEqual([]);
    for (const value of [[0], [1.5], [1440, 1440], [1, 2, 3], [10081]]) expect(() => validateReminderMinutes(value)).toThrow();
  });
  it('renders scheduling only with escaped HTML, a usable link and DST local time', () => {
    const payload = email(); expect(payload.html).toContain('&lt;Mock Clinic&gt;'); expect(payload.html).toContain('<a href="https://priage.ca/mock/appointment#ref=opaque">');
    expect(payload.text).toMatch(/1:30/); expect(payload.text).toContain('America/Toronto'); expect(payload.text).not.toMatch(/complaint|assessment|OHIP/);
  });
  it('encrypts ephemeral material with integrity protection and keyed hashes', () => {
    const value = encrypt('123456'); expect(value).not.toContain('123456'); expect(decrypt(value)).toBe('123456'); expect(digest('code:a:123456')).not.toBe(digest('code:b:123456'));
    const parts = value.split('.'); parts[2] = Buffer.from('modified').toString('base64url'); expect(() => decrypt(parts.join('.'))).toThrow();
  });
  it('requires explicit provider configuration', () => { vi.stubEnv('CLINIC_EMAIL_MODE', 'live'); vi.stubEnv('RESEND_API_KEY', ''); expect(assertProviderConfiguration).toThrow(); });
  it('captures locally without provider requests', async () => { vi.stubEnv('CLINIC_EMAIL_MODE', 'capture'); expect(await new NotificationProvider().send(email(), 'stable-key')).toEqual({ provider: 'capture', id: 'capture_stable-key' }); });
  it('verifies exact signed webhook bytes and rejects changed bodies', () => {
    const secret = Buffer.alloc(32, 7); vi.stubEnv('RESEND_WEBHOOK_SECRET', 'whsec_' + secret.toString('base64'));
    const timestamp = Math.floor(Date.now() / 1000).toString(); const id = 'msg_mock';
    const body = JSON.stringify({ type: 'email.delivered', created_at: new Date().toISOString(), data: { email_id: 'mock' } });
    const signature = 'v1,' + createHmac('sha256', secret).update(`${id}.${timestamp}.${body}`).digest('base64'); const provider = new NotificationProvider();
    expect(provider.verify(body, { id, timestamp, signature }).type).toBe('email.delivered'); expect(() => provider.verify(body + ' ', { id, timestamp, signature })).toThrow();
  });
});
function harness(overrides: Record<string, unknown> = {}) {
  let row: any = { id: 'notice', hospitalId: 2, encounterId: 3, appointmentId: 4, purpose: 'confirmation', recipientEmail: 'mock@example.com', contactVersion: 1, appointmentRevision: 2, status: 'QUEUED', dueAt: new Date(Date.now() - 1000), expiresAt: new Date(Date.now() + 86400000), attemptCount: 0, firstAttemptAt: null, payload: null, ...overrides };
  const appointment: any = { hospitalId: 2, revision: 2, status: 'CONFIRMED', requestedStartAt: new Date(Date.now() + 86400000), encounter: { status: 'EXPECTED', contact: { version: 1, email: 'mock@example.com' } } };
  const update = (data: any) => { const { attemptCount, ...rest } = data; row = { ...row, ...rest, ...(attemptCount ? { attemptCount: typeof attemptCount === 'number' ? attemptCount : row.attemptCount + attemptCount.increment } : {}) }; return row; };
  const db: any = { $executeRaw: vi.fn(), notificationSuppression: { findUnique: vi.fn().mockResolvedValue(null), upsert: vi.fn() }, clinicNotificationSettings: { findUnique: vi.fn().mockResolvedValue({ enabled: true }) }, clinicAppointment: { findUnique: vi.fn(async () => appointment) }, notificationOutbox: { findUnique: vi.fn(async () => row), findUniqueOrThrow: vi.fn(async () => row), findFirst: vi.fn(async () => row), update: vi.fn(async ({ data }) => update(data)), updateMany: vi.fn(async ({ where, data }) => { if (where.status && where.status !== row.status) return { count: 0 }; update(data); return { count: 1 }; }) }, notificationAttempt: { create: vi.fn() }, notificationWebhookReceipt: { createMany: vi.fn().mockResolvedValue({ count: 1 }) } };
  db.$transaction = async (callback: any) => callback(db);
  const notifications: any = { buildPayload: vi.fn(async () => email()), notifyChanged: vi.fn() };
  const provider: any = { send: vi.fn().mockResolvedValue({ id: 'provider-id', provider: 'resend' }), verify: vi.fn() };
  return { service: new NotificationDeliveryService(db, notifications, provider), db, provider, notifications, appointment, row: () => row };
}
describe('durable email outcomes', () => {
  beforeEach(() => vi.stubEnv('CLINIC_EMAIL_MODE', 'capture')); afterEach(() => vi.unstubAllEnvs());
  it('freezes payload and stable key across ambiguous retries', async () => {
    const h = harness(); h.provider.send.mockRejectedValueOnce(new EmailSendError('provider_timeout', true, true)); await (h.service as any).deliverOne('notice', 3);
    expect(h.row().status).toBe('QUEUED'); const frozen = h.row().payload; h.row().dueAt = new Date(Date.now() - 1); await (h.service as any).deliverOne('notice', 3);
    expect(h.notifications.buildPayload).toHaveBeenCalledTimes(1); expect(h.provider.send).toHaveBeenLastCalledWith(frozen, 'clinic-email/notice'); expect(h.row().status).toBe('ACCEPTED');
  });
  it('stops unresolved work before the idempotency window expires', async () => {
    const h = harness({ firstAttemptAt: new Date(Date.now() - 24 * 3600000) }); await (h.service as any).deliverOne('notice', 3); expect(h.row().status).toBe('NEEDS_REVIEW'); expect(h.provider.send).not.toHaveBeenCalled();
  });
  it.each(['revision', 'contact', 'arrival', 'late'])('cancels obsolete %s work', async (kind) => {
    const h = harness(); if (kind === 'revision') h.appointment.revision++; if (kind === 'contact') h.appointment.encounter.contact.version++; if (kind === 'arrival') h.appointment.encounter.status = 'ADMITTED'; if (kind === 'late') h.row().expiresAt = new Date(Date.now() - 1);
    await (h.service as any).deliverOne('notice', 3); expect(h.row().status).toBe('CANCELLED'); expect(h.provider.send).not.toHaveBeenCalled();
  });
  it('requires review when a frozen request would switch delivery provider', async () => {
    const h = harness({ firstAttemptAt: new Date(), provider: 'resend' });
    await (h.service as any).deliverOne('notice', 3); expect(h.row().status).toBe('NEEDS_REVIEW'); expect(h.provider.send).not.toHaveBeenCalled();
  });
  it('bounds quota retries without claiming delivery', async () => {
    const h = harness({ attemptCount: 5 }); h.provider.send.mockRejectedValue(new EmailSendError('daily_quota_exceeded', true, false)); await (h.service as any).deliverOne('notice', 3); expect(h.row().status).toBe('FAILED'); expect(h.row().deliveredAt).toBeUndefined();
  });
  it('deduplicates receipts and retains a bounce despite later delivery events', async () => {
    const h = harness({ provider: 'resend', providerEmailId: 'provider-id', status: 'ACCEPTED' }); h.provider.verify.mockReturnValue({ type: 'email.bounced', created_at: new Date().toISOString(), data: { email_id: 'provider-id' } });
    await h.service.webhook('raw', { id: 'receipt', timestamp: '', signature: '' }); expect(h.row().status).toBe('FAILED'); expect(h.db.notificationSuppression.upsert).toHaveBeenCalledTimes(1);
    h.db.notificationWebhookReceipt.createMany.mockResolvedValue({ count: 0 }); await h.service.webhook('raw', { id: 'receipt', timestamp: '', signature: '' }); expect(h.notifications.notifyChanged).toHaveBeenCalledTimes(1);
    await (h.service as any).applyReceipt('provider-id', 'email.delivered', new Date(Date.now() + 1000)); expect(h.row().status).toBe('FAILED');
  });
});

describe('Resend adapter gates', () => {
  beforeEach(() => {
    vi.stubEnv('CLINIC_EMAIL_MODE', 'test'); vi.stubEnv('RESEND_API_KEY', 'mock'); vi.stubEnv('RESEND_WEBHOOK_SECRET', 'mock');
    vi.stubEnv('RESEND_SENDER_DOMAIN_ID', 'domain_mock'); vi.stubEnv('CLINIC_EMAIL_FROM', 'appointments@priage.ca'); vi.stubEnv('PATIENT_APP_URL', 'https://priage.ca');
    vi.stubEnv('NOTIFICATION_SECRET_ENCRYPTION_KEY', 'a'.repeat(64)); vi.stubEnv('CLINIC_EMAIL_RECIPIENT_ALLOWLIST', 'mock@example.com');
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
  it('rejects recipients outside the server allowlist before network access', async () => {
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    await expect(new NotificationProvider().send({ ...email(), to: ['other@example.com'] }, 'key')).rejects.toMatchObject({ code: 'recipient_not_allowlisted' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('rejects enabled tracking before submitting a message', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ name: 'priage.ca', status: 'verified', open_tracking: true, click_tracking: false }), { status: 200 })); vi.stubGlobal('fetch', fetchMock);
    await expect(new NotificationProvider().send(email(), 'key')).rejects.toMatchObject({ code: 'sender_domain_or_tracking_not_ready' }); expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('uses the stable idempotency key and bounded request signal with a ready sender', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ name: 'priage.ca', status: 'verified', open_tracking: false, click_tracking: false }), { status: 200 })).mockResolvedValueOnce(new Response(JSON.stringify({ id: 'provider_mock' }), { status: 200 })); vi.stubGlobal('fetch', fetchMock);
    expect(await new NotificationProvider().send(email(), 'frozen-key')).toEqual({ id: 'provider_mock', provider: 'resend' });
    const options = fetchMock.mock.calls[1][1]; expect(options.headers.get('Idempotency-Key')).toBe('frozen-key'); expect(options.signal).toBeInstanceOf(AbortSignal);
  });
});
