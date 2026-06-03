import { createHash, randomBytes } from 'crypto';

export function generatePatientSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashPatientSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
