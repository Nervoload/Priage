import { IsIn, IsObject, IsOptional } from 'class-validator';

import { DEMO_EVENT_TYPES, type DemoEventType } from '../demo-sessions.constants';

export class CreateDemoEventDto {
  @IsIn(DEMO_EVENT_TYPES)
  type!: DemoEventType;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
