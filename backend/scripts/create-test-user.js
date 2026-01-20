// backend/scripts/create-test-user.js
// Creates a test user with known credentials

require('dotenv').config();
const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');

const connectionString = process.env.DATABASE_URL || 'postgresql://priage:priage@localhost:5432/priage';
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function createTestUsers() {
  console.log('Creating test users...\n');
  
  const password = 'password123';
  const hashedPassword = await bcrypt.hash(password, 10);
  
  try {
    // Create hospital first
    let hospital = await prisma.hospital.findFirst({ where: { slug: 'test-hospital' } });
    
    if (!hospital) {
      hospital = await prisma.hospital.create({
        data: {
          name: 'Test Hospital',
          slug: 'test-hospital',
        },
      });
      console.log('✅ Created hospital:', hospital.name);
    } else {
      console.log('✅ Hospital already exists:', hospital.name);
    }
    
    // Create test users with different roles
    const users = [
      { email: 'admin@test.com', role: 'ADMIN' },
      { email: 'doctor@test.com', role: 'DOCTOR' },
      { email: 'nurse@test.com', role: 'NURSE' },
      { email: 'staff@test.com', role: 'STAFF' },
    ];
    
    for (const userData of users) {
      const existing = await prisma.user.findUnique({
        where: { email: userData.email },
      });
      
      if (!existing) {
        const user = await prisma.user.create({
          data: {
            email: userData.email,
            password: hashedPassword,
            role: userData.role,
            hospitalId: hospital.id,
          },
        });
        console.log(`✅ Created ${user.role}: ${user.email}`);
      } else {
        console.log(`⚠️  User already exists: ${userData.email}`);
      }
    }
    
    console.log(`\n✅ Test users created successfully!`);
    console.log(`\nCredentials: any email above with password: ${password}\n`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

createTestUsers();
