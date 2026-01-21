// backend/src/modules/auth/auth.service.ts
// John Surette
// Dec 8, 2025
// auth.service.ts
// Checks user creds against Prisma-Postgres DB
// issue JWT token with role + hospitalId
// injected into auth.controller.ts

import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

import { PrismaService } from '../prisma/prisma.service';
import { LoggingService } from '../logging/logging.service';
import { LoginDto } from './dto/login.dto';

export interface JwtPayload {
  userId: number;
  email: string;
  role: string;
  hospitalId: number;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly loggingService: LoggingService,
  ) {
    this.logger.log('AuthService initialized');
  }

  async login(dto: LoginDto, correlationId?: string) {
    await this.loggingService.info('Login attempt', {
      service: 'AuthService',
      operation: 'login',
      correlationId,
      userId: undefined,
    }, { email: dto.email });

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
        }, { email: dto.email });
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
        }, { email: dto.email });
        throw new UnauthorizedException('Invalid credentials');
      }

      const payload: JwtPayload = {
        userId: user.id,
        email: user.email,
        role: user.role,
        hospitalId: user.hospitalId,
      };

      const access_token = this.jwtService.sign(payload);

      await this.loggingService.info('Login successful', {
        service: 'AuthService',
        operation: 'login',
        correlationId,
        userId: user.id,
        hospitalId: user.hospitalId,
      }, { email: user.email, role: user.role });

      return {
        access_token,
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
        email: dto.email,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async validateUser(payload: JwtPayload, correlationId?: string) {
    await this.loggingService.debug('Validating JWT token', {
      service: 'AuthService',
      operation: 'validateUser',
      correlationId,
      userId: payload.userId,
    }, { email: payload.email });

    try {
      const user = await this.prisma.user.findUnique({
        where: { id: payload.userId },
        include: { hospital: true },
      });

      if (!user) {
        await this.loggingService.warn('JWT validation failed - user not found', {
          service: 'AuthService',
          operation: 'validateUser',
          correlationId,
          userId: payload.userId,
        }, { email: payload.email });
        throw new UnauthorizedException('User not found');
      }

      await this.loggingService.debug('JWT validated successfully', {
        service: 'AuthService',
        operation: 'validateUser',
        correlationId,
        userId: user.id,
        hospitalId: user.hospitalId,
      }, { email: user.email, role: user.role });

      return {
        userId: user.id,
        email: user.email,
        role: user.role,
        hospitalId: user.hospitalId,
        hospital: user.hospital,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      await this.loggingService.error('JWT validation error', {
        service: 'AuthService',
        operation: 'validateUser',
        correlationId,
        userId: payload.userId,
      }, error instanceof Error ? error : undefined, {
        email: payload.email,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}