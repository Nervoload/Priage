// backend/src/modules/analytics/dto/get-hospital-analytics.query.dto.ts
// Query DTO for hospital analytics requests.

import { Transform } from 'class-transformer';
import { IsIn, IsOptional } from 'class-validator';

export const ANALYTICS_RANGES = ['day', 'week', 'month', 'year', 'all'] as const;
export type AnalyticsRange = typeof ANALYTICS_RANGES[number];

export class GetHospitalAnalyticsQueryDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.toLowerCase() : value))
  @IsIn(ANALYTICS_RANGES)
  range: AnalyticsRange = 'week';
}
