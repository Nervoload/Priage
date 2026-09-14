#!/usr/bin/env node

require('dotenv').config();

const { createHash } = require('crypto');
const { PutObjectCommand, S3Client } = require('@aws-sdk/client-s3');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

const databaseUrl = requireEnv('DATABASE_URL');
const bucket = requireEnv('AUDIT_ARCHIVE_BUCKET');
const region = process.env.ASSET_STORAGE_REGION || 'us-east-1';
const from = new Date(process.env.AUDIT_EXPORT_FROM || Date.now() - 60 * 60 * 1000);
const to = new Date(process.env.AUDIT_EXPORT_TO || Date.now());
const hospitalId = readOptionalInt(process.env.AUDIT_EXPORT_HOSPITAL_ID);
const retentionDays = readPositiveInt(process.env.AUDIT_ARCHIVE_RETENTION_DAYS, 2557);
const retainUntil = new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000);
const prefix = `sensitive-read-audit/${to.toISOString().slice(0, 10)}`;
const exportId = `${from.toISOString()}_${to.toISOString()}`.replace(/[:.]/g, '-');

const pool = new Pool({ connectionString: databaseUrl, max: 2 });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
const s3 = new S3Client({
  region,
  endpoint: process.env.ASSET_STORAGE_ENDPOINT || undefined,
  forcePathStyle: ['1', 'true', 'yes', 'on'].includes((process.env.ASSET_STORAGE_FORCE_PATH_STYLE || '').toLowerCase()),
});

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect().catch(() => {});
  await pool.end().catch(() => {});
});

async function main() {
  const where = {
    createdAt: { gte: from, lt: to },
    ...(hospitalId ? { hospitalId } : {}),
  };
  const [reads, breakGlass] = await Promise.all([
    prisma.sensitiveReadAuditLog.findMany({ where, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] }),
    prisma.breakGlassAccess.findMany({ where, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] }),
  ]);
  const lines = [
    ...reads.map((record) => JSON.stringify({ ledger: 'sensitive_read', ...record })),
    ...breakGlass.map((record) => JSON.stringify({ ledger: 'break_glass', ...record })),
  ].sort();
  const body = Buffer.from(`${lines.join('\n')}${lines.length > 0 ? '\n' : ''}`);
  const sha256 = createHash('sha256').update(body).digest('hex');
  const dataKey = `${prefix}/${exportId}.jsonl`;
  const manifestKey = `${prefix}/${exportId}.manifest.json`;
  const manifest = Buffer.from(JSON.stringify({
    exportId,
    from: from.toISOString(),
    to: to.toISOString(),
    hospitalId,
    sensitiveReadCount: reads.length,
    breakGlassCount: breakGlass.length,
    sha256,
    dataKey,
    generatedAt: new Date().toISOString(),
  }, null, 2));

  await putLockedObject(dataKey, body, 'application/x-ndjson', sha256);
  await putLockedObject(
    manifestKey,
    manifest,
    'application/json',
    createHash('sha256').update(manifest).digest('hex'),
  );
  console.log(JSON.stringify({ bucket, dataKey, manifestKey, records: lines.length, sha256 }));
}

async function putLockedObject(key, body, contentType, sha256) {
  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: contentType,
    Metadata: { sha256 },
    ServerSideEncryption: process.env.ASSET_S3_KMS_KEY_ID ? 'aws:kms' : 'AES256',
    SSEKMSKeyId: process.env.ASSET_S3_KMS_KEY_ID || undefined,
    ObjectLockMode: 'COMPLIANCE',
    ObjectLockRetainUntilDate: retainUntil,
  }));
}

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function readPositiveInt(value, fallback) {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readOptionalInt(value) {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}
