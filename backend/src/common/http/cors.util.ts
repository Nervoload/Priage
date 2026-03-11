const DEFAULT_DEV_CORS_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5174',
  'http://localhost:5175',
  'http://127.0.0.1:5175',
];

function isProductionLikeEnvironment(): boolean {
  const value = process.env.NODE_ENV?.trim().toLowerCase();
  return value === 'production';
}

export function getAllowedCorsOrigins(): string[] {
  const configuredOrigins = process.env.CORS_ORIGINS
    ?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (configuredOrigins && configuredOrigins.length > 0) {
    return configuredOrigins;
  }

  if (isProductionLikeEnvironment()) {
    throw new Error('CORS_ORIGINS must be set in production');
  }

  return DEFAULT_DEV_CORS_ORIGINS;
}
