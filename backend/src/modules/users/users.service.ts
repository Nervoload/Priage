// backend/src/modules/users/users.service.ts
// Hospital staff management service

import { Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';

import { LoggingService } from '../logging/logging.service';
import { PrismaService } from '../prisma/prisma.service';

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
      this.loggingService.warn('User not found', {
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
}
