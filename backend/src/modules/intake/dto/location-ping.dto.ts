// backend/src/modules/intake/dto/location-ping.dto.ts

import { IsNumber } from 'class-validator';

export class LocationPingDto {
  @IsNumber()
  latitude!: number;

  @IsNumber()
  longitude!: number;
}
