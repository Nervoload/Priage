// backend/src/modules/auth/auth.service.ts
// John Surette
// Dec 8, 2025
// auth.service.ts
// Checks user creds against Prisma-Postgres DB
// creates revocable staff sessions with audit metadata
// injected into auth.controller.ts

import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';

import { PrismaService } from '../prisma/prisma.service';
import { LoggingService } from '../logging/logging.service';
import { STAFF_AUTH_TTL_MS } from '../../common/http/auth-cookie.util';
import { LoginDto } from './dto/login.dto';

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
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly loggingService: LoggingService,
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

      const sessionToken = this.generateSessionToken();
      const expiresAt = this.buildSessionExpiry();
      const session = await this.prisma.staffSession.create({
        data: {
          tokenHash: this.hashSessionToken(sessionToken),
          userId: user.id,
          expiresAt,
          lastSeenAt: new Date(),
          createdIp: this.normalizeAuditField(auditContext?.ipAddress),
          createdUserAgent: this.normalizeAuditField(auditContext?.userAgent),
          lastSeenIp: this.normalizeAuditField(auditContext?.ipAddress),
          lastSeenUserAgent: this.normalizeAuditField(auditContext?.userAgent),
        },
      });

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
