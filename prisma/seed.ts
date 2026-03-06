import { PrismaClient, RoleName, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // Create roles
  const roles = await Promise.all([
    prisma.role.upsert({
      where: { name: RoleName.jugador },
      update: {},
      create: { name: RoleName.jugador },
    }),
    prisma.role.upsert({
      where: { name: RoleName.organizador },
      update: {},
      create: { name: RoleName.organizador },
    }),
    prisma.role.upsert({
      where: { name: RoleName.admin },
      update: {},
      create: { name: RoleName.admin },
    }),
  ]);

  console.log(`✅ Created ${roles.length} roles`);

  // Create admin user with documento ADMIN001
  const adminPassword = await bcrypt.hash('Admin123!', 10);
  
  const admin = await prisma.user.upsert({
    where: { documento: 'ADMIN001' },
    update: {},
    create: {
      email: 'admin@fairpadel.com',
      passwordHash: adminPassword,
      nombre: 'Admin',
      apellido: 'FairPadel',
      documento: 'ADMIN001',
      telefono: '0981000000',
      status: UserStatus.ACTIVO,
      roles: {
        create: {
          role: {
            connect: { name: RoleName.admin },
          },
        },
      },
    },
  });

  console.log(`✅ Created admin user: ${admin.nombre} ${admin.apellido}`);
  console.log('🔑 Admin credentials:');
  console.log('   Documento: ADMIN001');
  console.log('   Password: Admin123!');

  console.log('\n🎉 Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
