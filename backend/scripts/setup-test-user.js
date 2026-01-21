// backend/scripts/setup-test-user.js
// Creates test user for logging test script

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function setupTestUser() {
  console.log('🔧 Setting up test user for logging tests...\n');

  try {
    // Check if hospital exists
    let hospital = await prisma.hospital.findFirst({
      where: { slug: 'test-hospital' },
    });

    if (!hospital) {
      console.log('📍 Creating test hospital...');
      hospital = await prisma.hospital.create({
        data: {
          name: 'Test Hospital',
          slug: 'test-hospital',
          address: '123 Test St',
          city: 'TestCity',
          province: 'ON',
          postalCode: 'A1A1A1',
          phoneNumber: '555-0100',
        },
      });
      console.log(`✅ Created hospital: ${hospital.name} (ID: ${hospital.id})\n`);
    } else {
      console.log(`✅ Hospital already exists: ${hospital.name} (ID: ${hospital.id})\n`);
    }

    // Check if test user exists
    const testEmail = 'test-logger@hospital.com';
    let user = await prisma.user.findUnique({
      where: { email: testEmail },
    });

    if (user) {
      console.log(`✅ Test user already exists: ${testEmail}`);
      console.log(`   User ID: ${user.id}`);
      console.log(`   Role: ${user.role}\n`);
    } else {
      console.log('👤 Creating test user...');
      const hashedPassword = await bcrypt.hash('TestPassword123!', 10);

      user = await prisma.user.create({
        data: {
          email: testEmail,
          password: hashedPassword,
          firstName: 'Test',
          lastName: 'Logger',
          role: 'ADMIN',
          hospitalId: hospital.id,
        },
      });
      console.log(`✅ Created user: ${user.email} (ID: ${user.id})`);
      console.log(`   Password: TestPassword123!`);
      console.log(`   Role: ${user.role}\n`);
    }

    // Check if test patient exists
    let patient = await prisma.patient.findFirst({
      where: { 
        firstName: 'Test',
        lastName: 'Patient',
      },
    });

    if (!patient) {
      console.log('🏥 Creating test patient...');
      patient = await prisma.patient.create({
        data: {
          firstName: 'Test',
          lastName: 'Patient',
          dateOfBirth: new Date('1990-01-01'),
          phoneNumber: '555-0200',
          email: 'test-patient@example.com',
          address: '456 Test Ave',
          city: 'TestCity',
          province: 'ON',
          postalCode: 'B2B2B2',
          healthCardNumber: 'TEST123456',
        },
      });
      console.log(`✅ Created patient: ${patient.firstName} ${patient.lastName} (ID: ${patient.id})\n`);
    } else {
      console.log(`✅ Test patient already exists: ${patient.firstName} ${patient.lastName} (ID: ${patient.id})\n`);
    }

    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ Test setup complete!');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('\nTest Credentials:');
    console.log(`  Email:    ${testEmail}`);
    console.log(`  Password: TestPassword123!`);
    console.log(`  Hospital: ${hospital.name} (ID: ${hospital.id})`);
    console.log(`  Patient:  ${patient.firstName} ${patient.lastName} (ID: ${patient.id})`);
    console.log('\nYou can now run: npm run test:logging\n');

  } catch (error) {
    console.error('❌ Error setting up test user:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

setupTestUser();
