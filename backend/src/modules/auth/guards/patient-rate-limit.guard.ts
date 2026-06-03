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

import { REDIS_CLIENT } from '../../redis/redis.module';
import type { PatientContext } from './patient.guard';

type RateBucket = {
  key: string;
  limit: number;
  ttlMs: number;
  label: string;
};

const RATE_LIMIT_SCRIPT = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('PTTL', KEYS[1])
return { current, ttl }
`;

function readPositiveIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function isUnsafeMethod(method: string | undefined): boolean {
  return !['GET', 'HEAD', 'OPTIONS'].includes(String(method || '').toUpperCase());
}

function isUploadRequest(req: Record<string, any>): boolean {
  const path = String(req.originalUrl || req.url || '');
  const contentType = String(req.headers?.['content-type'] || '').toLowerCase();
  return contentType.includes('multipart/form-data') || path.includes('/images') || path.includes('/assets');
}

@Injectable()
export class PatientRateLimitGuard implements CanActivate {
  private readonly readLimit = readPositiveIntEnv('PATIENT_RATE_LIMIT_PER_MINUTE', 180);
  private readonly writeLimit = readPositiveIntEnv('PATIENT_WRITE_RATE_LIMIT_PER_MINUTE', 30);
  private readonly uploadLimit = readPositiveIntEnv('PATIENT_UPLOAD_RATE_LIMIT_PER_MINUTE', 8);
  private readonly patientGlobalLimit = readPositiveIntEnv('PATIENT_GLOBAL_RATE_LIMIT_PER_MINUTE', 300);
  private readonly ttlMs = readPositiveIntEnv('PATIENT_RATE_LIMIT_TTL_MS', 60_000);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const patient = req.patientUser as PatientContext | undefined;
    if (!patient) {
      return true;
    }

    const unsafe = isUnsafeMethod(req.method);
    const upload = unsafe && isUploadRequest(req);
    const buckets: RateBucket[] = [
      {
        key: `patient:${patient.patientId}:all`,
        limit: this.patientGlobalLimit,
        ttlMs: this.ttlMs,
        label: 'patient',
      },
      {
        key: `patient-session:${patient.sessionId}:read`,
        limit: this.readLimit,
        ttlMs: this.ttlMs,
        label: 'patient session',
      },
    ];

    if (unsafe) {
      buckets.push({
        key: `patient-session:${patient.sessionId}:write`,
        limit: this.writeLimit,
        ttlMs: this.ttlMs,
        label: 'patient write',
      });
    }

    if (upload) {
      buckets.push({
        key: `patient-session:${patient.sessionId}:upload`,
        limit: this.uploadLimit,
        ttlMs: this.ttlMs,
        label: 'patient upload',
      });
    }

    for (const bucket of buckets) {
      await this.consume(bucket);
    }

    return true;
  }

  private async consume(bucket: RateBucket): Promise<void> {
    try {
      const key = `rl:${bucket.key}`;
      const result = await this.redis.eval(RATE_LIMIT_SCRIPT, 1, key, bucket.ttlMs);
      const [rawCount, rawTtl] = Array.isArray(result) ? result : [0, bucket.ttlMs];
      const count = Number(rawCount);
      const ttl = Number(rawTtl);

      if (count > bucket.limit) {
        const retryAfterSeconds = Math.max(1, Math.ceil((Number.isFinite(ttl) ? ttl : bucket.ttlMs) / 1000));
        throw new HttpException(
          `${bucket.label} rate limit exceeded. Retry after ${retryAfterSeconds} seconds.`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    } catch (error) {
      if (error instanceof HttpException && error.getStatus() === HttpStatus.TOO_MANY_REQUESTS) {
        throw error;
      }
      throw new ServiceUnavailableException('Patient rate limiter is unavailable');
    }
  }
}
