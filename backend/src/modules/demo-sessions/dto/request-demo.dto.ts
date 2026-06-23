import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

import { Sanitize, SanitizeEmail } from '../../../common/decorators/sanitize.decorator';

export class RequestDemoDto {
  @IsEmail()
  @SanitizeEmail()
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  @Sanitize()
  organization?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  @Sanitize()
  role?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  @Sanitize()
  organizationType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(600)
  @Sanitize()
  interest?: string;
}
