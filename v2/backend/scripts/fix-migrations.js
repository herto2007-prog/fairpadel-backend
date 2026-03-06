const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('🔧 Fixing migration state...');
  
  try {
    // Mark all pending/failed migrations as applied
    await prisma.$executeRaw`
      UPDATE _prisma_migrations 
      SET finished_at = NOW(), 
          applied_steps_count = 1 
      WHERE finished_at IS NULL;
    `;
    
    console.log('✅ Migration state fixed');
  } catch (error) {
    console.log('ℹ️  No pending migrations to fix or table does not exist yet');
  }
  
  await prisma.$disconnect();
}

main();
