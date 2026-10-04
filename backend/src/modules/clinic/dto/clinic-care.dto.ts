import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, MaxLength, Min } from 'class-validator';

import { CARE_FEEDBACK_SECTIONS } from '../care/care-feedback';

export class StartCareDto {
  @IsUUID() commandKey!: string;
  @IsOptional() @IsString() @MaxLength(1000) urgentOverrideReason?: string;
}

export class FinishCareDto {
  @IsUUID() commandKey!: string;
  @IsInt() @Min(0) noteVersion!: number;
}

export class SaveCareNoteDto {
  @IsString() @MaxLength(30000) text!: string;
  @IsInt() @Min(0) expectedVersion!: number;
  @IsOptional() @IsString() @MaxLength(1000) amendmentReason?: string;
}

export class CreateCareCommentDto {
  @IsUUID() commandKey!: string;
  @IsInt() @Min(1) snapshotId!: number;
  @IsString() @MaxLength(180) segmentId!: string;
  @IsInt() @Min(0) startOffset!: number;
  @IsInt() @Min(1) endOffset!: number;
  @IsString() @MaxLength(4000) quote!: string;
  @IsString() @MaxLength(4000) text!: string;
}

export class UpdateCareCommentDto {
  @IsInt() @Min(1) expectedVersion!: number;
  @IsOptional() @IsString() @MaxLength(4000) text?: string;
  @IsOptional() @IsBoolean() resolved?: boolean;
}

export class CreateCareQuestionDto {
  @IsUUID() commandKey!: string;
  @IsString() @MaxLength(1000) text!: string;
  /** Ticking an "Ask in the room" item. The server takes the text from that item. */
  @IsOptional() @IsInt() @Min(1) snapshotId?: number;
  @IsOptional() @IsString() @Matches(/^ask:\d{1,3}$/) sourceSegmentId?: string;
  @IsOptional() @IsBoolean() addressed?: boolean;
}

export class UpdateCareQuestionDto {
  @IsInt() @Min(1) expectedVersion!: number;
  @IsOptional() @IsString() @MaxLength(1000) text?: string;
  @IsOptional() @IsBoolean() addressed?: boolean;
  /** What the patient said when asked; empty clears it. */
  @IsOptional() @IsString() @MaxLength(2000) answerText?: string;
}

export class CareFeedbackDto {
  @IsInt() @Min(1) snapshotId!: number;
  @IsIn(['USEFUL', 'NOT_RIGHT', 'MISSING']) kind!: 'USEFUL' | 'NOT_RIGHT' | 'MISSING';
  @IsOptional() @IsString() @MaxLength(180) segmentId?: string;
  @IsOptional() @IsIn(CARE_FEEDBACK_SECTIONS) sectionKey?: string;
  @IsOptional() @IsString() @MaxLength(1000) note?: string;
}

export class ClearCareFeedbackDto {
  @Type(() => Number) @IsInt() @Min(1) snapshotId!: number;
  @IsString() @MaxLength(200) targetKey!: string;
}

export const CARE_COPY_SECTIONS = [
  'assessment_section', 'question_answer', 'physician_note', 'open_question', 'comment',
  'before_you_go_in', 'urgency', 'ask_in_room', 'gaps', 'questionnaire', 'visit_record', 'transcript', 'chart_composer',
] as const;

export class CareCopyAuditDto {
  @IsIn(CARE_COPY_SECTIONS) section!: string;
  /** Extra sections copied together, e.g. by the chart composer; each is audited. */
  @IsOptional() @IsArray() @ArrayMaxSize(12) @IsIn(CARE_COPY_SECTIONS, { each: true }) sections?: string[];
  @IsOptional() @IsInt() @Min(1) snapshotId?: number;
}
