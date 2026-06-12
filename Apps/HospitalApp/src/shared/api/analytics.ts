// HospitalApp/src/shared/api/analytics.ts
// Analytics API calls.

import { client } from './client';
import type { AnalyticsRange, AnalyticsResponse } from '../types/analytics';

export async function getHospitalAnalytics(
  hospitalId: number,
  range: AnalyticsRange = 'week',
): Promise<AnalyticsResponse> {
  return client<AnalyticsResponse>(`/analytics/hospitals/${hospitalId}/encounters?range=${range}`);
}
