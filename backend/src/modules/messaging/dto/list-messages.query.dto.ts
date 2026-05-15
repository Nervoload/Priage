// backend/src/modules/messaging/dto/list-messages.query.dto.ts
// DTO for listing staff messages with pagination and incremental cursors.

import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export class ListMessagesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  afterMessageId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  override limit?: number = undefined;
}
