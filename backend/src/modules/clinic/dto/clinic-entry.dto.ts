import { IsBoolean, IsString, Matches } from 'class-validator';

export class UpdateClinicEntryDto {
  @IsString()
  @Matches(/^[a-z0-9][a-z0-9_-]{2,47}$/)
  canonicalAlias!: string;

  @IsBoolean()
  directoryListed!: boolean;

  @IsBoolean()
  acceptsWalkIns!: boolean;
}
