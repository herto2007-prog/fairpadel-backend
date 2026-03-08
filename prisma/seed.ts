import { PrismaClient, Gender } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed...');

  // Categorías del sistema paraguayo de pádel
  // Orden: Principiante (0) → 8va (1) → 7ma (2) → ... → 1ra (8)
  const categorias = [
    { nombre: 'Principiante', tipo: Gender.MASCULINO, orden: 0 },
    { nombre: '8ª Categoría', tipo: Gender.MASCULINO, orden: 1 },
    { nombre: '7ª Categoría', tipo: Gender.MASCULINO, orden: 2 },
    { nombre: '6ª Categoría', tipo: Gender.MASCULINO, orden: 3 },
    { nombre: '5ª Categoría', tipo: Gender.MASCULINO, orden: 4 },
    { nombre: '4ª Categoría', tipo: Gender.MASCULINO, orden: 5 },
    { nombre: '3ª Categoría', tipo: Gender.MASCULINO, orden: 6 },
    { nombre: '2ª Categoría', tipo: Gender.MASCULINO, orden: 7 },
    { nombre: '1ª Categoría', tipo: Gender.MASCULINO, orden: 8 },
    
    // Categorías femeninas
    { nombre: 'Principiante Femenino', tipo: Gender.FEMENINO, orden: 0 },
    { nombre: '8ª Categoría Femenina', tipo: Gender.FEMENINO, orden: 1 },
    { nombre: '7ª Categoría Femenina', tipo: Gender.FEMENINO, orden: 2 },
    { nombre: '6ª Categoría Femenina', tipo: Gender.FEMENINO, orden: 3 },
    { nombre: '5ª Categoría Femenina', tipo: Gender.FEMENINO, orden: 4 },
    { nombre: '4ª Categoría Femenina', tipo: Gender.FEMENINO, orden: 5 },
    { nombre: '3ª Categoría Femenina', tipo: Gender.FEMENINO, orden: 6 },
    { nombre: '2ª Categoría Femenina', tipo: Gender.FEMENINO, orden: 7 },
    { nombre: '1ª Categoría Femenina', tipo: Gender.FEMENINO, orden: 8 },
  ];

  for (const categoria of categorias) {
    await prisma.category.upsert({
      where: { 
        nombre: categoria.nombre 
      },
      update: {},
      create: categoria,
    });
    console.log(`✅ Categoría creada: ${categoria.nombre}`);
  }

  // Crear rol de jugador si no existe
  await prisma.role.upsert({
    where: { nombre: 'jugador' },
    update: {},
    create: {
      nombre: 'jugador',
      descripcion: 'Jugador de pádel',
    },
  });
  console.log('✅ Rol jugador creado');

  // Crear rol de admin si no existe
  await prisma.role.upsert({
    where: { nombre: 'admin' },
    update: {},
    create: {
      nombre: 'admin',
      descripcion: 'Administrador del sistema',
    },
  });
  console.log('✅ Rol admin creado');

  // Crear rol de organizador si no existe
  await prisma.role.upsert({
    where: { nombre: 'organizador' },
    update: {},
    create: {
      nombre: 'organizador',
      descripcion: 'Organizador de torneos',
    },
  });
  console.log('✅ Rol organizador creado');

  console.log('✨ Seed completado!');
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
