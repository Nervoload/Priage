import { Role } from '@prisma/client';
import { UnauthorizedException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { AuthService, selectMembershipForLogin } from '../src/modules/auth/auth.service';
import { UsersService } from '../src/modules/users/users.service';

const hospitals = [
  { id: 1, name: 'North', slug: 'north' },
  { id: 2, name: 'South', slug: 'south' },
];
const memberships = [
  { id: 10, hospitalId: 1, role: Role.DOCTOR, hospital: hospitals[0]! },
  { id: 20, hospitalId: 2, role: Role.CLINICAL_ADMIN, hospital: hospitals[1]! },
];

describe('staff membership selection', () => {
  it('selects the requested clinic for one global identity with two memberships', () => {
    expect(selectMembershipForLogin(memberships, 'SOUTH')).toMatchObject({ id: 20, hospitalId: 2 });
  });

  it('denies an incorrect clinic without exposing available memberships', () => {
    expect(selectMembershipForLogin(memberships, 'unknown')).toBeNull();
  });

  it('accepts an omitted clinic only for the one-membership compatibility release', () => {
    expect(selectMembershipForLogin([memberships[0]!])).toEqual(memberships[0]);
    expect(selectMembershipForLogin(memberships)).toBeNull();
  });
});

describe('membership-scoped sessions', () => {
  it('returns role and tenant from the session membership rather than legacy User fields', async () => {
    const prisma = {
      staffSession: {
        findUnique: vi.fn().mockResolvedValue({
          id: 7,
          user: { id: 4, email: 'clinician@example.ca' },
          membership: {
            ...memberships[1],
            isActive: true,
            disabledAt: null,
          },
          revokedAt: null,
          expiresAt: new Date(Date.now() + 60_000),
          lastSeenAt: new Date(),
          deviceIdHash: null,
          lastSeenIp: null,
          lastSeenUserAgent: null,
        }),
      },
    };
    const logging = { debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() };
    const service = new AuthService(prisma as never, logging as never, {} as never);
    await expect(service.validateSessionToken('token', undefined, undefined, { touch: false })).resolves.toMatchObject({
      userId: 4,
      membershipId: 20,
      hospitalId: 2,
      role: Role.CLINICAL_ADMIN,
    });
  });

  it('revokes and denies a disabled membership', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const prisma = {
      staffSession: {
        findUnique: vi.fn().mockResolvedValue({
          id: 7,
          user: { id: 4, email: 'clinician@example.ca' },
          membership: { ...memberships[0], isActive: false, disabledAt: new Date() },
          revokedAt: null,
        }),
        updateMany,
      },
    };
    const logging = { debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() };
    const service = new AuthService(prisma as never, logging as never, {} as never);
    await expect(service.validateSessionToken('token', undefined, undefined, { touch: false }))
      .rejects.toBeInstanceOf(UnauthorizedException);
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ revokedReason: 'membership_disabled' }),
    }));
  });
});

describe('membership administration', () => {
  it('revokes active sessions whenever a membership role changes', async () => {
    const sessionUpdate = vi.fn().mockResolvedValue({ count: 2 });
    const membershipUpdate = vi.fn().mockResolvedValue({
      id: 10,
      hospitalId: 1,
      role: Role.NURSE,
      isActive: true,
    });
    const prisma = {
      hospitalMembership: {
        findFirst: vi.fn().mockResolvedValue({ id: 10, hospitalId: 1, role: Role.DOCTOR, isActive: true }),
      },
      $transaction: vi.fn(async (callback: (tx: unknown) => unknown) => callback({
        hospitalMembership: { update: membershipUpdate },
        staffSession: { updateMany: sessionUpdate },
      })),
    };
    const logging = { info: vi.fn() };
    const service = new UsersService(prisma as never, logging as never);
    await service.updateMembership(1, 10, { role: Role.NURSE }, 99);
    expect(sessionUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { membershipId: 10, revokedAt: null },
      data: expect.objectContaining({ revokedReason: 'membership_role_changed' }),
    }));
  });
});
