import {
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { DemoSession, Prisma } from '@prisma/client';
import type { Request } from 'express';

import { readCookie } from '../../common/http/auth-cookie.util';
import { isLegacyCompatibilityEnabled, legacyCompatibilityExpiry } from '../../common/config/legacy-compatibility';
import { AuthService } from '../auth/auth.service';
import { LoggingService } from '../logging/logging.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  DEMO_COOKIE_NAME,
  DEMO_EVENT_TYPES,
  DEMO_SESSION_STATUSES,
  readBooleanEnv,
  readPositiveIntegerEnv,
  type DemoEventType,
} from './demo-sessions.constants';
import { DemoEmailService } from './demo-email.service';
import { getDemoProfile } from './demo-profile';
import { DemoTokenService } from './demo-token.service';
import { RequestDemoDto } from './dto/request-demo.dto';
import { VerifyDemoCodeDto } from './dto/verify-demo-code.dto';

type DemoAuditContext = {
  ipAddress?: string | null;
  userAgent?: string | null;
  deviceId?: string | null;
};

const DEMO_CODE_TTL_MS = 30 * 60 * 1000;
const DEMO_ACCESS_TTL_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class DemoSessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: DemoTokenService,
    private readonly email: DemoEmailService,
    private readonly auth: AuthService,
    private readonly loggingService: LoggingService,
  ) {}

  isDemoGateRequired(): boolean {
    // A configured but no-longer-authorized legacy code must fail closed. Do
    // not let a missing migration flag accidentally turn a protected demo
    // deployment into an open deployment.
    return Boolean(process.env.DEMO_ACCESS_CODE?.trim()) || readBooleanEnv('DEMO_SESSIONS_REQUIRED', false);
  }

  isLegacyCodeCookieValid(cookieHeader: string | string[] | undefined): boolean {
    const expected = this.getLegacyCode();
    if (!expected) return false;
    return readCookie(cookieHeader, DEMO_COOKIE_NAME) === expected;
  }

  recordLegacyCodeUse(): void {
    void this.loggingService.warn('Legacy demo access code accepted', {
      service: 'DemoSessionsService',
      operation: 'recordLegacyCodeUse',
    }, {
      type: 'legacy_demo_static_access_code',
      compatibilityUntil: legacyCompatibilityExpiry('demo_static_access_code') || 'unknown',
    }).catch(() => undefined);
  }

  async isDemoAccessAllowed(cookieHeader: string | string[] | undefined): Promise<boolean> {
    if (!this.isDemoGateRequired()) return true;
    if (this.isLegacyCodeCookieValid(cookieHeader)) return true;
    return Boolean(await this.getActiveSessionFromCookieHeader(cookieHeader));
  }

  async requestDemo(dto: RequestDemoDto): Promise<{ ok: true }> {
    const code = this.tokens.generateCode();
    const expiresAt = new Date(Date.now() + readPositiveIntegerEnv('DEMO_SESSION_CODE_TTL_MS', DEMO_CODE_TTL_MS));

    await this.prisma.demoSession.updateMany({
      where: {
        email: dto.email,
        profileId: getDemoProfile('default-hospital-demo').id,
        status: DEMO_SESSION_STATUSES.PENDING,
        expiresAt: { gt: new Date() },
      },
      data: {
        status: DEMO_SESSION_STATUSES.SUPERSEDED,
        revokedAt: new Date(),
      },
    });

    const session = await this.prisma.demoSession.create({
      data: {
        email: dto.email,
        organization: this.optionalString(dto.organization),
        role: this.optionalString(dto.role),
        organizationType: this.optionalString(dto.organizationType),
        interest: this.optionalString(dto.interest),
        profileId: getDemoProfile('default-hospital-demo').id,
        codeHash: this.tokens.hashSecret(code),
        expiresAt,
      },
    });

    await this.recordEventForSession(session.id, 'demo_requested', {
      organization: dto.organization ?? null,
      role: dto.role ?? null,
      organizationType: dto.organizationType ?? null,
      hasInterest: Boolean(dto.interest),
    });

    await this.email.sendDemoCode({
      email: dto.email,
      code,
      organization: dto.organization,
      expiresAt,
    }).catch((error) => {
      console.error('[DemoSessionsService] Failed to deliver demo code:', error);
    });

    return { ok: true };
  }

  async verifyDemo(dto: VerifyDemoCodeDto) {
    const session = await this.prisma.demoSession.findFirst({
      where: {
        email: dto.email,
        status: DEMO_SESSION_STATUSES.PENDING,
        expiresAt: { gt: new Date() },
        revokedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!session || !this.tokens.matches(dto.code.trim(), session.codeHash)) {
      throw new ForbiddenException('Invalid or expired demo code');
    }

    const accessToken = this.tokens.generateAccessToken();
    const verified = await this.prisma.demoSession.update({
      where: { id: session.id },
      data: {
        accessTokenHash: this.tokens.hashSecret(accessToken),
        status: DEMO_SESSION_STATUSES.VERIFIED,
        verifiedAt: new Date(),
        lastSeenAt: new Date(),
        expiresAt: new Date(Date.now() + readPositiveIntegerEnv('DEMO_SESSION_TTL_MS', DEMO_ACCESS_TTL_MS)),
      },
    });

    await this.recordEventForSession(verified.id, 'demo_verified');

    return {
      accessToken,
      maxAgeMs: verified.expiresAt.getTime() - Date.now(),
      profile: this.buildProfileResponse(verified),
    };
  }

  async getCurrentProfile(cookieHeader: string | string[] | undefined) {
    const session = await this.getActiveSessionFromCookieHeader(cookieHeader);
    if (!session) {
      return { isDemo: false as const };
    }
    return this.buildProfileResponse(session);
  }

  async enterHospital(cookieHeader: string | string[] | undefined, auditContext: DemoAuditContext) {
    const session = await this.requireActiveSession(cookieHeader);
    const hospitalSlug = (process.env.DEMO_HOSPITAL_SLUG || 'demo-hospital').trim().toLowerCase();
    const email =
      process.env.DEMO_STAFF_EMAIL?.trim().toLowerCase() ||
      `demo.admin+${hospitalSlug}@priage.local`;
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (!user) {
      throw new ServiceUnavailableException(`Demo staff user ${email} is not configured`);
    }

    const result = await this.auth.createDemoStaffSession(user.id, auditContext);
    await this.recordEventForSession(session.id, 'demo_opened', {
      app: 'hospital',
      staffUserId: user.id,
    });
    return result;
  }

  async recordEvent(cookieHeader: string | string[] | undefined, type: DemoEventType, metadata?: Record<string, unknown>) {
    const session = await this.requireActiveSession(cookieHeader);
    await this.recordEventForSession(session.id, type, metadata);
    return { ok: true };
  }

  async revokeCurrentSession(cookieHeader: string | string[] | undefined): Promise<void> {
    const cookie = readCookie(cookieHeader, DEMO_COOKIE_NAME);
    if (!cookie || this.isLegacyCodeCookieValid(cookieHeader)) return;
    await this.prisma.demoSession.updateMany({
      where: {
        accessTokenHash: this.tokens.hashSecret(cookie),
        revokedAt: null,
      },
      data: {
        status: DEMO_SESSION_STATUSES.REVOKED,
        revokedAt: new Date(),
      },
    });
  }

  async getActiveSessionFromCookieHeader(cookieHeader: string | string[] | undefined): Promise<DemoSession | null> {
    const cookie = readCookie(cookieHeader, DEMO_COOKIE_NAME);
    if (!cookie || this.isLegacyCodeCookieValid(cookieHeader)) return null;

    const session = await this.prisma.demoSession.findFirst({
      where: {
        accessTokenHash: this.tokens.hashSecret(cookie),
        status: DEMO_SESSION_STATUSES.VERIFIED,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (!session) return null;

    return this.prisma.demoSession.update({
      where: { id: session.id },
      data: { lastSeenAt: new Date() },
    });
  }

  assertDemoCapabilityAllowed(request: Request, session: DemoSession | null): void {
    if (!session) return;
    const method = (request.method || 'GET').toUpperCase();
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return;

    const path = this.requestPath(request);
    const blockedCapability = this.blockedCapabilityForPath(path);
    if (!blockedCapability) return;

    throw new ForbiddenException(`Demo capability disabled: ${blockedCapability}`);
  }

  private async requireActiveSession(cookieHeader: string | string[] | undefined): Promise<DemoSession> {
    const session = await this.getActiveSessionFromCookieHeader(cookieHeader);
    if (!session) {
      throw new ForbiddenException('Demo access required');
    }
    return session;
  }

  private async recordEventForSession(
    sessionId: string,
    type: DemoEventType,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    if (!DEMO_EVENT_TYPES.includes(type)) return;
    const sanitizedMetadata = this.sanitizeMetadata(metadata);
    await this.prisma.demoEvent.create({
      data: {
        sessionId,
        type,
        metadata: sanitizedMetadata,
      },
    });
  }

  private buildProfileResponse(session: DemoSession) {
    const profile = getDemoProfile(session.profileId);
    return {
      isDemo: true as const,
      profileId: profile.id,
      label: profile.label,
      expiresAt: session.expiresAt.toISOString(),
      apps: profile.apps,
      hospitalViews: [...profile.hospitalViews],
      defaultTourId: profile.defaultTourId,
      scenarioPack: profile.scenarioPack,
      watermark: profile.watermark,
      disabledCapabilities: [...profile.disabledCapabilities],
    };
  }

  private sanitizeMetadata(metadata?: Record<string, unknown>): Prisma.InputJsonValue | undefined {
    if (!metadata) return undefined;
    const serialized = JSON.stringify(metadata);
    if (serialized.length > 4000) {
      return { truncated: true };
    }
    return JSON.parse(serialized) as Prisma.InputJsonValue;
  }

  private optionalString(value: string | undefined): string | undefined {
    const trimmed = value?.trim();
    return trimmed || undefined;
  }

  private getLegacyCode(): string | undefined {
    if (!isLegacyCompatibilityEnabled('demo_static_access_code')) return undefined;
    return process.env.DEMO_ACCESS_CODE?.trim() || undefined;
  }

  private requestPath(request: Request): string {
    return (request.path || request.url || '').split('?')[0] || '/';
  }

  private blockedCapabilityForPath(path: string): string | null {
    if (path.startsWith('/platform/')) return 'realIntegrations';
    if (path.startsWith('/assets') || path.startsWith('/patient/assets')) return 'unsafeUploads';
    if (/^\/hospitals\/\d+(?:\/config)?$/.test(path)) return 'hospitalConfigMutation';
    if (path.startsWith('/users')) return 'hospitalConfigMutation';
    if (path.startsWith('/auth/mfa') || path.startsWith('/auth/sessions')) return 'hospitalConfigMutation';
    return null;
  }
}
