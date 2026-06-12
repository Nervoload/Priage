// backend/src/modules/users/users.service.ts
// Hospital staff management service

import { BadRequestException, ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

import { LoggingService } from '../logging/logging.service';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';

type UserWithHospital = {
  id: number;
  email: string;
  role: Role;
  hospitalId: number;
  password?: string;
  hospital: {
    id: number;
    name: string;
    slug: string;
  };
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

    const where: any = { hospitalId };
    if (role) {
      where.role = role;
    }

    const users = await this.prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        hospitalId: true,
        // Don't return password
      },
      orderBy: { createdAt: 'desc' },
    });

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

  async getUser(id: number, correlationId?: string) {
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
        role: true,
        createdAt: true,
        hospitalId: true,
        hospital: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
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
      hospitalId: user.hospitalId,
    }, {
      role: user.role,
    });

    return user;
  }

  async updateProfile(
    userId: number,
    dto: UpdateUserProfileDto,
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
        hospital: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    if (!existing) {
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
          hospital: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
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
      hospitalId: updated.hospitalId,
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
    
    const users = await this.prisma.user.findMany({
      where: { hospitalId },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
      },
      orderBy: { role: 'asc' },
    });

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

  private toAuthUser(user: UserWithHospital) {
    return {
      userId: user.id,
      email: user.email,
      role: user.role,
      hospitalId: user.hospitalId,
      hospital: {
        id: user.hospital.id,
        name: user.hospital.name,
        slug: user.hospital.slug,
      },
    };
  }
}
