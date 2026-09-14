import { IsInt, IsOptional, IsString, Length, Matches, Min } from 'class-validator';

export class VerifyMfaDto {
  @IsString()
  @Length(6, 8)
  code!: string;
}

export class SsoLoginDto {
  @IsString()
  assertion!: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  hospitalSlug?: string;
}

export class RevokeStaffSessionDto {
  @IsInt()
  @Min(1)
  sessionId!: number;
}
