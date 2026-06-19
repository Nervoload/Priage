import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

const CLIENT_EVENT_APPS = ['hospital', 'patient'] as const;
const CLIENT_EVENT_TYPES = ['api_failure', 'fallback_generation'] as const;

export class ClientEventDto {
  @IsIn(CLIENT_EVENT_APPS)
  app!: (typeof CLIENT_EVENT_APPS)[number];

  @IsIn(CLIENT_EVENT_TYPES)
  eventType!: (typeof CLIENT_EVENT_TYPES)[number];

  @IsString()
  @MaxLength(120)
  source!: string;

  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(599)
  status?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(86_400)
  retryAfterSeconds?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  reason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  message?: string;
}
