import { Body, Controller, Headers, Post, Req } from '@nestjs/common';
import type { Request } from 'express';

import { SkipDemoGate } from '../../common/decorators/skip-demo-gate.decorator';
import { ClientEventDto } from './dto/client-event.dto';
import { LoggingService } from './logging.service';

@SkipDemoGate()
@Controller('logging/client-events')
export class ClientEventsController {
  constructor(private readonly loggingService: LoggingService) {}

  @Post()
  async create(
    @Body() dto: ClientEventDto,
    @Req() req: Request & { correlationId?: string },
    @Headers('user-agent') userAgent?: string,
  ) {
    await this.loggingService.warn(
      'Client reported degraded API behavior',
      {
        correlationId: req.correlationId,
        service: 'ClientEvents',
        operation: dto.eventType,
      },
      {
        app: dto.app,
        eventType: dto.eventType,
        source: dto.source,
        status: dto.status ?? 0,
        retryAfterSeconds: dto.retryAfterSeconds ?? 0,
        reason: dto.reason ?? 'unspecified',
        message: dto.message ?? '',
        userAgent: this.truncate(userAgent, 120),
      },
    );

    return { ok: true };
  }

  private truncate(value: string | undefined, maxLength: number): string {
    const text = (value ?? '').trim();
    return text.length <= maxLength ? text : text.slice(0, maxLength);
  }
}
