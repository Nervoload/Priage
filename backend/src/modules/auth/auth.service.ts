// backend/src/modules/auth/auth.service.ts
// John Surette
// Dec 8, 2025
// auth.service.ts
// Checks user creds against Prisma-Postgres DB
// creates revocable staff sessions with audit metadata
// injected into auth.controller.ts

import { ForbiddenException, Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { verify as verifyJwt, type JwtPayload } from 'jsonwebtoken';

import { PrismaService } from '../prisma/prisma.service';
import { LoggingService } from '../logging/logging.service';
import { STAFF_AUTH_TTL_MS } from '../../common/http/auth-cookie.util';
import { LoginDto } from './dto/login.dto';
import { StaffMfaService } from './staff-mfa.service';

const STAFF_SESSION_ACTIVITY_TOUCH_MS = 5 * 60 * 1000;

export interface StaffAuthUser {
  userId: number;
  email: string;
  role: string;
  hospitalId: number;
  sessionId: number;
  sessionExpiresAt: string | null;
  hospital: {
    id: number;
    name: string;
    slug: string;
  };
}

type SessionAuditContext = {
  ipAddress?: string | null;
  userAgent?: string | null;
  deviceId?: string | null;
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly loggingService: LoggingService,
    private readonly staffMfa: StaffMfaService,
  ) {
    this.logger.log('AuthService initialized');
  }

  async login(dto: LoginDto, correlationId?: string, auditContext?: SessionAuditContext) {
    this.loggingService.info('Login attempt', {
      service: 'AuthService',
      operation: 'login',
      correlationId,
      userId: undefined,
    }, {
      hasEmail: !!dto.email,
      loginMethod: 'password',
    });

    try {
      const user = await this.prisma.user.findUnique({
        where: { email: dto.email },
        include: { hospital: true },
      });

      if (!user) {
        await this.loggingService.warn('Login failed - user not found', {
          service: 'AuthService',
          operation: 'login',
          correlationId,
          userId: undefined,
        }, {
          hasEmail: !!dto.email,
          loginMethod: 'password',
        });
        throw new UnauthorizedException('Invalid credentials');
      }

      // Compare hashed password
      const isPasswordValid = await bcrypt.compare(dto.password, user.password);

      if (!isPasswordValid) {
        await this.loggingService.warn('Login failed - invalid password', {
          service: 'AuthService',
          operation: 'login',
          correlationId,
          userId: user.id,
        }, {
          hasEmail: !!dto.email,
          loginMethod: 'password',
        });
        throw new UnauthorizedException('Invalid credentials');
      }

      const mfaRequired = user.mfaEnabled || this.readBooleanEnv('STAFF_MFA_REQUIRED', false);
      if (mfaRequired) {
        if (!user.mfaEnabled || !user.mfaSecretEncrypted) {
          throw new ForbiddenException('Staff MFA enrollment is required before login');
        }
        if (!dto.mfaCode || !this.staffMfa.verify(this.staffMfa.decrypt(user.mfaSecretEncrypted), dto.mfaCode)) {
          throw new UnauthorizedException('Valid MFA code is required');
        }
      }

      const { sessionToken, session } = await this.createSession(user.id, auditContext, 'password', mfaRequired);

      this.loggingService.info('Login successful', {
        service: 'AuthService',
        operation: 'login',
        correlationId,
        userId: user.id,
        hospitalId: user.hospitalId,
      }, {
        role: user.role,
        loginMethod: 'password',
      });

      return {
        sessionToken,
        session: {
          id: session.id,
          createdAt: session.createdAt.toISOString(),
          expiresAt: session.expiresAt?.toISOString() ?? null,
        },
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          hospitalId: user.hospitalId,
          hospital: {
            id: user.hospital.id,
            name: user.hospital.name,
            slug: user.hospital.slug,
          },
        },
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      await this.loggingService.error('Login error', {
        service: 'AuthService',
        operation: 'login',
        correlationId,
        userId: undefined,
      }, error instanceof Error ? error : undefined, {
        hasEmail: !!dto.email,
        loginMethod: 'password',
      });
      throw error;
    }
  }

  async loginWithSso(assertion: string, correlationId?: string, auditContext?: SessionAuditContext) {
    const verificationKey = process.env.SSO_JWT_PUBLIC_KEY?.replace(/\\n/g, '\n')
      || process.env.SSO_JWT_SECRET;
    if (!verificationKey) {
      throw new ForbiddenException('SSO is not configured');
    }
    const payload = verifyJwt(assertion, verificationKey, {
      algorithms: process.env.SSO_JWT_PUBLIC_KEY ? ['RS256', 'ES256'] : ['HS256'],
      issuer: process.env.SSO_JWT_ISSUER || undefined,
      audience: process.env.SSO_JWT_AUDIENCE || undefined,
    }) as JwtPayload;
    const issuer = String(payload.iss || '');
    const subject = String(payload.sub || '');
    const email = typeof payload.email === 'string' ? payload.email.toLowerCase() : null;
    if (!issuer || !subject) {
      throw new UnauthorizedException('SSO assertion is missing issuer or subject');
    }

    let user = await this.prisma.user.findUnique({
      where: { ssoIssuer_ssoSubject: { ssoIssuer: issuer, ssoSubject: subject } },
      include: { hospital: true },
    });
    if (!user && email && this.readBooleanEnv('SSO_ALLOW_EMAIL_LINK', false)) {
      user = await this.prisma.user.findUnique({ where: { email }, include: { hospital: true } });
      if (user) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: { ssoIssuer: issuer, ssoSubject: subject },
          include: { hospital: true },
        });
      }
    }
    if (!user) {
      throw new UnauthorizedException('SSO identity is not provisioned');
    }

    const { sessionToken, session } = await this.createSession(user.id, auditContext, 'sso', true);
    await this.loggingService.info('SSO login successful', {
      service: 'AuthService',
      operation: 'loginWithSso',
      correlationId,
      userId: user.id,
      hospitalId: user.hospitalId,
    });
    return {
      sessionToken,
      session: { id: session.id, createdAt: session.createdAt.toISOString(), expiresAt: session.expiresAt?.toISOString() ?? null },
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        hospitalId: user.hospitalId,
        hospital: user.hospital,
      },
    };
  }

  async beginMfaEnrollment(userId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (!user) throw new NotFoundException('Staff user not found');
    const secret = this.staffMfa.createSecret();
    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaSecretEncrypted: this.staffMfa.encrypt(secret), mfaEnabled: false },
    });
    return { secret, otpAuthUri: this.staffMfa.buildOtpAuthUri(user.email, secret) };
  }

  async enableMfa(userId: number, code: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { mfaSecretEncrypted: true },
    });
    if (!user?.mfaSecretEncrypted || !this.staffMfa.verify(this.staffMfa.decrypt(user.mfaSecretEncrypted), code)) {
      throw new UnauthorizedException('Invalid MFA code');
    }
    await this.prisma.user.update({ where: { id: userId }, data: { mfaEnabled: true } });
    return { ok: true };
  }

  async listSessions(userId: number) {
    return this.prisma.staffSession.findMany({
      where: { userId, revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        createdAt: true,
        expiresAt: true,
        lastSeenAt: true,
        createdIp: true,
        createdUserAgent: true,
        lastSeenIp: true,
        lastSeenUserAgent: true,
        authMethod: true,
        mfaVerifiedAt: true,
      },
    });
  }

  async revokeSession(userId: number, sessionId: number) {
    const result = await this.prisma.staffSession.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: 'revoked_by_user' },
    });
    if (result.count !== 1) throw new NotFoundException('Active session not found');
    return { ok: true };
  }

  async validateSessionToken(
    token: string,
    correlationId?: string,
    auditContext?: SessionAuditContext,
    options?: { touch?: boolean },
  ): Promise<StaffAuthUser> {
    this.loggingService.debug('Validating staff session token', {
      service: 'AuthService',
      operation: 'validateSessionToken',
      correlationId,
    });

    try {
      const tokenHash = this.hashSessionToken(token);
      const session = await this.prisma.staffSession.findUnique({
        where: { tokenHash },
        include: {
          user: {
            include: {
              hospital: true,
            },
          },
        },
      });

      if (!session || !session.user) {
        await this.loggingService.warn('Staff session validation failed - session not found', {
          service: 'AuthService',
          operation: 'validateSessionToken',
          correlationId,
        });
        throw new UnauthorizedException('Invalid staff session');
      }

      if (session.revokedAt) {
        await this.loggingService.warn('Staff session validation failed - session revoked', {
          service: 'AuthService',
          operation: 'validateSessionToken',
          correlationId,
          userId: session.user.id,
          hospitalId: session.user.hospitalId,
        }, {
          sessionId: session.id,
        });
        throw new UnauthorizedException('Staff session has been revoked');
      }

      if (session.expiresAt && session.expiresAt < new Date()) {
        await this.loggingService.warn('Staff session validation failed - session expired', {
          service: 'AuthService',
          operation: 'validateSessionToken',
          correlationId,
          userId: session.user.id,
          hospitalId: session.user.hospitalId,
        }, {
          sessionId: session.id,
        });
        throw new UnauthorizedException('Staff session has expired');
      }

      const idleTimeoutMs = this.readPositiveIntEnv('STAFF_SESSION_IDLE_TIMEOUT_MS', 30 * 60 * 1000);
      if (session.lastSeenAt && session.lastSeenAt.getTime() < Date.now() - idleTimeoutMs) {
        await this.prisma.staffSession.updateMany({
          where: { id: session.id, revokedAt: null },
          data: { revokedAt: new Date(), revokedReason: 'idle_timeout' },
        });
        throw new UnauthorizedException('Staff session expired due to inactivity');
      }

      const expectedDeviceIdHash = session.deviceIdHash;
      const receivedDeviceIdHash = auditContext?.deviceId ? this.hashSessionToken(auditContext.deviceId) : null;
      if (
        expectedDeviceIdHash
        && expectedDeviceIdHash !== receivedDeviceIdHash
        && this.readBooleanEnv('STAFF_DEVICE_BINDING_REQUIRED', (process.env.NODE_ENV || '') === 'production')
      ) {
        throw new UnauthorizedException('Staff session is not valid for this device');
      }

      if (options?.touch !== false && this.shouldTouchSession(session, auditContext)) {
        await this.prisma.staffSession.update({
          where: { id: session.id },
          data: {
            lastSeenAt: new Date(),
            lastSeenIp: this.normalizeAuditField(auditContext?.ipAddress),
            lastSeenUserAgent: this.normalizeAuditField(auditContext?.userAgent),
          },
        });
      }

      this.loggingService.debug('Staff session validated successfully', {
        service: 'AuthService',
        operation: 'validateSessionToken',
        correlationId,
        userId: session.user.id,
        hospitalId: session.user.hospitalId,
      }, {
        role: session.user.role,
        sessionId: session.id,
      });

      return {
        userId: session.user.id,
        email: session.user.email,
        role: session.user.role,
        hospitalId: session.user.hospitalId,
        sessionId: session.id,
        sessionExpiresAt: session.expiresAt?.toISOString() ?? null,
        hospital: {
          id: session.user.hospital.id,
          name: session.user.hospital.name,
          slug: session.user.hospital.slug,
        },
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      await this.loggingService.error('Staff session validation error', {
        service: 'AuthService',
        operation: 'validateSessionToken',
        correlationId,
      }, error instanceof Error ? error : undefined);
      throw error;
    }
  }

  async logout(
    token: string | null | undefined,
    correlationId?: string,
    reason = 'manual_logout',
  ): Promise<void> {
    if (!token) {
      return;
    }

    const tokenHash = this.hashSessionToken(token);
    const existing = await this.prisma.staffSession.findUnique({
      where: { tokenHash },
      include: {
        user: {
          select: {
            id: true,
            hospitalId: true,
          },
        },
      },
    });

    if (!existing || existing.revokedAt) {
      return;
    }

    await this.prisma.staffSession.update({
      where: { id: existing.id },
      data: {
        revokedAt: new Date(),
        revokedReason: reason,
      },
    });

    await this.loggingService.info('Staff session revoked', {
      service: 'AuthService',
      operation: 'logout',
      correlationId,
      userId: existing.user.id,
      hospitalId: existing.user.hospitalId,
    }, {
      sessionId: existing.id,
      reason,
    });
  }

  private generateSessionToken(): string {
    return randomBytes(32).toString('base64url');
  }

  private hashSessionToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private buildSessionExpiry(): Date {
    return new Date(Date.now() + STAFF_AUTH_TTL_MS);
  }

  private async createSession(
    userId: number,
    auditContext: SessionAuditContext | undefined,
    authMethod: string,
    mfaVerified: boolean,
  ) {
    const maxSessions = this.readPositiveIntEnv('STAFF_MAX_ACTIVE_SESSIONS', 5);
    const active = await this.prisma.staffSession.findMany({
      where: { userId, revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    if (active.length >= maxSessions) {
      await this.prisma.staffSession.updateMany({
        where: { id: { in: active.slice(maxSessions - 1).map((session) => session.id) } },
        data: { revokedAt: new Date(), revokedReason: 'active_session_limit' },
      });
    }

    const sessionToken = this.generateSessionToken();
    const session = await this.prisma.staffSession.create({
      data: {
        tokenHash: this.hashSessionToken(sessionToken),
        userId,
        expiresAt: this.buildSessionExpiry(),
        lastSeenAt: new Date(),
        createdIp: this.normalizeAuditField(auditContext?.ipAddress),
        createdUserAgent: this.normalizeAuditField(auditContext?.userAgent),
        lastSeenIp: this.normalizeAuditField(auditContext?.ipAddress),
        lastSeenUserAgent: this.normalizeAuditField(auditContext?.userAgent),
        deviceIdHash: auditContext?.deviceId ? this.hashSessionToken(auditContext.deviceId) : null,
        deviceFingerprintHash: this.hashDeviceFingerprint(auditContext),
        authMethod,
        mfaVerifiedAt: mfaVerified ? new Date() : null,
      },
    });
    return { sessionToken, session };
  }

  private hashDeviceFingerprint(auditContext?: SessionAuditContext): string | null {
    const value = `${auditContext?.ipAddress || ''}|${auditContext?.userAgent || ''}`;
    return value === '|' ? null : createHash('sha256').update(value).digest('hex');
  }

  private readPositiveIntEnv(name: string, fallback: number): number {
    const parsed = Number.parseInt(process.env[name] || '', 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }

  private readBooleanEnv(name: string, fallback: boolean): boolean {
    const value = process.env[name]?.trim().toLowerCase();
    if (!value) return fallback;
    return ['1', 'true', 'yes', 'on'].includes(value);
  }

  private shouldTouchSession(
    session: {
      lastSeenAt: Date | null;
      lastSeenIp: string | null;
      lastSeenUserAgent: string | null;
    },
    auditContext?: SessionAuditContext,
  ): boolean {
    const nextIp = this.normalizeAuditField(auditContext?.ipAddress);
    const nextUserAgent = this.normalizeAuditField(auditContext?.userAgent);

    if (!session.lastSeenAt) {
      return true;
    }

    if (Date.now() - session.lastSeenAt.getTime() >= STAFF_SESSION_ACTIVITY_TOUCH_MS) {
      return true;
    }

    return session.lastSeenIp !== nextIp || session.lastSeenUserAgent !== nextUserAgent;
  }

  private normalizeAuditField(value: string | null | undefined): string | null {
    if (!value) {
      return null;
    }

    const normalized = value.trim();
    if (!normalized) {
      return null;
    }

    return normalized.slice(0, 512);
  }
}
