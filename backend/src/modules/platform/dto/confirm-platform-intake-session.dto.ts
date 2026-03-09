import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class ConfirmPlatformIntakeSessionDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  encounterReferenceId?: string;

  @IsOptional()
  @IsBoolean()
  patientConfirmed?: boolean;
}
