#!/usr/bin/env node

require('dotenv').config();

const { readFileSync } = require('fs');
const { resolve } = require('path');
const { PrismaClient, Role } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

main().catch((error) => {
  console.error(`[classify-admins] ${error.message}`);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect().catch(() => {});
  await pool.end().catch(() => {});
});

async function main() {
  const mappingPath = readArg('--mapping');
  if (!mappingPath) throw new Error('Usage: npm run staff:classify-admins -- --mapping /secure/path/admin-roles.json');
  const input = JSON.parse(readFileSync(resolve(mappingPath), 'utf8'));
  if (!Array.isArray(input)) throw new Error('Mapping must be a JSON array');

  const mappings = input.map((entry) => normalizeEntry(entry));
  const keys = mappings.map((entry) => `${entry.email}|${entry.hospitalSlug}`);
  if (new Set(keys).size !== keys.length) throw new Error('Mapping contains duplicate email/hospital entries');

  const legacy = await prisma.hospitalMembership.findMany({
    where: { role: Role.ADMIN },
    include: { user: { select: { email: true } }, hospital: { select: { slug: true } } },
  });
  const legacyKeys = new Set(legacy.map((membership) => `${membership.user.email.toLowerCase()}|${membership.hospital.slug}`));
  const missing = [...legacyKeys].filter((key) => !keys.includes(key));
  const unknown = keys.filter((key) => !legacyKeys.has(key));
  if (missing.length) throw new Error(`Mapping is missing legacy admins: ${missing.join(', ')}`);
  if (unknown.length) throw new Error(`Mapping contains unknown or non-ADMIN accounts: ${unknown.join(', ')}`);

  await prisma.$transaction(async (tx) => {
    for (const mapping of mappings) {
      const membership = legacy.find((candidate) => (
        candidate.user.email.toLowerCase() === mapping.email
        && candidate.hospital.slug === mapping.hospitalSlug
      ));
      if (!membership) throw new Error(`Unknown mapping entry ${mapping.email}|${mapping.hospitalSlug}`);
      await tx.hospitalMembership.update({ where: { id: membership.id }, data: { role: mapping.role } });
      await tx.staffSession.updateMany({
        where: { membershipId: membership.id, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: 'legacy_admin_classified' },
      });
      await tx.logRecord.create({
        data: {
          level: 'INFO',
          message: 'Legacy administrator explicitly classified',
          service: 'StaffRoleMigration',
          operation: 'classifyLegacyAdmin',
          userId: membership.userId,
          hospitalId: membership.hospitalId,
          data: { membershipId: membership.id, previousRole: Role.ADMIN, role: mapping.role },
        },
      });
    }
  });

  const remaining = await prisma.hospitalMembership.count({ where: { role: Role.ADMIN } });
  if (remaining !== 0) throw new Error(`${remaining} legacy ADMIN memberships remain; cutover is blocked`);
  console.log(`[classify-admins] Classified ${mappings.length} legacy administrator memberships; all sessions revoked.`);
}

function normalizeEntry(value) {
  if (!value || typeof value !== 'object') throw new Error('Each mapping entry must be an object');
  const email = String(value.email || '').trim().toLowerCase();
  const hospitalSlug = String(value.hospitalSlug || '').trim().toLowerCase();
  const role = String(value.role || '').trim().toUpperCase();
  if (!email || !hospitalSlug) throw new Error('Each mapping entry requires email and hospitalSlug');
  if (![Role.IT_ADMIN, Role.CLINICAL_ADMIN].includes(role)) {
    throw new Error(`Invalid classified role for ${email}: ${role}`);
  }
  return { email, hospitalSlug, role };
}

function readArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}
