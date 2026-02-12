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
  console.log('🧪 Creando 96 jugadores de prueba (48M + 48F) para 24 parejas por categoría...\n');

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
  console.log('\n--- Algunos ejemplos de login ---');
  console.log('  Hombre: Doc: 2000001 | Carlos González');
  console.log('  Hombre: Doc: 2000010 | Lucas Villalba');
  console.log('  Mujer:  Doc: 3000001 | Sofía González');
  console.log('  Mujer:  Doc: 3000010 | Florencia Villalba');
  console.log('  Password para todos: test123');

  // ─── Inscribir a torneo ───

  const torneos = await prisma.tournament.findMany({
    where: {
      estado: { in: ['PUBLICADO', 'EN_CURSO'] },
    },
    include: {
      categorias: { include: { category: true } },
      modalidades: true,
    },
  });

  if (torneos.length === 0) {
    console.log('\n⚠️  No hay torneos publicados. Crea un torneo y publícalo para inscribir jugadores.');
    console.log('   Luego vuelve a correr: npx ts-node prisma/seed-test-players.ts');
    return;
  }

  const torneo = torneos[0];
  console.log(`\n🏆 Inscribiendo al torneo: "${torneo.nombre}"`);

  if (torneo.categorias.length === 0) {
    console.log('⚠️  El torneo no tiene categorías asignadas');
    return;
  }

  // Separar por género usando los datos originales
  const hombres = createdUsers.filter((_, i) => jugadores[i].genero === 'MASCULINO');
  const mujeres = createdUsers.filter((_, i) => jugadores[i].genero === 'FEMENINO');

  // Buscar categorías
  const catCaballeros = torneo.categorias.find(tc =>
    tc.category.nombre.toLowerCase().includes('caballeros') ||
    tc.category.nombre.toLowerCase().includes('masculino')
  );
  const catDamas = torneo.categorias.find(tc =>
    tc.category.nombre.toLowerCase().includes('damas') ||
    tc.category.nombre.toLowerCase().includes('femenino')
  );

  const modalidad = torneo.modalidades.length > 0
    ? torneo.modalidades[0].modalidad
    : 'TRADICIONAL';

  const monto = torneo.costoInscripcion.toNumber();
  const comision = monto * 0.05;

  async function inscribirParejas(
    players: any[],
    playerData: typeof jugadores,
    categoryId: string,
    categoryName: string,
    targetPairs: number,
  ) {
    let created = 0;

    for (let i = 0; i < players.length - 1 && created < targetPairs; i += 2) {
      const j1 = players[i];
      const j2 = players[i + 1];

      // Buscar documento del jugador 2
      const j2Data = playerData.find(j => j.documento === j2.documento);
      if (!j2Data) continue;

      // Verificar si ya existe
      const existingPareja = await prisma.pareja.findFirst({
        where: {
          jugador1Id: j1.id,
          jugador2Id: j2.id,
          inscripciones: { some: { tournamentId: torneo.id } },
        },
      });

      if (existingPareja) {
        created++; // Contar como creada para el total
        continue;
      }

      const pareja = await prisma.pareja.create({
        data: {
          jugador1Id: j1.id,
          jugador2Id: j2.id,
          jugador2Documento: j2Data.documento,
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

  // 24 parejas de caballeros
  if (catCaballeros) {
    console.log(`\n👔 Inscribiendo 24 parejas en: ${catCaballeros.category.nombre}`);
    const hombresData = jugadores.filter(j => j.genero === 'MASCULINO');
    const count = await inscribirParejas(hombres, hombresData, catCaballeros.categoryId, catCaballeros.category.nombre, 24);
    totalInscritas += count;
    console.log(`   ✅ ${count} parejas de caballeros inscritas`);
  } else {
    console.log('  ℹ️  No hay categoría de caballeros en este torneo');
  }

  // 24 parejas de damas
  if (catDamas) {
    console.log(`\n👗 Inscribiendo 24 parejas en: ${catDamas.category.nombre}`);
    const mujeresData = jugadores.filter(j => j.genero === 'FEMENINO');
    const count = await inscribirParejas(mujeres, mujeresData, catDamas.categoryId, catDamas.category.nombre, 24);
    totalInscritas += count;
    console.log(`   ✅ ${count} parejas de damas inscritas`);
  } else {
    console.log('  ℹ️  No hay categoría de damas en este torneo');
  }

  // Fallback: si no hay categorías genéricas
  if (!catCaballeros && !catDamas && torneo.categorias.length > 0) {
    const cat = torneo.categorias[0];
    console.log(`\n  ℹ️  Usando categoría genérica: ${cat.category.nombre}`);
    const count = await inscribirParejas(createdUsers, jugadores, cat.categoryId, cat.category.nombre, 24);
    totalInscritas += count;
    console.log(`   ✅ ${count} parejas inscritas`);
  }

  console.log(`\n🎉 Total: ${totalInscritas} parejas inscritas al torneo "${torneo.nombre}"`);
  if (monto > 0) {
    console.log(`💰 Pagos generados: ${totalInscritas} x $${monto} = $${totalInscritas * monto} (comisión: $${(totalInscritas * comision).toFixed(2)})`);
  }
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
