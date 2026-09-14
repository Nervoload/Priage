import { IsEmail, IsString, Length } from 'class-validator';

import { SanitizeEmail } from '../../../common/decorators/sanitize.decorator';

export class VerifyDemoCodeDto {
  @IsEmail()
  @SanitizeEmail()
  email!: string;

  @IsString()
  @Length(6, 12)
  code!: string;
}
