import { PrismaClient, Gender, TipoCategoria } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seed de categorías mixtas y sumas...');

  // Buscar categorías standard para referenciar en reglas
  const cats = await prisma.category.findMany();
  const findCat = (nombre: string) => cats.find(c => c.nombre === nombre);

  // ═══════════════════════════════════════════════════════════
  // CATEGORÍAS MIXTAS
  // ═══════════════════════════════════════════════════════════
  const mixtas = [
    { nombre: 'Mixta D8ª+C8ª', dama: '8ª Categoría Femenina', caballero: '8ª Categoría' },
    { nombre: 'Mixta D7ª+C7ª', dama: '7ª Categoría Femenina', caballero: '7ª Categoría' },
    { nombre: 'Mixta D6ª+C7ª', dama: '6ª Categoría Femenina', caballero: '7ª Categoría' },
    { nombre: 'Mixta D5ª+C6ª', dama: '5ª Categoría Femenina', caballero: '6ª Categoría' },
    { nombre: 'Mixta D4ª+C5ª', dama: '4ª Categoría Femenina', caballero: '5ª Categoría' },
  ];

  for (const mix of mixtas) {
    const damaCat = findCat(mix.dama);
    const cabCat = findCat(mix.caballero);

    if (!damaCat || !cabCat) {
      console.warn(`⚠️ No se encontraron categorías para ${mix.nombre}`);
      continue;
    }

    await prisma.category.upsert({
      where: { nombre: mix.nombre },
      update: {
        tipoCategoria: TipoCategoria.MIXTO,
        reglas: { damaCategoriaId: damaCat.id, caballeroCategoriaId: cabCat.id },
      },
      create: {
        nombre: mix.nombre,
        tipo: Gender.MASCULINO,
        orden: 100,
        tipoCategoria: TipoCategoria.MIXTO,
        reglas: { damaCategoriaId: damaCat.id, caballeroCategoriaId: cabCat.id },
      },
    });
    console.log(`✅ Mixta creada: ${mix.nombre}`);
  }

  // ═══════════════════════════════════════════════════════════
  // CATEGORÍAS SUMAS
  // ═══════════════════════════════════════════════════════════
  const sumasObjetivos = [5, 7, 9, 11, 13];
  const generosSumas = [
    { label: 'Caballeros', tipo: Gender.MASCULINO },
    { label: 'Damas', tipo: Gender.FEMENINO },
  ];

  for (const genero of generosSumas) {
    for (const objetivo of sumasObjetivos) {
      const nombre = `Suma ${objetivo} ${genero.label}`;
      await prisma.category.upsert({
        where: { nombre },
        update: {
          tipoCategoria: TipoCategoria.SUMAS,
          reglas: { sumaObjetivo: objetivo },
        },
        create: {
          nombre,
          tipo: genero.tipo,
          orden: 200 + objetivo,
          tipoCategoria: TipoCategoria.SUMAS,
          reglas: { sumaObjetivo: objetivo },
        },
      });
      console.log(`✅ Suma creada: ${nombre}`);
    }
  }

  console.log('🎉 Seed completado');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
