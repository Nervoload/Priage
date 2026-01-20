// backend/src/modules/auth/auth.service.ts
// John Surette
// Dec 8, 2025
// auth.service.ts
// Checks user creds against Prisma-Postgres DB
// issue JWT token with role + hospitalId
// injected into auth.controller.ts

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';

export interface JwtPayload {
  userId: number;
  email: string;
  role: string;
  hospitalId: number;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { hospital: true },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Compare hashed password
    const isPasswordValid = await bcrypt.compare(dto.password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload: JwtPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      hospitalId: user.hospitalId,
    };

    const access_token = this.jwtService.sign(payload);

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
  }

  async validateUser(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.userId },
      include: { hospital: true },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return {
      userId: user.id,
      email: user.email,
      role: user.role,
      hospitalId: user.hospitalId,
      hospital: user.hospital,
    };
  }
}