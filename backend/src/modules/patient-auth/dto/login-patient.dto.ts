import { IsEmail, IsString, MinLength } from 'class-validator';
import { SanitizeEmail } from '../../../common/decorators/sanitize.decorator';

export class LoginPatientDto {
  @IsEmail()
  @SanitizeEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  password!: string;
}
