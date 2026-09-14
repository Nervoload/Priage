import { Injectable } from '@nestjs/common';
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'crypto';

@Injectable()
export class DemoTokenService {
  generateCode(): string {
    return String(randomInt(100000, 1000000));
  }

  generateAccessToken(): string {
    return randomBytes(32).toString('base64url');
  }

  hashSecret(value: string): string {
    const secret = process.env.DEMO_SESSION_HASH_SECRET || 'priage-demo-development-secret';
    return createHash('sha256').update(`${secret}:${value}`).digest('hex');
  }

  matches(value: string, hash: string): boolean {
    const candidate = Buffer.from(this.hashSecret(value), 'hex');
    const expected = Buffer.from(hash, 'hex');
    return candidate.length === expected.length && timingSafeEqual(candidate, expected);
  }
}
