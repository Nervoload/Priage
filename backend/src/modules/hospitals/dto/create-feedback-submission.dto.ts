import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';

class FeedbackResponseDto {
  @IsString()
  @Matches(/^[a-z0-9_]+$/)
  questionId!: string;

  @IsString()
  @MaxLength(200)
  prompt!: string;

  @IsString()
  @MaxLength(2000)
  answer!: string;
}

export class CreateFeedbackSubmissionDto {
  @IsArray()
  @ArrayMaxSize(15)
  @ValidateNested({ each: true })
  @Type(() => FeedbackResponseDto)
  responses!: FeedbackResponseDto[];

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  bugReport?: string;
}
