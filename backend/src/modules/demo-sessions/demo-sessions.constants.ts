export { readBooleanEnv, readPositiveIntegerEnv } from '../../common/config/env-value.util';

export const DEMO_COOKIE_NAME = 'priage_demo_access';

export const DEMO_SESSION_STATUSES = {
  PENDING: 'PENDING',
  VERIFIED: 'VERIFIED',
  SUPERSEDED: 'SUPERSEDED',
  REVOKED: 'REVOKED',
} as const;

export const DEMO_EVENT_TYPES = [
  'demo_requested',
  'demo_verified',
  'demo_opened',
  'tour_started',
  'tour_step_viewed',
  'tour_completed',
  'tour_skipped',
] as const;

export type DemoEventType = typeof DEMO_EVENT_TYPES[number];
