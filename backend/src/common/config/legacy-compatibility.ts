type Environment = Record<string, string | undefined>;

export type LegacyCompatibilityPath = 'patient_raw_session_token' | 'demo_static_access_code';

const ENABLED_VALUES = new Set(['1', 'true', 'yes', 'on', 'enabled']);

/**
 * Compatibility paths are migration aids, never an implicit development
 * default. A deployment must declare both an enabled mode and a future expiry
 * date so the path cannot become permanent by omission.
 */
export function isLegacyCompatibilityEnabled(
  path: LegacyCompatibilityPath,
  environment: Environment = process.env,
  now = new Date(),
): boolean {
  const prefix = path === 'patient_raw_session_token'
    ? 'PATIENT_LEGACY_TOKEN'
    : 'DEMO_LEGACY_CODE';
  const mode = (environment[`${prefix}_MIGRATION_MODE`] || '').trim().toLowerCase();
  const until = parseCompatibilityExpiry(environment[`${prefix}_MIGRATION_UNTIL`]);
  if (!ENABLED_VALUES.has(mode) || !until || until <= now) {
    return false;
  }

  // Raw patient bearer material must never be accepted in production, even if
  // an operator accidentally enables a migration variable there.
  if (path === 'patient_raw_session_token') {
    const nodeEnv = (environment.NODE_ENV || '').trim().toLowerCase();
    if (!['development', 'test'].includes(nodeEnv)) {
      return false;
    }
  }
  return true;
}

export function legacyCompatibilityExpiry(
  path: LegacyCompatibilityPath,
  environment: Environment = process.env,
): string | null {
  const prefix = path === 'patient_raw_session_token'
    ? 'PATIENT_LEGACY_TOKEN'
    : 'DEMO_LEGACY_CODE';
  const until = parseCompatibilityExpiry(environment[`${prefix}_MIGRATION_UNTIL`]);
  return until ? until.toISOString() : null;
}

function parseCompatibilityExpiry(value: string | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return null;
  const parsed = new Date(`${value.trim()}T23:59:59.999Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
