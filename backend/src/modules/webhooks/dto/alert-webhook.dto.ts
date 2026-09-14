import { AlertSeverity, WebhookSubscriptionStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString, IsUrl, Length, MaxLength } from 'class-validator';

export class CreateAlertWebhookDto {
  @IsString()
  @Length(1, 100)
  name!: string;

  @IsUrl({ require_protocol: true, protocols: ['https', 'http'] })
  @MaxLength(2048)
  targetUrl!: string;

  @IsOptional()
  @IsEnum(AlertSeverity)
  minimumSeverity?: AlertSeverity;
}

export class UpdateAlertWebhookDto {
  @IsOptional()
  @IsString()
  @Length(1, 100)
  name?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true, protocols: ['https', 'http'] })
  @MaxLength(2048)
  targetUrl?: string;

  @IsOptional()
  @IsEnum(AlertSeverity)
  minimumSeverity?: AlertSeverity;

  @IsOptional()
  @IsEnum(WebhookSubscriptionStatus)
  status?: WebhookSubscriptionStatus;
}

export class CreateEscalationExceptionDto {
  @IsString()
  @Length(10, 500)
  reason!: string;

  @IsDateString()
  expiresAt!: string;
}
