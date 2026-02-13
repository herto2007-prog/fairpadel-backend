import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// ─── Datos para generar 48 hombres y 48 mujeres ───

const nombresM = [
  'Carlos', 'Martín', 'Diego', 'Alejandro', 'Fernando', 'Gabriel', 'Sebastián', 'Nicolás',
  'Matías', 'Lucas', 'Joaquín', 'Santiago', 'Andrés', 'Rafael', 'Daniel', 'Pablo',
  'Emiliano', 'Rodrigo', 'Tomás', 'Ignacio', 'Facundo', 'Bruno', 'Maximiliano', 'Federico',
  'Agustín', 'Franco', 'Leandro', 'Gonzalo', 'Ramiro', 'Cristian', 'Marcelo', 'Hugo',
  'Óscar', 'Esteban', 'Víctor', 'Adrián', 'Julio', 'César', 'Fabián', 'Hernán',
  'Javier', 'Mauricio', 'Ricardo', 'Eduardo', 'Luis', 'Roberto', 'Alberto', 'Miguel',
];

const nombresF = [
  'Sofía', 'Valentina', 'Camila', 'Luciana', 'María', 'Isabella', 'Martina', 'Julieta',
  'Catalina', 'Florencia', 'Agustina', 'Victoria', 'Natalia', 'Carolina', 'Daniela', 'Paula',
  'Andrea', 'Romina', 'Micaela', 'Celeste', 'Antonella', 'Brenda', 'Gabriela', 'Fernanda',
  'Rocío', 'Belén', 'Mariana', 'Lorena', 'Carla', 'Silvana', 'Claudia', 'Verónica',
  'Patricia', 'Alejandra', 'Mónica', 'Sandra', 'Laura', 'Elena', 'Teresa', 'Marta',
  'Graciela', 'Noemí', 'Silvia', 'Liliana', 'Julia', 'Rosa', 'Ana', 'Estela',
];

const apellidos = [
  'González', 'López', 'Ramírez', 'Benítez', 'Giménez', 'Martínez', 'Rojas', 'Fernández',
  'Acosta', 'Villalba', 'Gómez', 'Díaz', 'Pérez', 'Torres', 'Romero', 'Álvarez',
  'Ruiz', 'Mendoza', 'Ortiz', 'Silva', 'Castro', 'Morales', 'Vargas', 'Herrera',
  'Medina', 'Flores', 'Ríos', 'Cabrera', 'Sánchez', 'Delgado', 'Vera', 'Núñez',
  'Peralta', 'Ayala', 'Cardozo', 'Espínola', 'Duarte', 'Gauto', 'Riveros', 'Aquino',
  'Barrios', 'Centurión', 'Franco', 'Lezcano', 'Ojeda', 'Paredes', 'Rolón', 'Valenzuela',
];

const ciudades = ['Asunción', 'Luque', 'San Lorenzo', 'Lambaré', 'Fernando de la Mora', 'Capiatá'];

function generarJugadores() {
  const jugadores: {
    documento: string;
    nombre: string;
    apellido: string;
    genero: 'MASCULINO' | 'FEMENINO';
    email: string;
    telefono: string;
    ciudad: string;
  }[] = [];

  // 48 hombres (docs 2000001-2000048)
  for (let i = 0; i < 48; i++) {
    const doc = `${2000001 + i}`;
    jugadores.push({
      documento: doc,
      nombre: nombresM[i],
      apellido: apellidos[i],
      genero: 'MASCULINO',
      email: `jugador.m${i + 1}@test.com`,
      telefono: `+5959820${String(i + 1).padStart(5, '0')}`,
      ciudad: ciudades[i % ciudades.length],
    });
  }

  // 48 mujeres (docs 3000001-3000048)
  for (let i = 0; i < 48; i++) {
    const doc = `${3000001 + i}`;
    jugadores.push({
      documento: doc,
      nombre: nombresF[i],
      apellido: apellidos[i],
      genero: 'FEMENINO',
      email: `jugadora.f${i + 1}@test.com`,
      telefono: `+5959830${String(i + 1).padStart(5, '0')}`,
      ciudad: ciudades[i % ciudades.length],
    });
  }

  return jugadores;
}

async function main() {
  // Aceptar tournamentId como argumento
  const tournamentId = process.argv[2];

  console.log('🧪 Creando 96 jugadores de prueba (48M + 48F)...\n');

  const passwordHash = await bcrypt.hash('test123', 10);
  const jugadores = generarJugadores();

  // Buscar rol de jugador
  const rolJugador = await prisma.role.findUnique({
    where: { nombre: 'jugador' },
  });

  if (!rolJugador) {
    console.error('❌ Rol "jugador" no encontrado. Ejecuta primero npm run seed');
    return;
  }

  const createdUsers: any[] = [];
  let nuevos = 0;
  let existentes = 0;

  for (const jugador of jugadores) {
    const existing = await prisma.user.findUnique({
      where: { documento: jugador.documento },
    });

    if (existing) {
      existentes++;
      createdUsers.push(existing);
      continue;
    }

    const user = await prisma.user.create({
      data: {
        ...jugador,
        passwordHash,
        estado: 'ACTIVO',
        emailVerificado: true,
      },
    });

    await prisma.userRole.create({
      data: {
        userId: user.id,
        roleId: rolJugador.id,
      },
    });

    createdUsers.push(user);
    nuevos++;
  }

  console.log(`✅ ${nuevos} jugadores nuevos creados, ${existentes} ya existían`);
  console.log(`📋 Total: ${createdUsers.length} jugadores listos. Password: test123`);

  // ─── Buscar torneo ───

  let torneo: any;

  if (tournamentId) {
    torneo = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        categorias: { include: { category: true } },
        modalidades: true,
      },
    });

    if (!torneo) {
      console.error(`\n❌ Torneo con ID "${tournamentId}" no encontrado.`);
      return;
    }
  } else {
    const torneos = await prisma.tournament.findMany({
      where: {
        estado: { in: ['PUBLICADO', 'EN_CURSO'] },
      },
      include: {
        categorias: { include: { category: true } },
        modalidades: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 1,
    });

    if (torneos.length === 0) {
      console.log('\n⚠️  No hay torneos publicados. Crea y publica uno primero.');
      console.log('   Uso: npx ts-node prisma/seed-test-players.ts [tournamentId]');
      return;
    }
    torneo = torneos[0];
  }

  console.log(`\n🏆 Inscribiendo al torneo: "${torneo.nombre}" (${torneo.id})`);
  console.log(`   Estado: ${torneo.estado}`);
  console.log(`   Categorías: ${torneo.categorias.length}`);

  if (torneo.categorias.length === 0) {
    console.log('⚠️  El torneo no tiene categorías asignadas');
    return;
  }

  // Separar por género
  const hombres = createdUsers.filter((_, i) => jugadores[i].genero === 'MASCULINO');
  const mujeres = createdUsers.filter((_, i) => jugadores[i].genero === 'FEMENINO');

  // Separar categorías del torneo por tipo (usando campo tipo de Category)
  const catsMasculinas = torneo.categorias.filter((tc: any) =>
    tc.category.tipo === 'MASCULINO'
  );
  const catsFemeninas = torneo.categorias.filter((tc: any) =>
    tc.category.tipo === 'FEMENINO'
  );

  console.log(`   📊 Categorías masculinas: ${catsMasculinas.length} → ${catsMasculinas.map((tc: any) => tc.category.nombre).join(', ')}`);
  console.log(`   📊 Categorías femeninas: ${catsFemeninas.length} → ${catsFemeninas.map((tc: any) => tc.category.nombre).join(', ')}`);

  const modalidad = torneo.modalidades.length > 0
    ? torneo.modalidades[0].modalidad
    : 'TRADICIONAL';

  const monto = torneo.costoInscripcion.toNumber();
  const comision = monto * 0.05;

  // Calcular parejas por categoría según jugadores disponibles
  // 48 hombres = 24 parejas total, dividir entre categorías masculinas
  // 48 mujeres = 24 parejas total, dividir entre categorías femeninas
  const parejasPerCatM = catsMasculinas.length > 0
    ? Math.floor(24 / catsMasculinas.length)
    : 0;
  const parejasPerCatF = catsFemeninas.length > 0
    ? Math.floor(24 / catsFemeninas.length)
    : 0;

  console.log(`   🎯 Parejas por categoría masculina: ${parejasPerCatM}`);
  console.log(`   🎯 Parejas por categoría femenina: ${parejasPerCatF}`);

  async function inscribirParejas(
    players: any[],
    startIdx: number,
    categoryId: string,
    targetPairs: number,
  ) {
    let created = 0;

    for (let i = startIdx; i < players.length - 1 && created < targetPairs; i += 2) {
      const j1 = players[i];
      const j2 = players[i + 1];

      // Verificar si ya existe pareja inscrita en esta categoría del torneo
      const existingInscripcion = await prisma.inscripcion.findFirst({
        where: {
          tournamentId: torneo.id,
          categoryId,
          pareja: {
            OR: [
              { jugador1Id: j1.id, jugador2Id: j2.id },
              { jugador1Id: j2.id, jugador2Id: j1.id },
            ],
          },
        },
      });

      if (existingInscripcion) {
        created++;
        continue;
      }

      const pareja = await prisma.pareja.create({
        data: {
          jugador1Id: j1.id,
          jugador2Id: j2.id,
          jugador2Documento: j2.documento,
        },
      });

      const inscripcion = await prisma.inscripcion.create({
        data: {
          tournamentId: torneo.id,
          parejaId: pareja.id,
          categoryId,
          modalidad: modalidad as any,
          estado: 'CONFIRMADA',
        },
      });

      // Crear pago si el torneo tiene costo
      if (monto > 0) {
        await prisma.pago.create({
          data: {
            inscripcionId: inscripcion.id,
            metodoPago: 'EFECTIVO',
            monto,
            comision,
            estado: 'CONFIRMADO',
            fechaPago: new Date(),
            fechaConfirm: new Date(),
          },
        });
      }

      created++;
    }

    return created;
  }

  let totalInscritas = 0;

  // Inscribir en TODAS las categorías masculinas
  let mPlayerIdx = 0;
  for (const tc of catsMasculinas) {
    console.log(`\n👔 Inscribiendo ${parejasPerCatM} parejas en: ${tc.category.nombre}`);
    const count = await inscribirParejas(hombres, mPlayerIdx, tc.categoryId, parejasPerCatM);
    totalInscritas += count;
    mPlayerIdx += parejasPerCatM * 2;
    console.log(`   ✅ ${count} parejas inscritas`);
  }

  // Inscribir en TODAS las categorías femeninas
  let fPlayerIdx = 0;
  for (const tc of catsFemeninas) {
    console.log(`\n👗 Inscribiendo ${parejasPerCatF} parejas en: ${tc.category.nombre}`);
    const count = await inscribirParejas(mujeres, fPlayerIdx, tc.categoryId, parejasPerCatF);
    totalInscritas += count;
    fPlayerIdx += parejasPerCatF * 2;
    console.log(`   ✅ ${count} parejas inscritas`);
  }

  console.log(`\n🎉 Total: ${totalInscritas} parejas inscritas al torneo "${torneo.nombre}"`);
  if (monto > 0) {
    console.log(`💰 Pagos generados: ${totalInscritas} x Gs.${monto.toLocaleString()} = Gs.${(totalInscritas * monto).toLocaleString()}`);
  }

  console.log('\n--- Login de ejemplo ---');
  console.log('  Hombre: Doc: 2000001 | Password: test123');
  console.log('  Mujer:  Doc: 3000001 | Password: test123');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
