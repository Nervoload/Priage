import { IsBoolean, IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

import { Sanitize } from '../../../common/decorators/sanitize.decorator';

export class AdvanceInterviewDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Sanitize()
  questionPublicId?: string;

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

  @IsOptional()
  @IsString()
  @IsIn(['acknowledge_emergency'])
  action?: 'acknowledge_emergency';
}
