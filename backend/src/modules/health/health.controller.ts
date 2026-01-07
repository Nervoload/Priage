// backend/src/modules/health/health.controller.ts
// health.controller.ts
// Written by: John Surette
// Date Created: Jan 6 2026
// Last Edited: Jan 6 2026
// Basic health endpoint: GET /health -> { ok: true }

import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  getHealth(): { ok: true } {
    return { ok: true };
  }
}
