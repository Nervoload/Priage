import { Type } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

import { Sanitize } from '../../../common/decorators/sanitize.decorator';
import type { AiTriageMandatoryAnswers } from '../types/ai-triage.types';

export class MandatoryTriageAnswersDto implements AiTriageMandatoryAnswers {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  @Sanitize()
  onset!: string;

  @IsIn([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 'unknown', 'prefer_not_to_answer'])
  severity!: number | 'unknown' | 'prefer_not_to_answer';

  @IsIn(['better', 'worse', 'same', 'unknown'])
  progression!: 'better' | 'worse' | 'same' | 'unknown';

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  @Sanitize()
  relevantHistory!: string;
}

export class StartTriageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  @Sanitize()
  chiefComplaint!: string;

  @ValidateNested()
  @Type(() => MandatoryTriageAnswersDto)
  mandatoryAnswers!: MandatoryTriageAnswersDto;
}
