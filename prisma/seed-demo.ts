import { PrismaClient, Gender } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Seed para crear 400 jugadores de prueba (200M + 200F)
 * Distribuidos en categorías para simular torneos reales
 */
async function main() {
  console.log('🌱 ==========================================');
  console.log('🌱 INICIANDO SEED DE JUGADORES DEMO');
  console.log('🌱 ==========================================');
  console.log('⏰ Fecha:', new Date().toISOString());

  // Obtener categorías existentes
  const categorias = await prisma.category.findMany({
    orderBy: { orden: 'asc' },
  });

  const categoriasMasc = categorias.filter((c) => c.tipo === 'MASCULINO');
  const categoriasFem = categorias.filter((c) => c.tipo === 'FEMENINO');

  if (categoriasMasc.length === 0 || categoriasFem.length === 0) {
    console.log('⚠️ No hay categorías suficientes. Ejecutar seed de categorías primero.');
    return;
  }

  // Verificar si ya existen jugadores demo
  const existingCount = await prisma.jugadorDemo.count();
  if (existingCount > 0) {
    console.log(`⚠️ Ya existen ${existingCount} jugadores demo. Saltando seed.`);
    return;
  }

  const jugadores = [];

  // Crear 200 jugadores masculinos
  for (let i = 1; i <= 200; i++) {
    const categoriaIndex = (i - 1) % categoriasMasc.length;
    const categoria = categoriasMasc[categoriaIndex];
    
    jugadores.push({
      nombre: `Player ${i}`,
      apellido: `Masculino ${i}`,
      documento: `DEMO-M-${String(i).padStart(5, '0')}`,
      email: `demo.m${i}@fairpadel.test`,
      telefono: `+595991${String(i).padStart(6, '0')}`,
      genero: Gender.MASCULINO,
      categoriaId: categoria.id,
    });
  }

  // Crear 200 jugadoras femeninas
  for (let i = 1; i <= 200; i++) {
    const categoriaIndex = (i - 1) % categoriasFem.length;
    const categoria = categoriasFem[categoriaIndex];
    
    jugadores.push({
      nombre: `Player ${i}`,
      apellido: `Femenino ${i}`,
      documento: `DEMO-F-${String(i).padStart(5, '0')}`,
      email: `demo.f${i}@fairpadel.test`,
      telefono: `+595992${String(i).padStart(6, '0')}`,
      genero: Gender.FEMENINO,
      categoriaId: categoria.id,
    });
  }

  // Insertar en batches de 50
  const batchSize = 50;
  for (let i = 0; i < jugadores.length; i += batchSize) {
    const batch = jugadores.slice(i, i + batchSize);
    await prisma.jugadorDemo.createMany({
      data: batch,
      skipDuplicates: true,
    });
    console.log(`  ✅ Insertados ${Math.min(i + batchSize, jugadores.length)}/${jugadores.length} jugadores`);
  }

  console.log('✅ ==========================================');
  console.log('✅ SEED COMPLETADO: 400 jugadores demo creados');
  console.log('✅ ==========================================');
}

main()
  .then(() => {
    console.log('🎉 Proceso finalizado exitosamente');
    process.exit(0);
  })
  .catch((e) => {
    console.error('❌ Error en seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
