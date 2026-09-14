// backend/src/modules/users/users.service.ts
// Hospital staff management service

import { BadRequestException, ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

import { LoggingService } from '../logging/logging.service';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';
import { UpdateMembershipDto } from './dto/update-membership.dto';

type UserWithMembership = {
  id: number;
  email: string;
  password?: string;
  hospitalMemberships: Array<{
    id: number;
    role: Role;
    hospitalId: number;
    hospital: { id: number; name: string; slug: string };
  }>;
};

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly loggingService: LoggingService,
  ) {}

  async getUsers(hospitalId: number, role?: Role, correlationId?: string) {
    this.loggingService.debug('Fetching hospital users', {
      service: 'UsersService',
      operation: 'getUsers',
      correlationId,
      hospitalId,
    }, {
      roleFilter: role,
    });

    const memberships = await this.prisma.hospitalMembership.findMany({
      where: { hospitalId, isActive: true, ...(role ? { role } : {}) },
      select: {
        id: true,
        role: true,
        createdAt: true,
        hospitalId: true,
        user: { select: { id: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    const users = memberships.map((membership) => ({
      id: membership.user.id,
      membershipId: membership.id,
      email: membership.user.email,
      role: membership.role,
      createdAt: membership.createdAt,
      hospitalId: membership.hospitalId,
    }));

    this.loggingService.debug('Hospital users fetched', {
      service: 'UsersService',
      operation: 'getUsers',
      correlationId,
      hospitalId,
    }, {
      userCount: users.length,
      roleFilter: role,
    });

    return users;
  }

  async getUser(id: number, hospitalId: number, correlationId?: string) {
    this.loggingService.debug('Fetching user by ID', {
      service: 'UsersService',
      operation: 'getUser',
      correlationId,
      userId: id,
    });
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        createdAt: true,
        hospitalMemberships: {
          where: { hospitalId, isActive: true },
          include: { hospital: true },
        },
      },
    });

    if (!user) {
      await this.loggingService.warn('User not found', {
        service: 'UsersService',
        operation: 'getUser',
        correlationId,
        userId: id,
      });
      throw new NotFoundException(`User ${id} not found`);
    }

    this.loggingService.debug('User fetched successfully', {
      service: 'UsersService',
      operation: 'getUser',
      correlationId,
      userId: id,
      hospitalId,
    }, {
      role: user.hospitalMemberships[0]?.role,
    });

    return this.toAuthUser(user);
  }

  async updateProfile(
    userId: number,
    dto: UpdateUserProfileDto,
    hospitalId: number,
    membershipId: number,
    correlationId?: string,
    currentSessionId?: number,
  ) {
    this.loggingService.info('Updating staff profile', {
      service: 'UsersService',
      operation: 'updateProfile',
      correlationId,
      userId,
    }, {
      isEmailChange: typeof dto.email === 'string',
      isPasswordChange: typeof dto.newPassword === 'string' && dto.newPassword.length > 0,
    });

    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        hospitalMemberships: {
          where: { id: membershipId, hospitalId, isActive: true },
          include: { hospital: true },
        },
      },
    });

    if (!existing || existing.hospitalMemberships.length !== 1) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    const updates: { email?: string; password?: string } = {};

    if (dto.email && dto.email !== existing.email) {
      const emailOwner = await this.prisma.user.findUnique({
        where: { email: dto.email },
        select: { id: true },
      });

      if (emailOwner && emailOwner.id !== userId) {
        throw new ConflictException('That email address is already in use');
      }

      updates.email = dto.email;
    }

    if (dto.newPassword) {
      if (!dto.currentPassword) {
        throw new BadRequestException('Current password is required to change your password');
      }

      const isPasswordValid = await bcrypt.compare(dto.currentPassword, existing.password);
      if (!isPasswordValid) {
        throw new UnauthorizedException('Current password is incorrect');
      }

      updates.password = await bcrypt.hash(dto.newPassword, 10);
    }

    if (Object.keys(updates).length === 0) {
      return this.toAuthUser(existing);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const savedUser = await tx.user.update({
        where: { id: userId },
        data: updates,
        include: {
          hospitalMemberships: {
            where: { id: membershipId, hospitalId, isActive: true },
            include: { hospital: true },
          },
        },
      });

      if (typeof updates.password === 'string') {
        await tx.staffSession.updateMany({
          where: {
            userId,
            revokedAt: null,
            ...(currentSessionId ? { id: { not: currentSessionId } } : {}),
          },
          data: {
            revokedAt: new Date(),
            revokedReason: 'password_changed',
          },
        });
      }

      return savedUser;
    });

    this.loggingService.info('Staff profile updated', {
      service: 'UsersService',
      operation: 'updateProfile',
      correlationId,
      userId,
      hospitalId,
    }, {
      isEmailChange: typeof updates.email === 'string',
      isPasswordChange: typeof updates.password === 'string',
    });

    return this.toAuthUser(updated);
  }

  // Phase 6.4: Add an updateProfile method here:
  //   async updateProfile(userId: number, dto: { displayName?, avatarUrl?, phone?, department?, specialization? })
  // The current getUser select list (id, email, role, createdAt, hospitalId) will
  // need to expand to include new profile fields once the Prisma schema is updated.
  // Consider a DynamoDB table for unstructured profile data (avatar, preferences)
  // or adding columns to the existing User model for structured fields.

  async getUsersByHospital(hospitalId: number, correlationId?: string) {
    this.loggingService.debug('Fetching users by hospital', {
      service: 'UsersService',
      operation: 'getUsersByHospital',
      correlationId,
      hospitalId,
    });
    
    const memberships = await this.prisma.hospitalMembership.findMany({
      where: { hospitalId, isActive: true },
      select: {
        id: true,
        role: true,
        createdAt: true,
        hospitalId: true,
        user: { select: { id: true, email: true } },
      },
      orderBy: { role: 'asc' },
    });
    const users = memberships.map((membership) => ({
      id: membership.user.id,
      membershipId: membership.id,
      email: membership.user.email,
      role: membership.role,
      createdAt: membership.createdAt,
      hospitalId: membership.hospitalId,
    }));

    this.loggingService.debug('Users by hospital fetched', {
      service: 'UsersService',
      operation: 'getUsersByHospital',
      correlationId,
      hospitalId,
    }, {
      userCount: users.length,
    });

    return users;
  }

  async updateMembership(
    hospitalId: number,
    membershipId: number,
    dto: UpdateMembershipDto,
    actorUserId: number,
    correlationId?: string,
  ) {
    if (dto.role === Role.ADMIN) {
      throw new BadRequestException('Legacy ADMIN cannot be assigned to a membership');
    }
    const existing = await this.prisma.hospitalMembership.findFirst({
      where: { id: membershipId, hospitalId },
    });
    if (!existing) throw new NotFoundException('Hospital membership not found');
    const roleChanged = dto.role !== undefined && dto.role !== existing.role;
    const activeChanged = dto.isActive !== undefined && dto.isActive !== existing.isActive;
    if (!roleChanged && !activeChanged) return existing;

    const updated = await this.prisma.$transaction(async (tx) => {
      const membership = await tx.hospitalMembership.update({
        where: { id: existing.id },
        data: {
          role: dto.role,
          isActive: dto.isActive,
          disabledAt: dto.isActive === false ? new Date() : dto.isActive === true ? null : undefined,
        },
      });
      await tx.staffSession.updateMany({
        where: { membershipId: existing.id, revokedAt: null },
        data: {
          revokedAt: new Date(),
          revokedReason: roleChanged ? 'membership_role_changed' : 'membership_status_changed',
        },
      });
      return membership;
    });
    await this.loggingService.info('Hospital membership updated and active sessions revoked', {
      service: 'UsersService',
      operation: 'updateMembership',
      correlationId,
      hospitalId,
      userId: actorUserId,
    }, {
      membershipId,
      previousRole: existing.role,
      role: updated.role,
      isActive: updated.isActive,
    });
    return updated;
  }

  private toAuthUser(user: UserWithMembership) {
    const membership = user.hospitalMemberships[0];
    if (!membership) throw new NotFoundException('Active hospital membership not found');
    return {
      userId: user.id,
      email: user.email,
      role: membership.role,
      membershipId: membership.id,
      hospitalId: membership.hospitalId,
      hospital: {
        id: membership.hospital.id,
        name: membership.hospital.name,
        slug: membership.hospital.slug,
      },
    };
  }
}
