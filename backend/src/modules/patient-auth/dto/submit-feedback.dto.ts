import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';

const FEEDBACK_TYPES = ['feedback', 'bug'] as const;

export class SubmitPatientFeedbackDto {
  @IsIn(FEEDBACK_TYPES)
  type!: 'feedback' | 'bug';

  @IsString()
  @MinLength(5)
  @MaxLength(2000)
  message!: string;
}
