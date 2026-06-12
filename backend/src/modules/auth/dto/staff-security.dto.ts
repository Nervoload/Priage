import { IsInt, IsString, Length, Min } from 'class-validator';

export class VerifyMfaDto {
  @IsString()
  @Length(6, 8)
  code!: string;
}

export class SsoLoginDto {
  @IsString()
  assertion!: string;
}

export class RevokeStaffSessionDto {
  @IsInt()
  @Min(1)
  sessionId!: number;
}

