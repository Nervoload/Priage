import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, ValidateNested,
} from 'class-validator';

import { Sanitize } from '../../../common/decorators/sanitize.decorator';
import { DURATION_UNITS, type DurationUnit } from '../case/types';

// A standalone DTO rather than a subclass of AdvanceInterviewDto: class-validator
// merges decorators, so a subclass couldn't widen the legacy `action` list.

const clean = (value: string) => value.trim().replace(/\0/g, '').replace(/<[^>]*>/g, '');

export class DurationAnswerDto {
  @IsInt()
  @Min(0)
  @Max(999)
  amount!: number;

  @IsString()
  @IsIn(DURATION_UNITS as unknown as string[])
  unit!: DurationUnit;
}

export class AdvanceAssessmentDto {
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
  @IsArray()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  // @Sanitize() skips arrays, so each choice is cleaned here.
  @Transform(({ value }) => (Array.isArray(value) ? value.map((item) => (typeof item === 'string' ? clean(item) : item)) : value))
  valueChoices?: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => DurationAnswerDto)
  valueDuration?: DurationAnswerDto;

  @IsOptional()
  @IsBoolean()
  notSure?: boolean;

  @IsOptional()
  @IsString()
  @IsIn(['acknowledge_emergency', 'confirm_review', 'correct_answer'])
  action?: 'acknowledge_emergency' | 'confirm_review' | 'correct_answer';
}

/** Choices made before the assessment starts. They apply only when this call creates the assessment. */
export class StartAssessmentDto {
  @IsOptional()
  @IsString()
  @IsIn(['en', 'fr'])
  language?: 'en' | 'fr';

  @IsOptional()
  @IsString()
  @IsIn(['self', 'parent', 'caregiver', 'other'])
  answeredBy?: 'self' | 'parent' | 'caregiver' | 'other';

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(130)
  subjectAge?: number;
}

/** Fields the legacy engine doesn't understand. Sending them to a legacy assessment is an error, not something to drop silently. */
export function harnessOnlyFields(dto: AdvanceAssessmentDto): string[] {
  const fields: string[] = [];
  if (dto.valueChoices !== undefined) fields.push('valueChoices');
  if (dto.valueDuration !== undefined) fields.push('valueDuration');
  if (dto.notSure !== undefined) fields.push('notSure');
  if (dto.action === 'confirm_review' || dto.action === 'correct_answer') fields.push('action');
  return fields;
}
