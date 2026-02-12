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

  // 5. Crear planes Premium
  console.log('📝 Creando planes Premium...');
  await prisma.planPremium.upsert({
    where: { nombre: 'Jugador Premium' },
    update: {},
    create: {
      nombre: 'Jugador Premium',
      tipo: 'JUGADOR',
      precioMensual: 9.99,
      precioAnual: 99.99,
      caracteristicas: JSON.stringify([
        'Mensajería privada ilimitada',
        'Estadísticas avanzadas',
        'Galería ilimitada',
        'Notificaciones SMS',
        'Sin publicidad',
      ]),
    },
  });

  await prisma.planPremium.upsert({
    where: { nombre: 'Organizador Premium' },
    update: {},
    create: {
      nombre: 'Organizador Premium',
      tipo: 'ORGANIZADOR',
      precioMensual: 29.99,
      precioAnual: 299.99,
      caracteristicas: JSON.stringify([
        'Analytics avanzados',
        'Galería por torneo',
        'Reportes descargables',
        'Simulador de torneos',
        'Soporte prioritario',
      ]),
    },
  });

  console.log('✅ Planes Premium creados');

  // 6. Crear logros
  console.log('📝 Creando logros...');
  const logros = [
    {
      nombre: 'Primer Torneo',
      descripcion: 'Juega tu primer torneo',
      icono: '🥇',
      condicion: 'torneos_jugados >= 1',
    },
    {
      nombre: 'Primera Victoria',
      descripcion: 'Gana tu primer partido',
      icono: '🏆',
      condicion: 'victorias >= 1',
    },
    {
      nombre: 'Primer Campeonato',
      descripcion: 'Gana tu primer torneo',
      icono: '👑',
      condicion: 'campeonatos >= 1',
    },
    {
      nombre: 'Racha de 5',
      descripcion: 'Gana 5 partidos consecutivos',
      icono: '🔥',
      condicion: 'racha >= 5',
    },
    {
      nombre: 'Top 10',
      descripcion: 'Entra al Top 10 de tu ciudad',
      icono: '📈',
      condicion: 'ranking_ciudad <= 10',
    },
  ];

  for (const logro of logros) {
    await prisma.logro.upsert({
      where: { nombre: logro.nombre },
      update: {},
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
      descripcion: 'Porcentaje de comisión que cobra la plataforma por cada inscripción a un torneo',
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