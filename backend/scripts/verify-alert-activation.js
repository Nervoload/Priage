#!/usr/bin/env node

require('dotenv').config();

if ((process.env.ALERT_RULE_ENGINE_MODE || 'shadow').trim().toLowerCase() !== 'active') {
  console.log('[alert-activation] Rule engine remains in shadow mode.');
  process.exit(0);
}

const { PrismaClient, WebhookSubscriptionStatus } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

main().catch((error) => {
  console.error(`[alert-activation] ${error.message}`);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect().catch(() => {});
  await pool.end().catch(() => {});
});

async function main() {
  const now = new Date();
  const hospitals = await prisma.hospital.findMany({
    where: {
      AND: [
        {
          webhookSubscriptions: {
            none: {
              status: WebhookSubscriptionStatus.ACTIVE,
              lastTestedAt: { not: null },
            },
          },
        },
        {
          OR: [
            { alertEscalationException: null },
            { alertEscalationException: { expiresAt: { lte: now } } },
          ],
        },
      ],
    },
    select: { slug: true },
  });
  if (hospitals.length) {
    throw new Error(`Active alert rollout blocked; hospitals lack a tested webhook or current exception: ${hospitals.map((hospital) => hospital.slug).join(', ')}`);
  }
  console.log('[alert-activation] Every hospital has a tested escalation target or current temporary exception.');
}
