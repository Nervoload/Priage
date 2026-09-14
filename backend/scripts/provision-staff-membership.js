#!/usr/bin/env node

require('dotenv').config();

const bcrypt = require('bcrypt');
const { readFileSync } = require('fs');
const { resolve } = require('path');
const { PrismaClient, Role } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

main().catch((error) => {
  console.error(`[staff-provision] ${error.message}`);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect().catch(() => {});
  await pool.end().catch(() => {});
});

async function main() {
  const email = String(readArg('--email') || '').trim().toLowerCase();
  const hospitalSlug = String(readArg('--hospital-slug') || '').trim().toLowerCase();
  const role = String(readArg('--role') || '').trim().toUpperCase();
  const passwordFile = readArg('--password-file');
  const password = passwordFile ? readFileSync(resolve(passwordFile), 'utf8').trimEnd() : null;
  const allowed = [Role.IT_ADMIN, Role.CLINICAL_ADMIN, Role.NURSE, Role.DOCTOR, Role.STAFF];
  if (!email || !hospitalSlug || !allowed.includes(role)) {
    throw new Error('Usage: npm run staff:provision -- --email <email> --hospital-slug <slug> --role <role> [--password-file /secure/path/password]');
  }
  const hospital = await prisma.hospital.findUnique({ where: { slug: hospitalSlug } });
  if (!hospital) throw new Error(`Unknown hospital ${hospitalSlug}`);
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (!existingUser && (!password || password.length < 12)) {
    throw new Error('A password file containing at least 12 characters is required for a new identity');
  }
  if (existingUser) {
    const existingMembership = await prisma.hospitalMembership.findUnique({
      where: { userId_hospitalId: { userId: existingUser.id, hospitalId: hospital.id } },
    });
    if (existingMembership) throw new Error(`Identity ${email} already has a membership at ${hospitalSlug}`);
  }
  const passwordHash = existingUser ? null : await bcrypt.hash(password, 12);
  const membership = await prisma.$transaction(async (tx) => {
    const user = existingUser ?? await tx.user.create({
      data: {
        email,
        password: passwordHash,
        hospitalId: hospital.id,
        role,
      },
    });
    const created = await tx.hospitalMembership.create({
      data: { userId: user.id, hospitalId: hospital.id, role },
    });
    await tx.logRecord.create({
      data: {
        level: 'INFO',
        message: 'Staff hospital membership provisioned by operator',
        service: 'StaffProvisioning',
        operation: 'provisionMembership',
        userId: user.id,
        hospitalId: hospital.id,
        data: { membershipId: created.id, role },
      },
    });
    return created;
  });
  console.log(`[staff-provision] Provisioned membership ${membership.id} for ${email} at ${hospitalSlug} as ${role}.`);
}

function readArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}
