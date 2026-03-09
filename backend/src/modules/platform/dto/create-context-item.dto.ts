import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateContextItemDto {
  @IsString()
  @MaxLength(120)
  itemType!: string;

  @IsString()
  @MaxLength(40)
  schemaVersion!: string;

  @IsObject()
  payload!: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  supersedesPublicId?: string;
}
