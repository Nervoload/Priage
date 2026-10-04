import { IsEmail, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';
import { Sanitize, SanitizeEmail } from '../../../common/decorators/sanitize.decorator';

export class StartClinicVisitDto {
  @IsUUID() startKey!: string;
  @IsEmail() @SanitizeEmail() contactEmail!: string;
  @IsOptional() @IsString() @MaxLength(120) @Sanitize() firstName?: string;
  @IsOptional() @IsString() @MaxLength(120) @Sanitize() lastName?: string;
  @IsOptional() @IsString() @MaxLength(20) @Sanitize() phone?: string;
  @IsOptional() @IsInt() @Min(0) @Max(120) age?: number;
  @IsOptional() @IsString() @MaxLength(50) @Sanitize() gender?: string;
  @IsString() @MinLength(1) @MaxLength(240) @Sanitize() chiefComplaint!: string;
  @IsOptional() @IsString() @MaxLength(4000) @Sanitize() details?: string;
}

export class UpdateVisitContactDto {
  @IsEmail() @SanitizeEmail() email!: string;
}

export class CreateClinicWalkInDto {
  @IsUUID() startKey!: string;
  @IsOptional() @IsEmail() @SanitizeEmail() contactEmail?: string;
  @IsOptional() @IsString() @MaxLength(120) @Sanitize() firstName?: string;
  @IsOptional() @IsString() @MaxLength(120) @Sanitize() lastName?: string;
  @IsOptional() @IsString() @MaxLength(20) @Sanitize() phone?: string;
  @IsOptional() @IsInt() @Min(0) @Max(120) age?: number;
  @IsOptional() @IsString() @MaxLength(50) @Sanitize() gender?: string;
  @IsString() @MinLength(1) @MaxLength(240) @Sanitize() chiefComplaint!: string;
  @IsOptional() @IsString() @MaxLength(4000) @Sanitize() details?: string;
}

export class ExchangeDeskGrantDto {
  @IsString() @MinLength(8) @MaxLength(256) token!: string;
}
