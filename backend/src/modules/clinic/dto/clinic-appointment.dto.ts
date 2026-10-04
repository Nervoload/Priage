import { IsArray, IsBoolean, IsIn, IsInt, IsISO8601, IsOptional, IsString, IsUUID, Matches, MaxLength, Min } from 'class-validator';
import { Sanitize } from '../../../common/decorators/sanitize.decorator';

export class UpdateClinicScheduleDto {
  @IsString() @MaxLength(100) timezone!: string;
  @IsIn([15, 30, 60]) slotMinutes!: 15 | 30 | 60;
  @IsInt() @Min(1) capacity!: number;
  @IsInt() @Min(15) holdMinutes!: number;
  @IsArray() weeklyWindows!: unknown[];
}

export class UpsertClinicDayOverrideDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/) localDate!: string;
  @IsArray() windows!: unknown[];
}

export class CreateClinicScheduleBlockDto {
  @IsISO8601({ strict: true }) startAt!: string;
  @IsISO8601({ strict: true }) endAt!: string;
  @IsString() @MaxLength(200) @Sanitize() reason!: string;
}

export class RequestClinicAppointmentDto {
  @IsUUID() requestKey!: string;
  @IsISO8601({ strict: true }) startAt!: string;
  @IsInt() @Min(1) termsDocumentId!: number;
  @IsInt() @Min(1) privacyDocumentId!: number;
  @IsBoolean() accepted!: boolean;
}

export class ClinicAppointmentCommandDto {
  @IsUUID() commandKey!: string;
  @IsOptional() @IsInt() @Min(0) expectedRevision?: number;
}

export class RescheduleClinicAppointmentDto extends ClinicAppointmentCommandDto {
  @IsISO8601({ strict: true }) startAt!: string;
}
