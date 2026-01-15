import Joi from 'joi';

export const configValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').required(),
  PORT: Joi.number().port().required(),
  DATABASE_URL: Joi.string().uri().required(),
  REDIS_URL: Joi.string().uri().required(),
  JWT_ACCESS_SECRET: Joi.string().min(20).required(),
  JWT_REFRESH_SECRET: Joi.string().min(20).required(),
  JWT_ACCESS_TTL: Joi.string().default('15m'),
  JWT_REFRESH_TTL: Joi.string().default('7d'),
  STORAGE_ENDPOINT: Joi.string().uri().allow('').optional(),
  STORAGE_REGION: Joi.string().allow('').optional(),
  STORAGE_BUCKET: Joi.string().allow('').optional(),
  STORAGE_ACCESS_KEY: Joi.string().allow('').optional(),
  STORAGE_SECRET_KEY: Joi.string().allow('').optional(),
}).unknown(true);
