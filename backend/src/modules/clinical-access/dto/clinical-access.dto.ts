import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class GrantEncounterAccessDto {
  @IsInt()
  @Min(1)
  userId!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  expiresInMinutes?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class BreakGlassDto {
  @IsString()
  @MaxLength(1000)
  reason!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  expiresInMinutes?: number;
}

