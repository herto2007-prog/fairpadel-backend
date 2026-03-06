import { PrismaClient, RoleName, UserStatus, CategoriaTipo } from '@prisma/client';
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

  // Create categories (8 levels per gender)
  const categories = [
    // Masculino
    { nombre: '1ra Caballeros', tipo: CategoriaTipo.MASCULINO, orden: 1 },
    { nombre: '2da Caballeros', tipo: CategoriaTipo.MASCULINO, orden: 2 },
    { nombre: '3ra Caballeros', tipo: CategoriaTipo.MASCULINO, orden: 3 },
    { nombre: '4ta Caballeros', tipo: CategoriaTipo.MASCULINO, orden: 4 },
    { nombre: '5ta Caballeros', tipo: CategoriaTipo.MASCULINO, orden: 5 },
    { nombre: '6ta Caballeros', tipo: CategoriaTipo.MASCULINO, orden: 6 },
    { nombre: '7ma Caballeros', tipo: CategoriaTipo.MASCULINO, orden: 7 },
    { nombre: '8va Caballeros', tipo: CategoriaTipo.MASCULINO, orden: 8 },
    // Femenino
    { nombre: '1ra Damas', tipo: CategoriaTipo.FEMENINO, orden: 1 },
    { nombre: '2da Damas', tipo: CategoriaTipo.FEMENINO, orden: 2 },
    { nombre: '3ra Damas', tipo: CategoriaTipo.FEMENINO, orden: 3 },
    { nombre: '4ta Damas', tipo: CategoriaTipo.FEMENINO, orden: 4 },
    { nombre: '5ta Damas', tipo: CategoriaTipo.FEMENINO, orden: 5 },
    { nombre: '6ta Damas', tipo: CategoriaTipo.FEMENINO, orden: 6 },
    { nombre: '7ma Damas', tipo: CategoriaTipo.FEMENINO, orden: 7 },
    { nombre: '8va Damas', tipo: CategoriaTipo.FEMENINO, orden: 8 },
    // Mixto
    { nombre: 'Mixto A', tipo: CategoriaTipo.MIXTO, orden: 1 },
    { nombre: 'Mixto B', tipo: CategoriaTipo.MIXTO, orden: 2 },
    { nombre: 'Mixto C', tipo: CategoriaTipo.MIXTO, orden: 3 },
  ];

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { nombre: cat.nombre },
      update: {},
      create: cat,
    });
  }

  console.log(`✅ Created ${categories.length} categories`);

  console.log('\n🔑 Admin credentials:');
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
