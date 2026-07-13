import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

import { Sanitize } from '../../../common/decorators/sanitize.decorator';

export class AnswerTriageDto {
  @IsString()
  @MaxLength(120)
  @Sanitize()
  questionId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  @Sanitize()
  answer?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  @Sanitize()
  valueText?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  valueNumber?: number;

  @IsOptional()
  @IsBoolean()
  valueBoolean?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Sanitize()
  valueChoice?: string;
}
