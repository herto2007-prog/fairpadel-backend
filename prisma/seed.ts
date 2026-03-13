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

  // ═══════════════════════════════════════════════════════
  // CONFIGURACIÓN DE PUNTOS PARA RANKINGS
  // ═══════════════════════════════════════════════════════
  const configPuntos = [
    { posicion: '1ro', descripcion: 'Campeón', puntosBase: 100, orden: 1 },
    { posicion: '2do', descripcion: 'Subcampeón', puntosBase: 70, orden: 2 },
    { posicion: '3ro-4to', descripcion: 'Semifinalistas', puntosBase: 45, orden: 3 },
    { posicion: '5to-8vo', descripcion: 'Cuartos de final', puntosBase: 25, orden: 4 },
    { posicion: '9no-16to', descripcion: 'Octavos de final', puntosBase: 15, orden: 5 },
    { posicion: '17mo-32do', descripcion: 'Fase de grupos', puntosBase: 10, orden: 6 },
    { posicion: 'participacion', descripcion: 'Participación', puntosBase: 5, orden: 7 },
  ];

  for (const config of configPuntos) {
    await prisma.configuracionPuntos.upsert({
      where: { posicion: config.posicion },
      update: {},
      create: config,
    });
    console.log(`🏆 Config puntos: ${config.descripcion} = ${config.puntosBase} pts`);
  }

  // ═══════════════════════════════════════════════════════
  // REGLAS DE ASCENSO POR DEFECTO (basado en FEPARPA)
  // ═══════════════════════════════════════════════════════
  const reglasAscenso = [
    // Damas y Caballeros misma lógica
    { origen: 'Principiante', destino: '8ª Categoría', campeonatos: 3 },
    { origen: '8ª Categoría', destino: '7ª Categoría', campeonatos: 4 },
    { origen: '7ª Categoría', destino: '6ª Categoría', campeonatos: 4 },
    { origen: '6ª Categoría', destino: '5ª Categoría', campeonatos: 4 },
    { origen: '5ª Categoría', destino: '4ª Categoría', campeonatos: 3 },
    { origen: '4ª Categoría', destino: '3ª Categoría', campeonatos: 3 },
    { origen: '3ª Categoría', destino: '2ª Categoría', campeonatos: 3 },
    { origen: '2ª Categoría', destino: '1ª Categoría', campeonatos: 3 },
  ];

  for (const regla of reglasAscenso) {
    // Buscar IDs de categorías
    const catOrigen = await prisma.category.findUnique({ where: { nombre: regla.origen } });
    const catDestino = await prisma.category.findUnique({ where: { nombre: regla.destino } });
    
    if (catOrigen && catDestino) {
      await prisma.reglaAscenso.upsert({
        where: { 
          categoriaOrigenId_categoriaDestinoId: {
            categoriaOrigenId: catOrigen.id,
            categoriaDestinoId: catDestino.id,
          }
        },
        update: {},
        create: {
          categoriaOrigenId: catOrigen.id,
          categoriaDestinoId: catDestino.id,
          campeonatosRequeridos: regla.campeonatos,
          tipoConteo: 'ALTERNADOS',
          mesesVentana: 12,
        },
      });
      console.log(`⬆️  Regla ascenso: ${regla.origen} → ${regla.destino} (${regla.campeonatos} campeonatos)`);
    }
    
    // También para femenino
    const catOrigenF = await prisma.category.findUnique({ where: { nombre: `${regla.origen} Femenino` } });
    const catDestinoF = await prisma.category.findUnique({ where: { nombre: `${regla.destino} Femenina` } });
    
    if (catOrigenF && catDestinoF) {
      await prisma.reglaAscenso.upsert({
        where: { 
          categoriaOrigenId_categoriaDestinoId: {
            categoriaOrigenId: catOrigenF.id,
            categoriaDestinoId: catDestinoF.id,
          }
        },
        update: {},
        create: {
          categoriaOrigenId: catOrigenF.id,
          categoriaDestinoId: catDestinoF.id,
          campeonatosRequeridos: regla.campeonatos,
          tipoConteo: 'ALTERNADOS',
          mesesVentana: 12,
        },
      });
      console.log(`⬆️  Regla ascenso: ${catOrigenF.nombre} → ${catDestinoF.nombre} (${regla.campeonatos} campeonatos)`);
    }
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
