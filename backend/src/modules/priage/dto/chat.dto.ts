import { IsArray, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class PriageChatMessageDto {
  @IsString()
  role!: 'user' | 'assistant';

  @IsString()
  @MaxLength(4000)
  content!: string;
}

export class PriageChatDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PriageChatMessageDto)
  messages!: PriageChatMessageDto[];
}

export class PriageAdmitDto {
  @IsString()
  @MaxLength(240)
  chiefComplaint!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  details?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  hospitalSlug?: string;

  @IsOptional()
  severity?: number;
}
