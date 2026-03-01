import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed...');

  // 1. Crear roles
  console.log('📝 Creando roles...');
  const roleJugador = await prisma.role.upsert({
    where: { nombre: 'jugador' },
    update: {},
    create: {
      nombre: 'jugador',
      descripcion: 'Usuario jugador estándar',
    },
  });

  const roleOrganizador = await prisma.role.upsert({
    where: { nombre: 'organizador' },
    update: {},
    create: {
      nombre: 'organizador',
      descripcion: 'Organizador de torneos',
    },
  });

  const roleAdmin = await prisma.role.upsert({
    where: { nombre: 'admin' },
    update: {},
    create: {
      nombre: 'admin',
      descripcion: 'Administrador del sistema',
    },
  });

  const roleInstructor = await prisma.role.upsert({
    where: { nombre: 'instructor' },
    update: {},
    create: {
      nombre: 'instructor',
      descripcion: 'Instructor de pádel',
    },
  });

  const roleEncargado = await prisma.role.upsert({
    where: { nombre: 'encargado' },
    update: {},
    create: {
      nombre: 'encargado',
      descripcion: 'Encargado de sede (gestion de alquileres)',
    },
  });

  console.log('✅ Roles creados');

  // 2. Crear categorías
  console.log('📝 Creando categorías...');
  const categorias = [
    { nombre: '8va Damas', tipo: 'FEMENINO', orden: 8 },
    { nombre: '7ma Damas', tipo: 'FEMENINO', orden: 7 },
    { nombre: '6ta Damas', tipo: 'FEMENINO', orden: 6 },
    { nombre: '5ta Damas', tipo: 'FEMENINO', orden: 5 },
    { nombre: '4ta Damas', tipo: 'FEMENINO', orden: 4 },
    { nombre: '3ra Damas', tipo: 'FEMENINO', orden: 3 },
    { nombre: '2da Damas', tipo: 'FEMENINO', orden: 2 },
    { nombre: '1ra Damas', tipo: 'FEMENINO', orden: 1 },
    { nombre: '8va Caballeros', tipo: 'MASCULINO', orden: 8 },
    { nombre: '7ma Caballeros', tipo: 'MASCULINO', orden: 7 },
    { nombre: '6ta Caballeros', tipo: 'MASCULINO', orden: 6 },
    { nombre: '5ta Caballeros', tipo: 'MASCULINO', orden: 5 },
    { nombre: '4ta Caballeros', tipo: 'MASCULINO', orden: 4 },
    { nombre: '3ra Caballeros', tipo: 'MASCULINO', orden: 3 },
    { nombre: '2da Caballeros', tipo: 'MASCULINO', orden: 2 },
    { nombre: '1ra Caballeros', tipo: 'MASCULINO', orden: 1 },
  ];

  for (const cat of categorias) {
    await prisma.category.upsert({
      where: { nombre: cat.nombre },
      update: {},
      create: cat as any,
    });
  }

  console.log('✅ Categorías creadas');

  // 3. Crear usuario admin
  console.log('📝 Creando usuario admin...');
  const passwordHash = await bcrypt.hash('admin123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@fairpadel.com' },
    update: {},
    create: {
      documento: '9999999',
      nombre: 'Admin',
      apellido: 'FairPadel',
      genero: 'MASCULINO',
      email: 'admin@fairpadel.com',
      telefono: '+595981999999',
      passwordHash,
      estado: 'ACTIVO',
      emailVerificado: true,
      esPremium: true,
      ciudad: 'Asunción',
    },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: admin.id,
        roleId: roleAdmin.id,
      },
    },
    update: {},
    create: {
      userId: admin.id,
      roleId: roleAdmin.id,
    },
  });

  console.log('✅ Usuario admin creado');
  console.log('   Email: admin@fairpadel.com');
  console.log('   Password: admin123');

  // 4. Crear configuración de puntos para rankings
  console.log('📝 Creando configuración de puntos...');
  const configuracionPuntos = [
    { posicion: 'CAMPEON', puntosBase: 100, multiplicador: 1.0 },
    { posicion: 'FINALISTA', puntosBase: 60, multiplicador: 1.0 },
    { posicion: 'SEMIFINALISTA', puntosBase: 35, multiplicador: 1.0 },
    { posicion: 'CUARTOS', puntosBase: 15, multiplicador: 1.0 },
    { posicion: 'OCTAVOS', puntosBase: 8, multiplicador: 1.0 },
    { posicion: 'PRIMERA_RONDA', puntosBase: 3, multiplicador: 1.0 },
  ];

  for (const config of configuracionPuntos) {
    await prisma.configuracionPuntos.upsert({
      where: { posicion: config.posicion },
      update: {},
      create: config,
    });
  }

  console.log('✅ Configuración de puntos creada');

  // 5. Crear plan Premium único
  console.log('📝 Creando plan Premium...');
  // Limpiar planes viejos
  await prisma.planPremium.deleteMany({
    where: { nombre: { in: ['Jugador Premium', 'Organizador Premium'] } },
  });
  await prisma.planPremium.upsert({
    where: { nombre: 'FairPadel Premium' },
    update: {
      precioMensual: 2.99,
      caracteristicas: JSON.stringify([
        'Perfil Verificado con badge exclusivo',
        'Badges y logros exclusivos premium',
        'Alertas personalizadas (torneos, rivales, ranking)',
        'Resumen semanal por email con estadísticas',
        'Notificaciones SMS',
        'Estadísticas avanzadas',
        'Exportar estadísticas',
        'Match inteligente (solicitudes de juego)',
        'Torneos ilimitados (organizadores)',
        'Categorías ilimitadas (organizadores)',
        'Ayudantes y árbitros (organizadores)',
        'Arbitraje en vivo (organizadores)',
        'Re-sorteo y reprogramar partidos (organizadores)',
        'Swap de horarios (organizadores)',
        'Dashboard premium con métricas (organizadores)',
        'Reportes exportables (organizadores)',
      ]),
    },
    create: {
      nombre: 'FairPadel Premium',
      tipo: 'UNICO',
      precioMensual: 2.99,
      caracteristicas: JSON.stringify([
        'Perfil Verificado con badge exclusivo',
        'Badges y logros exclusivos premium',
        'Alertas personalizadas (torneos, rivales, ranking)',
        'Resumen semanal por email con estadísticas',
        'Notificaciones SMS',
        'Estadísticas avanzadas',
        'Exportar estadísticas',
        'Match inteligente (solicitudes de juego)',
        'Torneos ilimitados (organizadores)',
        'Categorías ilimitadas (organizadores)',
        'Ayudantes y árbitros (organizadores)',
        'Arbitraje en vivo (organizadores)',
        'Re-sorteo y reprogramar partidos (organizadores)',
        'Swap de horarios (organizadores)',
        'Dashboard premium con métricas (organizadores)',
        'Reportes exportables (organizadores)',
      ]),
    },
  });

  console.log('✅ Plan Premium creado');

  // 6. Crear logros
  console.log('📝 Creando logros...');
  const logros = [
    // === Categoría: torneo ===
    {
      nombre: 'Primer Torneo',
      descripcion: 'Inscribite en tu primer torneo',
      icono: 'Trophy',
      condicion: 'inscripciones_confirmadas >= 1',
      categoria: 'torneo',
      requierePremium: false,
      orden: 1,
    },
    {
      nombre: 'Primera Victoria',
      descripcion: 'Ganá tu primer partido',
      icono: 'Star',
      condicion: 'victorias >= 1',
      categoria: 'torneo',
      requierePremium: false,
      orden: 2,
    },
    {
      nombre: 'Primer Campeonato',
      descripcion: 'Ganá la final de un torneo',
      icono: 'Crown',
      condicion: 'campeonatos >= 1',
      categoria: 'torneo',
      requierePremium: false,
      orden: 3,
    },
    {
      nombre: 'Ascenso',
      descripcion: 'Ascendé de categoría por primera vez',
      icono: 'TrendingUp',
      condicion: 'ascensos >= 1',
      categoria: 'torneo',
      requierePremium: false,
      orden: 4,
    },
    {
      nombre: 'Veterano',
      descripcion: 'Jugá en 10 torneos diferentes',
      icono: 'Shield',
      condicion: 'torneos_distintos >= 10',
      categoria: 'torneo',
      requierePremium: false,
      orden: 5,
    },
    {
      nombre: 'Leyenda',
      descripcion: 'Jugá en 25 torneos diferentes',
      icono: 'Swords',
      condicion: 'torneos_distintos >= 25',
      categoria: 'torneo',
      requierePremium: true,
      orden: 6,
    },
    // === Categoría: racha ===
    {
      nombre: 'Racha de 3',
      descripcion: 'Ganá 3 partidos consecutivos',
      icono: 'Flame',
      condicion: 'racha_actual >= 3',
      categoria: 'racha',
      requierePremium: false,
      orden: 7,
    },
    {
      nombre: 'Racha de 5',
      descripcion: 'Ganá 5 partidos consecutivos',
      icono: 'Zap',
      condicion: 'racha_actual >= 5',
      categoria: 'racha',
      requierePremium: true,
      orden: 8,
    },
    {
      nombre: 'Racha de 10',
      descripcion: 'Ganá 10 partidos consecutivos',
      icono: 'Sparkles',
      condicion: 'racha_actual >= 10',
      categoria: 'racha',
      requierePremium: true,
      orden: 9,
    },
    {
      nombre: 'Invicto',
      descripcion: 'Ganá un torneo sin perder un solo set',
      icono: 'ShieldCheck',
      condicion: 'campeonato_sin_perder_set',
      categoria: 'racha',
      requierePremium: true,
      orden: 10,
    },
    // === Categoría: ranking ===
    {
      nombre: 'Top 10',
      descripcion: 'Llegá al Top 10 del ranking',
      icono: 'Medal',
      condicion: 'posicion_ranking <= 10',
      categoria: 'ranking',
      requierePremium: false,
      orden: 11,
    },
    {
      nombre: 'Top 3',
      descripcion: 'Llegá al Top 3 del ranking',
      icono: 'Award',
      condicion: 'posicion_ranking <= 3',
      categoria: 'ranking',
      requierePremium: true,
      orden: 12,
    },
    {
      nombre: 'Numero 1',
      descripcion: 'Llegá al puesto #1 del ranking',
      icono: 'Crown',
      condicion: 'posicion_ranking == 1',
      categoria: 'ranking',
      requierePremium: true,
      orden: 13,
    },
    // === Categoría: social ===
    {
      nombre: 'Social',
      descripcion: 'Conseguí 10 seguidores',
      icono: 'Users',
      condicion: 'seguidores >= 10',
      categoria: 'social',
      requierePremium: false,
      orden: 14,
    },
    {
      nombre: 'Influencer',
      descripcion: 'Conseguí 50 seguidores',
      icono: 'Heart',
      condicion: 'seguidores >= 50',
      categoria: 'social',
      requierePremium: true,
      orden: 15,
    },
  ];

  for (const logro of logros) {
    await prisma.logro.upsert({
      where: { nombre: logro.nombre },
      update: {
        descripcion: logro.descripcion,
        icono: logro.icono,
        condicion: logro.condicion,
        categoria: logro.categoria,
        requierePremium: logro.requierePremium,
        orden: logro.orden,
      },
      create: logro,
    });
  }

  console.log('✅ Logros creados');

  // 7. Configuración del sistema
  console.log('📝 Creando configuración del sistema...');
  const configuraciones = [
    {
      clave: 'COMISION_INSCRIPCION',
      valor: '5',
      descripcion: 'Porcentaje de comisión que cobra la plataforma por cada inscripción a un torneo (legacy)',
    },
    {
      clave: 'COMISION_FIJA_POR_JUGADOR',
      valor: '5000',
      descripcion: 'Monto fijo en Guaraníes que cobra la plataforma por cada jugador inscrito a un torneo',
    },
    {
      clave: 'ASCENSOS_REQUIEREN_APROBACION',
      valor: 'true',
      descripcion: 'Cuando está activo, los ascensos automáticos requieren aprobación de un administrador antes de hacerse efectivos',
    },
    {
      clave: 'SMS_COSTO_UNITARIO',
      valor: '250',
      descripcion: 'Costo estimado por SMS en Guaranies (Tigo Business)',
    },
  ];

  for (const config of configuraciones) {
    await prisma.configuracionSistema.upsert({
      where: { clave: config.clave },
      update: {},
      create: config,
    });
  }

  console.log('✅ Configuración del sistema creada');

  // 8. Reglas de ascenso por categoría
  console.log('📝 Creando reglas de ascenso...');
  const reglasAscenso = [
    // { origen orden, destino orden, consecutivos, alternados }
    { origenOrden: 8, destinoOrden: 7, consecutivos: 1, alternados: 1 },
    { origenOrden: 7, destinoOrden: 6, consecutivos: 3, alternados: 4 },
    { origenOrden: 6, destinoOrden: 5, consecutivos: 5, alternados: 5 },
    { origenOrden: 5, destinoOrden: 4, consecutivos: 5, alternados: 6 },
    { origenOrden: 4, destinoOrden: 3, consecutivos: 5, alternados: 7 },
    { origenOrden: 3, destinoOrden: 2, consecutivos: 6, alternados: 8 },
    { origenOrden: 2, destinoOrden: 1, consecutivos: 7, alternados: 10 },
  ];

  for (const genero of ['MASCULINO', 'FEMENINO'] as const) {
    for (const regla of reglasAscenso) {
      const catOrigen = await prisma.category.findFirst({
        where: { tipo: genero, orden: regla.origenOrden },
      });
      const catDestino = await prisma.category.findFirst({
        where: { tipo: genero, orden: regla.destinoOrden },
      });
      if (catOrigen && catDestino) {
        await prisma.reglaAscenso.upsert({
          where: {
            categoriaOrigenId_categoriaDestinoId: {
              categoriaOrigenId: catOrigen.id,
              categoriaDestinoId: catDestino.id,
            },
          },
          update: {},
          create: {
            categoriaOrigenId: catOrigen.id,
            categoriaDestinoId: catDestino.id,
            campeonatosConsecutivos: regla.consecutivos,
            campeonatosAlternados: regla.alternados,
            finalistaCalifica: false,
            activa: true,
          },
        });
      }
    }
  }
  console.log('✅ Reglas de ascenso creadas (14 reglas: 7 Caballeros + 7 Damas)');

  // 9. Asignar categoría default a usuarios existentes sin categoría
  console.log('📝 Asignando categorías a usuarios existentes...');
  const usersWithoutCategory = await prisma.user.findMany({
    where: { categoriaActualId: null },
    select: { id: true, genero: true },
  });

  for (const u of usersWithoutCategory) {
    const defaultCat = await prisma.category.findFirst({
      where: { tipo: u.genero, orden: 8 },
    });
    if (defaultCat) {
      await prisma.user.update({
        where: { id: u.id },
        data: { categoriaActualId: defaultCat.id },
      });
      await prisma.historialCategoria.create({
        data: {
          userId: u.id,
          categoriaNuevaId: defaultCat.id,
          tipo: 'ASIGNACION_INICIAL',
          motivo: 'Categoría asignada automáticamente (migración)',
        },
      });
    }
  }
  console.log(`✅ ${usersWithoutCategory.length} usuarios actualizados con categoría default`);

  console.log('🎉 Seed completado exitosamente!');
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });