// HospitalApp/src/shared/api/analytics.ts
// Analytics API calls.

import { client } from './client';
import type { AnalyticsRange, AnalyticsResponse } from '../types/analytics';
import {
  getDemoHospitalAnalytics,
  isStaticDemoMode,
} from '../../../../DemoShared/src/staticDemo';

export async function getHospitalAnalytics(
  hospitalId: number,
  range: AnalyticsRange = 'week',
): Promise<AnalyticsResponse> {
  if (isStaticDemoMode()) {
    void hospitalId;
    return getDemoHospitalAnalytics(range) as AnalyticsResponse;
  }
  return client<AnalyticsResponse>(`/analytics/hospitals/${hospitalId}/encounters?range=${range}`);
}
