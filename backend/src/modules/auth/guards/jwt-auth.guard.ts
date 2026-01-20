// backend/src/modules/auth/guards/jwt-auth.guard.ts
// JWT authentication guard
// Protects routes requiring authenticated users

import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
