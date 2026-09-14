#!/usr/bin/env node

require('dotenv').config();

const { PrismaClient, Role } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

main().catch((error) => {
  console.error(`[staff-cutover] ${error.message}`);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect().catch(() => {});
  await pool.end().catch(() => {});
});

async function main() {
  const [legacyAdmins, sessionsWithoutMembership] = await Promise.all([
    prisma.hospitalMembership.count({ where: { role: Role.ADMIN } }),
    prisma.staffSession.count({ where: { membershipId: null, revokedAt: null } }),
  ]);
  if (legacyAdmins > 0) throw new Error(`${legacyAdmins} legacy ADMIN memberships remain`);
  if (sessionsWithoutMembership > 0) {
    throw new Error(`${sessionsWithoutMembership} active staff sessions are not membership-scoped`);
  }
  console.log('[staff-cutover] Membership roles and active sessions are ready for cutover.');
}
