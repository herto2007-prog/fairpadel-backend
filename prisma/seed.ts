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

  // ═══════════════════════════════════════════════════════
  // CONFIGURACIÓN FAIRPADEL (inicial)
  // ═══════════════════════════════════════════════════════
  const configInicial = [
    { clave: 'COMISION_POR_JUGADOR', valor: '0', descripcion: 'Comisión en Gs. que FairPadel cobra por cada jugador inscripto confirmado' },
    { clave: 'WHATSAPP_ADMIN', valor: '', descripcion: 'Número de WhatsApp para recibir comprobantes de pago' },
    { clave: 'BANCO_CUENTA', valor: '', descripcion: 'Nombre del banco para transferencias' },
    { clave: 'BANCO_NUMERO_CUENTA', valor: '', descripcion: 'Número de cuenta bancaria' },
    { clave: 'BANCO_ALIAS', valor: '', descripcion: 'Alias para transferencias (si aplica)' },
    { clave: 'BANCO_TITULAR', valor: '', descripcion: 'Nombre del titular de la cuenta' },
    { clave: 'RONDA_BLOQUEO_PAGO', valor: 'CUARTOS', descripcion: 'Ronda en la que se bloquea el torneo si no se pagó: CUARTOS, SEMIFINALES, FINAL' },
  ];

  for (const config of configInicial) {
    await prisma.fairpadelConfig.upsert({
      where: { clave: config.clave },
      update: {},
      create: config,
    });
    console.log(`⚙️  Config creada: ${config.clave}`);
  }

  // ═══════════════════════════════════════════════════════
  // CHECKLIST TEMPLATE POR DEFECTO
  // ═══════════════════════════════════════════════════════
  const checklistTemplate = await prisma.checklistTemplate.upsert({
    where: { 
      id: 'default-template-id' 
    },
    update: {},
    create: {
      id: 'default-template-id',
      nombre: 'Torneo Estándar Paraguay',
      descripcion: 'Checklist básico para organizar un torneo de pádel en Paraguay',
      esDefault: true,
      activo: true,
    },
  });
  console.log('📋 Template checklist creado');

  // Items del checklist por defecto
  const itemsTemplate = [
    {
      templateId: checklistTemplate.id,
      categoria: 'PELOTAS',
      titulo: 'Pelotas para el torneo',
      descripcion: 'Calcular cantidad necesaria según cantidad de parejas inscriptas y partidos estimados',
      orden: 1,
      esCalculado: true,
      formula: 'parejas * partidosEstimados * 3', // 3 pelotas por partido
    },
    {
      templateId: checklistTemplate.id,
      categoria: 'AUSPICIANTES',
      titulo: 'Confirmar auspiciantes',
      descripcion: 'Verificar logos, materiales publicitarios y compromisos con sponsors',
      orden: 2,
      esCalculado: false,
    },
    {
      templateId: checklistTemplate.id,
      categoria: 'PREMIOS',
      titulo: 'Premios, medallas y trofeos',
      descripcion: 'Preparar premios para 1°, 2° y 3° puesto de cada categoría',
      orden: 3,
      esCalculado: false,
    },
    {
      templateId: checklistTemplate.id,
      categoria: 'INFRAESTRUCTURA',
      titulo: 'Infraestructura de canchas',
      descripcion: 'Sillas, mesas, sombra, red en buen estado, iluminación si es nocturno',
      orden: 4,
      esCalculado: false,
    },
    {
      templateId: checklistTemplate.id,
      categoria: 'BEBIDAS',
      titulo: 'Hidratación y bebidas',
      descripcion: 'Agua, bebidas deportivas, hielo para jugadores durante el torneo',
      orden: 5,
      esCalculado: false,
    },
  ];

  for (const item of itemsTemplate) {
    await prisma.checklistTemplateItem.upsert({
      where: { 
        id: `default-${item.categoria}` 
      },
      update: {},
      create: {
        id: `default-${item.categoria}`,
        ...item,
      },
    });
    console.log(`✅ Item checklist: ${item.titulo}`);
  }

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
