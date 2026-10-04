import { IsString, Matches } from 'class-validator';

export class AttachClinicDto {
  @IsString()
  @Matches(/^[a-z0-9][a-z0-9_-]{2,47}$/)
  clinicAlias!: string;
}
