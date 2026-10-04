import { ArrayMaxSize, IsArray, IsInt, Min } from 'class-validator';

import { MAX_CLINIC_QUESTIONS } from '../questionnaire/clinic-questionnaire';

export class PublishClinicQuestionnaireDto {
  /** The version the admin edited; publishing fails if someone published since. 0 for the first. */
  @IsInt() @Min(0) expectedVersion!: number;
  /** Checked in full by validateClinicQuestions. */
  @IsArray() @ArrayMaxSize(MAX_CLINIC_QUESTIONS) questions!: unknown[];
}

export class SubmitClinicAnswersDto {
  @IsInt() @Min(1) version!: number;
  /** [{ key, valueBoolean | valueChoice | valueText }], checked by clinicAnswerRecords. */
  @IsArray() @ArrayMaxSize(MAX_CLINIC_QUESTIONS) answers!: unknown[];
}
