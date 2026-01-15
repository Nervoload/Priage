import { Injectable } from '@nestjs/common';
import { Role, User } from '@prisma/client';
import bcrypt from 'bcrypt';

import { PrismaService } from '../prisma/prisma.service';

export interface CreateUserInput {
  email: string;
  password: string;
  role: Role;
  hospitalId: number;
}

export type UserSummary = Omit<User, 'passwordHash'>;

@Injectable()
export class UsersService {
  private readonly saltRounds = 12;

  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async createStaffUser(input: CreateUserInput): Promise<UserSummary> {
    const passwordHash = await bcrypt.hash(input.password, this.saltRounds);

    return this.prisma.user.create({
      data: {
        email: input.email,
        passwordHash,
        role: input.role,
        hospitalId: input.hospitalId,
      },
      select: {
        id: true,
        email: true,
        role: true,
        hospitalId: true,
        createdAt: true,
      },
    });
  }
}
