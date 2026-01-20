require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: ['query', 'error', 'warn'],
});

(async () => {
  try {
    console.log('Testing encounter creation...\n');
    
    const hospital = await prisma.hospital.findUnique({ where: { id: 3 } });
    const patient = await prisma.patientProfile.findUnique({ where: { id: 5 } });
    
    console.log('Hospital 3:', hospital ? `EXISTS (${hospital.name})` : 'NOT FOUND');
    console.log('Patient 5:', patient ? `EXISTS (${patient.firstName} ${patient.lastName})` : 'NOT FOUND');
    
    if (hospital && patient) {
      console.log('\nCreating encounter...');
      const encounter = await prisma.encounter.create({
        data: {
          status: 'EXPECTED',
          hospitalId: 3,
          patientId: 5,
          chiefComplaint: 'Test complaint',
          details: 'Test details'
        },
        include: { patient: true }
      });
      console.log('✓ SUCCESS! Encounter created:', encounter.id);
      
      // Clean up
      await prisma.encounter.delete({ where: { id: encounter.id } });
      console.log('✓ Cleaned up test encounter');
    } else {
      console.log('\n✗ Cannot create encounter - missing hospital or patient');
    }
  } catch (error) {
    console.error('\n✗ ERROR:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await prisma.$disconnect();
  }
})();
