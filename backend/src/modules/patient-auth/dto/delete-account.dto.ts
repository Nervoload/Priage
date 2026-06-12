import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class DeletePatientAccountDto {
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(120)
  password!: string;
}
