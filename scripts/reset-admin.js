const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  console.log('🔧 Resetting admin user...');
  
  const ADMIN_DOCUMENTO = '9999999';
  const ADMIN_PASSWORD = 'Admin123!';
  
  // Hash password
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  
  // Find any existing admin and update
  const existingAdmin = await prisma.user.findFirst({
    where: {
      roles: {
        some: {
          role: {
            name: 'admin'
          }
        }
      }
    }
  });
  
  if (existingAdmin) {
    // Update existing admin
    await prisma.user.update({
      where: { id: existingAdmin.id },
      data: {
        documento: ADMIN_DOCUMENTO,
        passwordHash: passwordHash,
        status: 'ACTIVO',
      },
    });
    console.log(`✅ Updated admin: documento = ${ADMIN_DOCUMENTO}`);
  } else {
    // Create new admin
    const adminRole = await prisma.role.findUnique({
      where: { name: 'admin' }
    });
    
    if (!adminRole) {
      console.error('❌ Admin role not found');
      process.exit(1);
    }
    
    await prisma.user.create({
      data: {
        email: 'admin@fairpadel.com',
        passwordHash: passwordHash,
        nombre: 'Admin',
        apellido: 'FairPadel',
        documento: ADMIN_DOCUMENTO,
        telefono: '0981000000',
        status: 'ACTIVO',
        roles: {
          create: {
            roleId: adminRole.id,
          },
        },
      },
    });
    console.log(`✅ Created admin: documento = ${ADMIN_DOCUMENTO}`);
  }
  
  console.log('🔑 Admin credentials:');
  console.log(`   Documento: ${ADMIN_DOCUMENTO}`);
  console.log(`   Password: ${ADMIN_PASSWORD}`);
  
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
