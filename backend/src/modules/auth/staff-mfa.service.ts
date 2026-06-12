import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'crypto';

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

@Injectable()
export class StaffMfaService {
  createSecret(): string {
    return this.base32Encode(randomBytes(20));
  }

  buildOtpAuthUri(email: string, secret: string): string {
    const issuer = process.env.STAFF_MFA_ISSUER?.trim() || 'Priage';
    return `otpauth://totp/${encodeURIComponent(`${issuer}:${email}`)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
  }

  verify(secret: string, code: string): boolean {
    const normalized = code.replace(/\s+/g, '');
    const step = Math.floor(Date.now() / 30_000);
    return [-1, 0, 1].some((offset) => this.totp(secret, step + offset) === normalized);
  }

  encrypt(secret: string): string {
    const key = this.encryptionKey();
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
  }

  decrypt(value: string): string {
    const [ivRaw, tagRaw, encryptedRaw] = value.split('.');
    const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey(), Buffer.from(ivRaw, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(encryptedRaw, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  }

  private totp(secret: string, step: number): string {
    const counter = Buffer.alloc(8);
    counter.writeBigUInt64BE(BigInt(step));
    const digest = createHmac('sha1', this.base32Decode(secret)).update(counter).digest();
    const offset = digest[digest.length - 1] & 0x0f;
    const value = (digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
    return String(value).padStart(6, '0');
  }

  private encryptionKey(): Buffer {
    const configured = process.env.STAFF_MFA_ENCRYPTION_KEY?.trim();
    if (!configured) {
      if ((process.env.NODE_ENV || '').toLowerCase() === 'production') {
        throw new ServiceUnavailableException('STAFF_MFA_ENCRYPTION_KEY is required in production');
      }
      return createHmac('sha256', 'priage-development-only').update('staff-mfa').digest();
    }
    const decoded = /^[0-9a-f]{64}$/i.test(configured)
      ? Buffer.from(configured, 'hex')
      : Buffer.from(configured, 'base64');
    if (decoded.length !== 32) {
      throw new ServiceUnavailableException('STAFF_MFA_ENCRYPTION_KEY must decode to 32 bytes');
    }
    return decoded;
  }

  private base32Encode(value: Buffer): string {
    let bits = '';
    for (const byte of value) bits += byte.toString(2).padStart(8, '0');
    return bits.match(/.{1,5}/g)?.map((chunk) => BASE32[Number.parseInt(chunk.padEnd(5, '0'), 2)]).join('') || '';
  }

  private base32Decode(value: string): Buffer {
    const bits = value.toUpperCase().replace(/=+$/, '').split('')
      .map((character) => BASE32.indexOf(character).toString(2).padStart(5, '0'))
      .join('');
    return Buffer.from(bits.match(/.{8}/g)?.map((byte) => Number.parseInt(byte, 2)) || []);
  }
}

