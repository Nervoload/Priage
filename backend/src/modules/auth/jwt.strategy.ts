// backend/src/modules/auth/jwt.straegy.ts
// John Surette
// Dec 8, 2025
// jwt.strategy.ts
// implements NestJS's passport JWT strategy
// used by guards/jwt/jwt-auth.guard.ts and roles/guard.ts 
// JwtAuthGuard checks request jhas valid JWT, attaches req.user
// RolesGuard cheks req.user.role is allowed at endpoint
//