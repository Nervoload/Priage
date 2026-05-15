import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';

import {
  HOSPITAL_INTAKE_APPLIES_TO,
  HOSPITAL_INTAKE_RESPONSE_TYPES,
  HOSPITAL_PAGE_KEYS,
  HOSPITAL_SURVEY_RESPONSE_TYPES,
  type HospitalIntakeAppliesTo,
  type HospitalIntakeResponseType,
  type HospitalPageKey,
  type HospitalSurveyResponseType,
} from '../hospital-config';

class PageAccessDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @IsIn(HOSPITAL_PAGE_KEYS, { each: true })
  ADMIN!: HospitalPageKey[];

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @IsIn(HOSPITAL_PAGE_KEYS, { each: true })
  NURSE!: HospitalPageKey[];

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @IsIn(HOSPITAL_PAGE_KEYS, { each: true })
  STAFF!: HospitalPageKey[];

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @IsIn(HOSPITAL_PAGE_KEYS, { each: true })
  DOCTOR!: HospitalPageKey[];
}

class IntakeQuestionDto {
  @IsString()
  @Matches(/^[a-z0-9_]+$/)
  id!: string;

  @IsString()
  @Matches(/^[a-z0-9_]+$/)
  fieldKey!: string;

  @IsString()
  @MaxLength(120)
  label!: string;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  helpText?: string;

  @IsBoolean()
  required!: boolean;

  @IsIn(HOSPITAL_INTAKE_RESPONSE_TYPES)
  responseType!: HospitalIntakeResponseType;

  @IsIn(HOSPITAL_INTAKE_APPLIES_TO)
  appliesTo!: HospitalIntakeAppliesTo;
}

class FeedbackSurveyQuestionDto {
  @IsString()
  @Matches(/^[a-z0-9_]+$/)
  id!: string;

  @IsString()
  @MaxLength(200)
  prompt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  description?: string;

  @IsBoolean()
  required!: boolean;

  @IsIn(HOSPITAL_SURVEY_RESPONSE_TYPES)
  responseType!: HospitalSurveyResponseType;
}

export class UpdateHospitalConfigDto {
  @ValidateNested()
  @Type(() => PageAccessDto)
  pageAccess!: PageAccessDto;

  @IsArray()
  @ArrayMaxSize(25)
  @ValidateNested({ each: true })
  @Type(() => IntakeQuestionDto)
  customIntakeQuestions!: IntakeQuestionDto[];

  @IsArray()
  @ArrayMaxSize(15)
  @ValidateNested({ each: true })
  @Type(() => FeedbackSurveyQuestionDto)
  admittanceFeedbackSurvey!: FeedbackSurveyQuestionDto[];
}
