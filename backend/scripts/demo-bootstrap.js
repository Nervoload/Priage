// Creates the shared demo hospital and demo staff user used by DemoSession entry.
// Safe to run before `npm run demo:seed`.

require('dotenv').config();
const bcrypt = require('bcrypt');
const { randomUUID } = require('crypto');
const { PrismaClient, Role } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');

const connectionString =
  process.env.DATABASE_URL || 'postgresql://priage:priage@localhost:5432/priage';
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const hospitalSlug = (process.env.DEMO_HOSPITAL_SLUG || 'demo-hospital').trim().toLowerCase();
const hospitalName = (process.env.DEMO_HOSPITAL_NAME || 'Priage Demo Hospital').trim();
const staffEmail = (
  process.env.DEMO_STAFF_EMAIL || `demo.admin+${hospitalSlug}@priage.local`
).trim().toLowerCase();
const staffPassword = process.env.DEMO_STAFF_PASSWORD?.trim() || `Priage-${randomUUID()}`;

async function main() {
  const hospital = await prisma.hospital.upsert({
    where: { slug: hospitalSlug },
    create: {
      slug: hospitalSlug,
      name: hospitalName,
    },
    update: {
      name: hospitalName,
    },
  });

  const existingStaff = await prisma.user.findUnique({ where: { email: staffEmail } });
  if (existingStaff) {
    if (existingStaff.hospitalId !== hospital.id) {
      throw new Error(
        `Demo staff email ${staffEmail} already belongs to another hospital. ` +
          'Set DEMO_STAFF_EMAIL to an unused demo-only address; the bootstrap will not move an existing user.',
      );
    }

    if (existingStaff.role !== Role.ADMIN) {
      await prisma.user.update({
        where: { id: existingStaff.id },
        data: {
          role: Role.ADMIN,
        },
      });
    }
  } else {
    await prisma.user.create({
      data: {
        email: staffEmail,
        password: await bcrypt.hash(staffPassword, 10),
        role: Role.ADMIN,
        hospitalId: hospital.id,
      },
    });
  }

  console.log('Demo bootstrap complete');
  console.log(`  Hospital: ${hospital.name} (${hospital.slug})`);
  console.log(`  Demo staff: ${staffEmail}`);
  console.log('  Next: npm run demo:seed');
}

main()
  .catch((error) => {
    if (error?.code === 'ECONNREFUSED') {
      console.error(
        'Could not connect to PostgreSQL. Start the local services first with `docker compose up -d postgres redis`, then re-run `npm run demo:setup`.',
      );
      process.exitCode = 1;
      return;
    }
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
