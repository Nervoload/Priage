import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcrypt';

import { AppConfigService } from '../config/config.service';
import { UsersService } from '../users/users.service';
import { Role, User } from '@prisma/client';

export interface JwtPayload {
  userId: number;
  hospitalId: number;
  role: Role;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: AuthenticatedUserSummary;
}

export interface AuthenticatedUserSummary extends JwtPayload {
  email: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: AppConfigService,
  ) {}

  async validateUser(email: string, password: string): Promise<User> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return user;
  }

  async login(user: User): Promise<AuthTokens> {
    const payload: JwtPayload = {
      userId: user.id,
      hospitalId: user.hospitalId,
      role: user.role,
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.getJwtAccessSecret(),
      expiresIn: this.configService.getJwtAccessTtl(),
    });

    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.getJwtRefreshSecret(),
      expiresIn: this.configService.getJwtRefreshTtl(),
    });

    return {
      accessToken,
      refreshToken,
      user: {
        userId: user.id,
        hospitalId: user.hospitalId,
        role: user.role,
        email: user.email,
      },
    };
  }
}
