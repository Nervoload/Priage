const REQUIRED_PRODUCTION_VALUES = [
  'DATABASE_URL',
  'REDIS_HOST',
  'REDIS_PASSWORD',
  'CORS_ORIGINS',
  'GATEWAY_SHARED_SECRET',
  'STAFF_MFA_ENCRYPTION_KEY',
  'ASSET_STORAGE_BUCKET',
  'ASSET_S3_KMS_KEY_ID',
  'ASSET_SCANNER_URL',
  'AUDIT_ARCHIVE_BUCKET',
  'WEBHOOK_SECRET_ENCRYPTION_KEY',
  'WEBHOOK_ALLOWED_HOSTS',
  'HOSPITAL_DASHBOARD_URL',
] as const;

export function assertProductionConfiguration(): void {
  if ((process.env.NODE_ENV || '').trim().toLowerCase() !== 'production') return;
  const missing = REQUIRED_PRODUCTION_VALUES.filter((name) => !process.env[name]?.trim());
  if (missing.length > 0) {
    throw new Error(`Missing required production configuration: ${missing.join(', ')}`);
  }
  if ((process.env.ASSET_STORAGE_PROVIDER || '').trim().toLowerCase() !== 's3') {
    throw new Error('ASSET_STORAGE_PROVIDER must be s3 in production');
  }
  if (!isTrue(process.env.STAFF_MFA_REQUIRED) && !process.env.SSO_JWT_PUBLIC_KEY?.trim()) {
    throw new Error('Production requires STAFF_MFA_REQUIRED=true or SSO_JWT_PUBLIC_KEY');
  }
  if (!isTrue(process.env.REDIS_TLS)) {
    throw new Error('REDIS_TLS must be true in production');
  }
  if (!/[?&]sslmode=(require|verify-ca|verify-full)(?:&|$)/i.test(process.env.DATABASE_URL || '')) {
    throw new Error('DATABASE_URL must require TLS in production');
  }
  if (!['pgbouncer', 'rds-proxy'].includes((process.env.DATABASE_PROXY_MODE || '').trim().toLowerCase())) {
    throw new Error('DATABASE_PROXY_MODE must be pgbouncer or rds-proxy in production');
  }
  const poolMax = Number.parseInt(process.env.DATABASE_POOL_MAX || '', 10);
  if (!Number.isFinite(poolMax) || poolMax < 1 || poolMax > 100) {
    throw new Error('DATABASE_POOL_MAX must be configured between 1 and 100 in production');
  }
  if (!isTrue(process.env.CARE_TEAM_ACCESS_REQUIRED)) {
    throw new Error('CARE_TEAM_ACCESS_REQUIRED must be true in production');
  }
  if (!isTrue(process.env.STAFF_DEVICE_BINDING_REQUIRED)) {
    throw new Error('STAFF_DEVICE_BINDING_REQUIRED must be true in production');
  }
  if (!isTrue(process.env.SENSITIVE_READ_AUDIT_FAIL_CLOSED)) {
    throw new Error('SENSITIVE_READ_AUDIT_FAIL_CLOSED must be true in production');
  }
  if (isTrue(process.env.ALLOW_PATIENT_TOKEN_HEADER)) {
    throw new Error('ALLOW_PATIENT_TOKEN_HEADER cannot be enabled in production');
  }
  if (isTrue(process.env.ALLOW_LEGACY_RAW_PATIENT_TOKENS)) {
    throw new Error('ALLOW_LEGACY_RAW_PATIENT_TOKENS cannot be enabled in production');
  }
  const interviewMode = (process.env.TRIAGE_INTERVIEW_MODE || '').trim().toLowerCase();
  if (interviewMode !== 'deterministic') {
    throw new Error('TRIAGE_INTERVIEW_MODE must be deterministic in production until an approved regional provider is configured');
  }
  if (process.env.TRIAGE_AI_API_KEY?.trim() || process.env.TRIAGE_AI_BASE_URL?.trim()) {
    throw new Error('External triage AI configuration is not permitted in production');
  }
  let dashboardUrl: URL;
  try {
    dashboardUrl = new URL(process.env.HOSPITAL_DASHBOARD_URL || '');
  } catch {
    throw new Error('HOSPITAL_DASHBOARD_URL must be a valid HTTPS URL in production');
  }
  if (dashboardUrl.protocol !== 'https:' || dashboardUrl.username || dashboardUrl.password) {
    throw new Error('HOSPITAL_DASHBOARD_URL must be a credential-free HTTPS URL in production');
  }
}

function isTrue(value: string | undefined): boolean {
  return ['1', 'true', 'yes', 'on'].includes((value || '').trim().toLowerCase());
}
