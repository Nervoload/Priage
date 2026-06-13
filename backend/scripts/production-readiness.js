#!/usr/bin/env node
require('dotenv/config');

const required = [
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
  'DATABASE_PROXY_MODE',
  'DATABASE_POOL_MAX',
];
const missing = required.filter((name) => !process.env[name]?.trim());
if (missing.length > 0) {
  console.error(`Missing required production configuration: ${missing.join(', ')}`);
  process.exit(1);
}
const requiredTrue = [
  'CARE_TEAM_ACCESS_REQUIRED',
  'STAFF_DEVICE_BINDING_REQUIRED',
  'SENSITIVE_READ_AUDIT_FAIL_CLOSED',
  'REDIS_TLS',
];
for (const name of requiredTrue) {
  if (!['1', 'true', 'yes', 'on'].includes((process.env[name] || '').trim().toLowerCase())) {
    console.error(`${name} must be enabled`);
    process.exit(1);
  }
}
if (
  !['1', 'true', 'yes', 'on'].includes((process.env.STAFF_MFA_REQUIRED || '').trim().toLowerCase())
  && !process.env.SSO_JWT_PUBLIC_KEY?.trim()
) {
  console.error('STAFF_MFA_REQUIRED=true or SSO_JWT_PUBLIC_KEY is required');
  process.exit(1);
}
for (const name of ['ALLOW_PATIENT_TOKEN_HEADER', 'ALLOW_LEGACY_RAW_PATIENT_TOKENS']) {
  if (['1', 'true', 'yes', 'on'].includes((process.env[name] || '').trim().toLowerCase())) {
    console.error(`${name} must be disabled`);
    process.exit(1);
  }
}
if ((process.env.ASSET_STORAGE_PROVIDER || '').trim().toLowerCase() !== 's3') {
  console.error('ASSET_STORAGE_PROVIDER must be s3');
  process.exit(1);
}
if (!/[?&]sslmode=(require|verify-ca|verify-full)(?:&|$)/i.test(process.env.DATABASE_URL || '')) {
  console.error('DATABASE_URL must require TLS');
  process.exit(1);
}
if (!['pgbouncer', 'rds-proxy'].includes((process.env.DATABASE_PROXY_MODE || '').trim().toLowerCase())) {
  console.error('DATABASE_PROXY_MODE must be pgbouncer or rds-proxy');
  process.exit(1);
}
const poolMax = Number.parseInt(process.env.DATABASE_POOL_MAX || '', 10);
if (!Number.isFinite(poolMax) || poolMax < 1 || poolMax > 100) {
  console.error('DATABASE_POOL_MAX must be configured between 1 and 100');
  process.exit(1);
}
console.log('Production configuration gate passed');
