// backend/src/modules/auth/dto/login.dto.ts
// Login request DTO

import { IsEmail, IsString, MinLength } from 'class-validator';

import { SanitizeEmail } from '../../../common/decorators/sanitize.decorator';

export class LoginDto {
  @IsEmail()
  @SanitizeEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  password!: string;
}
