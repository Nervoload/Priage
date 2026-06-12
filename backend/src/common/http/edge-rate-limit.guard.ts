import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import type Redis from 'ioredis';
import { createHash, timingSafeEqual } from 'crypto';

import { REDIS_CLIENT } from '../../modules/redis/redis.module';
import {
  PATIENT_SESSION_COOKIE,
  STAFF_AUTH_COOKIE,
  parseCookieHeader,
} from './auth-cookie.util';

const RATE_LIMIT_SCRIPT = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
return { current, redis.call('PTTL', KEYS[1]) }
`;

@Injectable()
export class EdgeRateLimitGuard implements CanActivate {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const path = String(req.originalUrl || req.url || '/').split('?')[0];
    if (path === '/health/live' || path === '/health/ready') {
      return true;
    }

    this.assertGateway(req.headers?.['x-priage-gateway-token']);
    const ip = String(req.ip || req.socket?.remoteAddress || 'unknown');
    const [limit, ttlMs, bucket] = this.resolvePolicy(path, String(req.method || 'GET'));
    try {
      await this.consume(
        `edge-rate:${bucket}:${this.hash(ip)}`,
        limit,
        ttlMs,
        'Request rate limit exceeded',
      );
      const authMaterial = this.extractAuthMaterial(req.headers || {});
      if (authMaterial) {
        await this.consume(
          `edge-rate:token-attempt:${this.hash(authMaterial)}`,
          this.envInt('EDGE_TOKEN_ATTEMPT_LIMIT', 300),
          60_000,
          'Authentication token request limit exceeded',
        );
      }
      return true;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException('Distributed request limiter is unavailable');
    }
  }

  private async consume(key: string, limit: number, ttlMs: number, message: string): Promise<void> {
    const result = await this.redis.eval(RATE_LIMIT_SCRIPT, 1, key, ttlMs);
    const [countRaw, ttlRaw] = Array.isArray(result) ? result : [0, ttlMs];
    if (Number(countRaw) > limit) {
      const retryAfter = Math.max(1, Math.ceil(Number(ttlRaw) / 1000));
      throw new HttpException(`${message}. Retry after ${retryAfter} seconds.`, HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  private extractAuthMaterial(headers: Record<string, string | string[] | undefined>): string | null {
    const authorization = Array.isArray(headers.authorization) ? headers.authorization[0] : headers.authorization;
    if (authorization) return `authorization:${authorization}`;
    const cookies = parseCookieHeader(headers.cookie);
    if (cookies[STAFF_AUTH_COOKIE]) return `staff:${cookies[STAFF_AUTH_COOKIE]}`;
    if (cookies[PATIENT_SESSION_COOKIE]) return `patient:${cookies[PATIENT_SESSION_COOKIE]}`;
    const patientHeader = Array.isArray(headers['x-patient-token'])
      ? headers['x-patient-token'][0]
      : headers['x-patient-token'];
    return patientHeader ? `legacy-patient:${patientHeader}` : null;
  }

  private hash(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  private resolvePolicy(path: string, method: string): [number, number, string] {
    if (/^\/(auth|patient-auth)\/(login|register|sso)/.test(path) || path === '/intake/intent') {
      return [this.envInt('EDGE_PUBLIC_AUTH_LIMIT', 30), 60_000, 'public-auth'];
    }
    if (path.startsWith('/patient/priage/hospitals')) {
      return [this.envInt('EDGE_DIRECTORY_LIMIT', 120), 60_000, 'directory'];
    }
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase())) {
      return [this.envInt('EDGE_WRITE_LIMIT', 120), 60_000, 'write'];
    }
    return [this.envInt('EDGE_GLOBAL_LIMIT', 600), 60_000, 'global'];
  }

  private assertGateway(raw: string | string[] | undefined): void {
    const expected = process.env.GATEWAY_SHARED_SECRET?.trim();
    if (!expected) return;
    const received = Array.isArray(raw) ? raw[0] : raw;
    const left = Buffer.from(createHash('sha256').update(received || '').digest('hex'));
    const right = Buffer.from(createHash('sha256').update(expected).digest('hex'));
    if (!timingSafeEqual(left, right)) {
      throw new HttpException('Direct origin access is not allowed', HttpStatus.FORBIDDEN);
    }
  }

  private envInt(name: string, fallback: number): number {
    const value = Number.parseInt(process.env[name] || '', 10);
    return Number.isFinite(value) && value > 0 ? value : fallback;
  }
}
