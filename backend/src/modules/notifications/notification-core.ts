import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from 'crypto';

export const TEMPLATE_VERSION = 'clinic-email-v1';
export type EmailPayload = { from: string; to: string[]; replyTo: string; subject: string; text: string; html: string; tags: Array<{ name: string; value: string }> };
export type EmailPurpose = 'confirmation' | 'reminder' | 'change_pending' | 'cancellation' | 'recovery' | 'test';
export const EMAIL_RETRY_DELAYS = [60_000, 300_000, 1_800_000, 7_200_000, 28_800_000];

export function emailMode(): 'disabled' | 'capture' | 'test' | 'live' {
  const mode = process.env.CLINIC_EMAIL_MODE || (process.env.NODE_ENV === 'production' ? 'disabled' : 'capture');
  if (!['disabled', 'capture', 'test', 'live'].includes(mode)) throw new Error('Invalid CLINIC_EMAIL_MODE');
  return mode as ReturnType<typeof emailMode>;
}

export function validateReminderMinutes(value: unknown): number[] {
  if (!Array.isArray(value) || value.length > 2 || value.some((item) => !Number.isInteger(item) || item < 1 || item > 10080) || new Set(value).size !== value.length) {
    throw new BadRequestException('Choose up to two distinct reminder offsets between 1 and 10080 minutes');
  }
  return [...value].sort((a, b) => b - a);
}

export function notificationKey(): Buffer {
  const configured = process.env.NOTIFICATION_SECRET_ENCRYPTION_KEY?.trim();
  if (!configured) {
    if (process.env.NODE_ENV === 'production' || ['live', 'test'].includes(emailMode())) throw new ServiceUnavailableException('NOTIFICATION_SECRET_ENCRYPTION_KEY is required for provider delivery');
    return createHash('sha256').update('priage-local-notification-key').digest();
  }
  const key = Buffer.from(configured, /^[a-f0-9]{64}$/i.test(configured) ? 'hex' : 'base64');
  if (key.length !== 32) throw new ServiceUnavailableException('Notification key must decode to 32 bytes');
  return key;
}

export function digest(value: string): string { return createHmac('sha256', notificationKey()).update(value).digest('hex'); }
export function encrypt(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', notificationKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map((part) => part.toString('base64url')).join('.');
}
export function decrypt(value: string): string {
  const [iv, tag, ciphertext] = value.split('.');
  const decipher = createDecipheriv('aes-256-gcm', notificationKey(), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64url')), decipher.final()]).toString('utf8');
}

function escapeHtml(value: string): string { return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!)); }

export function renderEmail(input: { purpose: EmailPurpose; clinicName: string; recipient: string; replyTo: string; contactPhone?: string | null; startAt?: Date; timezone?: string; manageUrl: string; code?: string; notificationId: string }): EmailPayload {
  const titles: Record<EmailPurpose, string> = { confirmation: 'Appointment confirmed', reminder: 'Appointment reminder', change_pending: 'Appointment change awaiting confirmation', cancellation: 'Appointment cancelled', recovery: 'Your appointment access code', test: 'Clinic email test' };
  const time = input.startAt && input.timezone ? new Intl.DateTimeFormat('en-CA', { timeZone: input.timezone, dateStyle: 'full', timeStyle: 'short' }).format(input.startAt) + ' (' + input.timezone + ')' : null;
  const lines = [titles[input.purpose], input.clinicName];
  if (input.purpose === 'recovery') lines.push('Your verification code: ' + input.code, 'This code expires 10 minutes after your request. If you did not request it, ignore this email.');
  else if (input.purpose === 'change_pending') lines.push('Your previous confirmed time is no longer active. The new requested time is awaiting clinic confirmation.', ...(time ? ['Requested time: ' + time] : []));
  else if (input.purpose === 'cancellation') lines.push('Your appointment is no longer scheduled.', ...(time ? ['Previous time: ' + time] : []));
  else if (time) lines.push('Appointment: ' + time);
  if (input.purpose !== 'recovery') lines.push('For the latest appointment status, open the appointment page. Email does not guarantee that an appointment remains unchanged.');
  lines.push('Manage appointment: ' + input.manageUrl, 'Contact the clinic: ' + input.replyTo);
  if (input.contactPhone) lines.push('Phone: ' + input.contactPhone);
  const text = lines.join('\n\n');
  return { from: '"' + input.clinicName.replace(/[\r\n<>"\\]/g, '') + ' via Priage" <' + (process.env.CLINIC_EMAIL_FROM || 'appointments@priage.local') + '>', to: [input.recipient], replyTo: input.replyTo,
    subject: titles[input.purpose] + ' · ' + input.clinicName.replace(/[\r\n]/g, ''), text,
    html: '<!doctype html><html><body>' + lines.map((line) => line.startsWith('Manage appointment: ') ? '<p><a href="' + escapeHtml(input.manageUrl) + '">Manage appointment</a></p>' : '<p>' + escapeHtml(line) + '</p>').join('') + '</body></html>',
    tags: [{ name: 'notification_id', value: input.notificationId }] };
}

export function assertProviderConfiguration(): void {
  if (process.env.NODE_ENV === 'production' && emailMode() !== 'disabled') notificationKey();
  if (!['test', 'live'].includes(emailMode())) return;
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_WEBHOOK_SECRET || !process.env.RESEND_SENDER_DOMAIN_ID || !process.env.CLINIC_EMAIL_FROM || !process.env.PATIENT_APP_URL) throw new ServiceUnavailableException('Resend key, webhook secret, sender domain ID, sender and patient URL are required');
  const url = new URL(process.env.PATIENT_APP_URL);
  if (url.protocol !== 'https:') throw new ServiceUnavailableException('Provider delivery requires an HTTPS patient app URL');
  notificationKey();
  if (emailMode() === 'test' && !process.env.CLINIC_EMAIL_RECIPIENT_ALLOWLIST?.trim()) throw new ServiceUnavailableException('Test mode requires a recipient allowlist');
  if (emailMode() === 'live' && process.env.CLINIC_EMAIL_EXTERNAL_PROCESSING_APPROVED !== 'true') throw new ServiceUnavailableException('Live email requires documented external processing approval');
}
