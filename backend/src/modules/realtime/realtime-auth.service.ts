import { Injectable, UnauthorizedException } from '@nestjs/common';
import jwt from 'jsonwebtoken';

import { PrismaService } from '../prisma/prisma.service';

export type TrustedRealtimeUser = {
  userId: number;
  hospitalId: number;
  role: string;
};

type StaffSocketClaims = {
  userId: number;
  hospitalId: number;
  role?: string;
};

@Injectable()
export class RealtimeAuthService {
  constructor(private readonly prisma: PrismaService) {}

  async validateStaffToken(token: string): Promise<TrustedRealtimeUser> {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new UnauthorizedException('JWT_SECRET environment variable is required');
    }

    let claims: StaffSocketClaims;
    try {
      claims = jwt.verify(token, secret) as StaffSocketClaims;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }

    if (!claims?.userId || !claims?.hospitalId) {
      throw new UnauthorizedException('Invalid token claims');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: claims.userId },
      select: { id: true, hospitalId: true, role: true },
    });

    if (!user || user.hospitalId !== claims.hospitalId) {
      throw new UnauthorizedException('Token does not match current user state');
    }

    return {
      userId: user.id,
      hospitalId: user.hospitalId,
      role: user.role,
    };
  }
}
