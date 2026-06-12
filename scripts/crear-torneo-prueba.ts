/**
 * Crea un TORNEO DE PRUEBA listo para cargar resultados, sin el proceso manual.
 *
 * Hace todo de una: usuarios de prueba, torneo, categoría habilitada,
 * inscripciones CONFIRMADAS y un cuadro de eliminación directa ya "sorteado"
 * (FixtureVersion PUBLICADO + partidos enlazados). Quedás directo en la
 * pantalla de cargar resultados, y al cargar un partido el ganador avanza.
 *
 * Uso:
 *   npx ts-node scripts/crear-torneo-prueba.ts [organizadorEmailODoc] [numParejas]
 *   npx ts-node scripts/crear-torneo-prueba.ts limpiar [organizadorEmailODoc]
 *
 * Ejemplos:
 *   npx ts-node scripts/crear-torneo-prueba.ts
 *   npx ts-node scripts/crear-torneo-prueba.ts hector.velazquez@caltechagro.com 8
 *   npx ts-node scripts/crear-torneo-prueba.ts limpiar
 *
 * NOTA: escribe en la base configurada en DATABASE_URL (.env). Todos los datos
 * que crea quedan etiquetados con el prefijo "[PRUEBA]" y son borrables con
 * el modo "limpiar".
 */
import 'dotenv/config';
import { PrismaClient, Gender } from '@prisma/client';
import * as bcrypt from 'bcrypt';

// Fijar la conexión explícitamente: con el env var "pelado" Prisma puede
// terminar apuntando a la base equivocada en este proyecto.
const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

const PREFIJO = '[PRUEBA]';
const ORGANIZADOR_DEFAULT = '3439737'; // documento del organizador (Héctor)
const CATEGORIA_DEFAULT = '8ª Categoría';

function fmtFecha(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function rondaPorMatches(n: number): string {
  const mapa: Record<number, string> = {
    1: 'FINAL',
    2: 'SEMIS',
    4: 'CUARTOS',
    8: 'OCTAVOS',
    16: 'DIECISEISAVOS',
  };
  return mapa[n] || `RONDA_DE_${n}`;
}

function dbHost(): string {
  const url = process.env.DATABASE_URL || '';
  const m = url.match(/@([^/:]+)/);
  return m ? m[1] : '(desconocido)';
}

async function buscarOrganizador(idOrEmail: string) {
  const user = await prisma.user.findFirst({
    where: { OR: [{ email: idOrEmail }, { documento: idOrEmail }] },
  });
  if (!user) {
    throw new Error(
      `No encontré al organizador "${idOrEmail}". Pasá su email o documento como primer argumento.`,
    );
  }
  return user;
}

async function limpiar(idOrEmail: string) {
  const organizador = await buscarOrganizador(idOrEmail);
  const torneos = await prisma.tournament.findMany({
    where: { organizadorId: organizador.id, nombre: { startsWith: PREFIJO } },
    select: { id: true, nombre: true },
  });

  for (const t of torneos) {
    // Borrar el torneo cascada-elimina inscripciones, partidos y categorías.
    await prisma.tournament.delete({ where: { id: t.id } });
    // Las FixtureVersion no tienen FK de cascada al torneo: limpiarlas aparte.
    await prisma.fixtureVersion.deleteMany({ where: { tournamentId: t.id } });
    console.log(`🗑️  Borrado: ${t.nombre}`);
  }
  console.log(`\n✅ ${torneos.length} torneo(s) de prueba eliminado(s).`);
  console.log('   (Los usuarios de prueba PRUEBA-Jn quedan para reutilizar.)');
}

async function crear(idOrEmail: string, numParejas: number) {
  if ((numParejas & (numParejas - 1)) !== 0 || numParejas < 2) {
    throw new Error(`numParejas debe ser potencia de 2 (2, 4, 8, 16...). Recibí: ${numParejas}`);
  }

  const organizador = await buscarOrganizador(idOrEmail);
  console.log(`👤 Organizador: ${organizador.nombre} ${organizador.apellido} (${organizador.email})`);

  // Categoría
  let categoria = await prisma.category.findFirst({ where: { nombre: CATEGORIA_DEFAULT } });
  if (!categoria) {
    categoria = await prisma.category.findFirst({ where: { tipo: Gender.MASCULINO } });
  }
  if (!categoria) categoria = await prisma.category.findFirst();
  if (!categoria) throw new Error('No hay categorías en la base. Corré el seed primero.');
  console.log(`🏷️  Categoría: ${categoria.nombre}`);

  // Usuarios de prueba (upsert por documento, reutilizables)
  const numJugadores = numParejas * 2;
  const passwordHash = bcrypt.hashSync('test123', 10);
  const jugadores = [];
  for (let i = 1; i <= numJugadores; i++) {
    const documento = `PRUEBA-J${i}`;
    const jugador = await prisma.user.upsert({
      where: { documento },
      update: {},
      create: {
        documento,
        email: `prueba.j${i}@fairpadel.test`,
        password: passwordHash,
        nombre: `Jugador`,
        apellido: `Prueba ${i}`,
        genero: Gender.MASCULINO,
      },
    });
    jugadores.push(jugador);
  }
  console.log(`👥 ${numJugadores} jugadores de prueba listos (password: test123)`);

  // Torneo
  const hoy = new Date();
  const en7dias = new Date(hoy.getTime() + 7 * 24 * 60 * 60 * 1000);
  const sello = hoy.toISOString().slice(0, 16).replace('T', ' ');
  const torneo = await prisma.tournament.create({
    data: {
      nombre: `${PREFIJO} Torneo ${sello}`,
      descripcion: 'Torneo de prueba generado automáticamente para testear carga de resultados.',
      pais: 'Paraguay',
      region: 'Central',
      ciudad: 'Asunción',
      fechaInicio: fmtFecha(hoy),
      fechaFin: fmtFecha(en7dias),
      fechaLimiteInscr: fmtFecha(hoy),
      flyerUrl: '',
      estado: 'EN_CURSO',
      costoInscripcion: 0,
      organizadorId: organizador.id,
      bracketPublicado: true,
    },
  });
  console.log(`🏆 Torneo creado: ${torneo.nombre}`);

  // Habilitar la categoría en el torneo
  const totalPartidos = numParejas - 1; // eliminación directa
  const fixtureVersion = await prisma.fixtureVersion.create({
    data: {
      tournamentId: torneo.id,
      categoryId: categoria.id,
      version: 1,
      estado: 'PUBLICADO',
      definicion: { generadoPor: 'crear-torneo-prueba', rondas: [], slots: [] },
      totalPartidos,
      publicadoAt: new Date(),
    },
  });

  await prisma.tournamentCategory.create({
    data: {
      tournamentId: torneo.id,
      categoryId: categoria.id,
      inscripcionAbierta: false,
      estado: 'EN_CURSO',
      fixtureVersionId: fixtureVersion.id,
    },
  });

  // Inscripciones CONFIRMADAS (una pareja = 2 jugadores)
  const inscripciones = [];
  for (let p = 0; p < numParejas; p++) {
    const j1 = jugadores[p * 2];
    const j2 = jugadores[p * 2 + 1];
    const insc = await prisma.inscripcion.create({
      data: {
        tournamentId: torneo.id,
        categoryId: categoria.id,
        jugador1Id: j1.id,
        jugador2Id: j2.id,
        jugador2Documento: j2.documento,
        estado: 'CONFIRMADA',
        modoPago: 'COMPLETO',
      },
    });
    inscripciones.push(insc);
  }
  console.log(`📝 ${numParejas} inscripciones confirmadas`);

  // Cuadro de eliminación directa: se crea desde la FINAL hacia la primera ronda
  // para poder enlazar cada partido con su "partido siguiente".
  const totalRondas = Math.log2(numParejas);
  let siguienteRonda: { id: string }[] = [];

  for (let r = totalRondas; r >= 1; r--) {
    const numMatches = numParejas / Math.pow(2, r);
    const ronda = rondaPorMatches(numMatches);
    const creados: { id: string }[] = [];

    for (let i = 0; i < numMatches; i++) {
      const esPrimeraRonda = r === 1;
      const data: any = {
        tournamentId: torneo.id,
        categoryId: categoria.id,
        fixtureVersionId: fixtureVersion.id,
        ronda,
        numeroRonda: r,
        estado: 'PROGRAMADO',
      };

      // Enlace al partido siguiente (excepto la final)
      if (siguienteRonda.length > 0) {
        const padre = siguienteRonda[Math.floor(i / 2)];
        data.partidoSiguienteId = padre.id;
        data.posicionEnSiguiente = (i % 2) + 1;
      }

      // Solo la primera ronda arranca con parejas inscriptas
      if (esPrimeraRonda) {
        data.inscripcion1Id = inscripciones[i * 2].id;
        data.inscripcion2Id = inscripciones[i * 2 + 1].id;
        data.tipoEntrada1 = 'INSCRIPCION';
        data.tipoEntrada2 = 'INSCRIPCION';
      }

      const m = await prisma.match.create({ data });
      creados.push({ id: m.id });
    }

    siguienteRonda = creados;
  }
  console.log(`🎾 Cuadro creado: ${totalPartidos} partidos (${rondaPorMatches(numParejas / 2)} → FINAL)`);

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('✅ TORNEO DE PRUEBA LISTO');
  console.log(`   Nombre: ${torneo.nombre}`);
  console.log(`   ID:     ${torneo.id}`);
  console.log(`   Categoría: ${categoria.nombre} — ${numParejas} parejas`);
  console.log('\n   Entrá con tu cuenta de organizador, buscá el torneo con');
  console.log('   prefijo [PRUEBA] en "Mis Torneos" y cargá resultados de la');
  console.log(`   primera ronda (${rondaPorMatches(numParejas / 2)}). El ganador debe avanzar solo.`);
  console.log('═══════════════════════════════════════════════════════');
}

async function verificar(idOrEmail: string) {
  const organizador = await buscarOrganizador(idOrEmail);
  console.log(`✅ Organizador encontrado: ${organizador.nombre} ${organizador.apellido} (${organizador.email}, doc ${organizador.documento})`);

  const totalCategorias = await prisma.category.count();
  const cat = await prisma.category.findFirst({ where: { nombre: CATEGORIA_DEFAULT } });
  console.log(`✅ Categorías en la base: ${totalCategorias}. "${CATEGORIA_DEFAULT}": ${cat ? 'existe' : 'NO (se usará otra)'}`);

  const torneosPrueba = await prisma.tournament.count({
    where: { organizadorId: organizador.id, nombre: { startsWith: PREFIJO } },
  });
  console.log(`ℹ️  Torneos de prueba existentes de este organizador: ${torneosPrueba}`);
  console.log('\n✅ Verificación OK: conexión y datos listos. No se escribió nada.');
}

async function main() {
  console.log(`🔌 Base de datos: ${dbHost()}\n`);

  const args = process.argv.slice(2);

  if (args[0] === 'verificar') {
    await verificar(args[1] || ORGANIZADOR_DEFAULT);
    return;
  }

  if (args[0] === 'limpiar') {
    await limpiar(args[1] || ORGANIZADOR_DEFAULT);
    return;
  }

  const organizador = args[0] || ORGANIZADOR_DEFAULT;
  const numParejas = args[1] ? parseInt(args[1], 10) : 8;
  await crear(organizador, numParejas);
}

main()
  .catch((e) => {
    console.error('❌ Error:', e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
