import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

@Injectable()
export class WebhookSecretService {
  generate(): string {
    return randomBytes(32).toString('base64url');
  }

  fingerprint(secret: string): string {
    return createHash('sha256').update(secret).digest('hex');
  }

  encrypt(secret: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key(), iv);
    const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
    return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString('base64url')).join('.');
  }

  decrypt(value: string): string {
    const [ivRaw, tagRaw, encryptedRaw] = value.split('.');
    if (!ivRaw || !tagRaw || !encryptedRaw) throw new ServiceUnavailableException('Webhook secret is invalid');
    const decipher = createDecipheriv('aes-256-gcm', this.key(), Buffer.from(ivRaw, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(encryptedRaw, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  }

  private key(): Buffer {
    const configured = process.env.WEBHOOK_SECRET_ENCRYPTION_KEY?.trim();
    if (!configured) {
      if ((process.env.NODE_ENV || '').trim().toLowerCase() === 'production') {
        throw new ServiceUnavailableException('WEBHOOK_SECRET_ENCRYPTION_KEY is required in production');
      }
      return createHash('sha256').update('priage-development-webhook-secret').digest();
    }
    const decoded = /^[0-9a-f]{64}$/i.test(configured)
      ? Buffer.from(configured, 'hex')
      : Buffer.from(configured, 'base64');
    if (decoded.length !== 32) {
      throw new ServiceUnavailableException('WEBHOOK_SECRET_ENCRYPTION_KEY must decode to 32 bytes');
    }
    return decoded;
  }
}
