// backend/src/modules/auth/dto/login.dto.ts
// Login request DTO

import { IsEmail, IsOptional, IsString, Length, Matches, MinLength } from 'class-validator';

import { SanitizeEmail } from '../../../common/decorators/sanitize.decorator';

export class LoginDto {
  @IsEmail()
  @SanitizeEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  password!: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  hospitalSlug?: string;

  @IsOptional()
  @IsString()
  @Length(6, 8)
  mfaCode?: string;
}
