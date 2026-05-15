import { IsEmail, IsOptional, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';

import { SanitizeEmail } from '../../../common/decorators/sanitize.decorator';

export class UpdateUserProfileDto {
  @IsOptional()
  @IsEmail()
  @SanitizeEmail()
  email?: string;

  @ValidateIf((value) => typeof value.newPassword === 'string' && value.newPassword.length > 0)
  @IsString()
  @MinLength(1)
  currentPassword?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword?: string;
}
