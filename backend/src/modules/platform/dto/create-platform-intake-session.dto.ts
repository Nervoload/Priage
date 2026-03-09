import { Type } from 'class-transformer';
import { IsDate, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';

import { CreateContextItemDto } from './create-context-item.dto';

export class CreatePlatformIntakeSessionDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  externalReferenceId?: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  expiresAt?: Date;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateContextItemDto)
  initialContext?: CreateContextItemDto;
}
