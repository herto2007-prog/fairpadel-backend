/**
 * Red de seguridad para el refactor del AMERICANO: ejercita el flujo COMPLETO
 * vía la API de producción (crear torneo → configurar modo → inscribir 8 →
 * cerrar inscripciones → 3 rondas con resultados → clasificación) y reporta
 * un resumen estructural (la "línea base") que debe mantenerse idéntico
 * antes y después de cada extracción del refactor.
 *
 * Uso:
 *   npx ts-node scripts/probar-americano-real.ts correr    # flujo completo + baseline
 *   npx ts-node scripts/probar-americano-real.ts limpiar   # borra los torneos de esta prueba
 *
 * El torneo pertenece al organizador de PRUEBA (doc 99999001, password
 * aleatoria por corrida) y es PRIVADO (no aparece en la lista pública).
 * Todos los datos llevan el prefijo "[PRUEBA-AMERICANO]".
 */
import 'dotenv/config';
import { PrismaClient, Gender } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

const PREFIJO = '[PRUEBA-AMERICANO]';
const ORG_DOC = '99999001';
const API_BASE = process.env.API_BASE || 'https://api.fairpadel.com/api';
const NUM_JUGADORES = 8;
const NUM_RONDAS = 3;
const ESPERA_RATE_LIMIT_MS = 3500; // validarRateLimit exige 3s entre acciones del torneo

function dormir(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

async function asegurarOrganizadorPrueba(): Promise<{ id: string; password: string }> {
  const password = crypto.randomBytes(12).toString('base64url');
  const hash = bcrypt.hashSync(password, 10);

  const org = await prisma.user.upsert({
    where: { documento: ORG_DOC },
    update: { password: hash, estado: 'ACTIVO' },
    create: {
      documento: ORG_DOC,
      email: 'prueba.organizador@fairpadel.test',
      password: hash,
      nombre: 'Organizador',
      apellido: 'Prueba Sorteo',
      genero: Gender.MASCULINO,
      estado: 'ACTIVO',
    },
  });

  const rol = await prisma.role.findUnique({ where: { nombre: 'organizador' } });
  if (!rol) throw new Error('No existe el rol organizador en la base');
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: org.id, roleId: rol.id } },
    update: {},
    create: { userId: org.id, roleId: rol.id },
  });

  return { id: org.id, password };
}

async function asegurarJugadores(): Promise<string[]> {
  const hash = bcrypt.hashSync('test123', 10);
  const ids: string[] = [];
  for (let i = 1; i <= NUM_JUGADORES; i++) {
    const j = await prisma.user.upsert({
      where: { documento: `PRUEBA-J${i}` },
      update: {},
      create: {
        documento: `PRUEBA-J${i}`,
        email: `prueba.j${i}@fairpadel.test`,
        password: hash,
        nombre: 'Jugador',
        apellido: `Prueba ${i}`,
        genero: Gender.MASCULINO,
      },
    });
    ids.push(j.id);
  }
  return ids;
}

async function llamarApi(
  metodo: string,
  ruta: string,
  token: string | null,
  body?: any,
): Promise<any> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${ruta}`, {
    method: metodo,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const texto = await res.text();
  let json: any = null;
  try { json = texto ? JSON.parse(texto) : null; } catch { /* respuesta no-JSON */ }
  if (!res.ok) {
    throw new Error(`${metodo} ${ruta} → HTTP ${res.status}: ${texto.slice(0, 300)}`);
  }
  return json;
}

async function correr() {
  // 1) Datos base (BD): organizador + 8 jugadores de prueba
  const { password } = await asegurarOrganizadorPrueba();
  const jugadoresIds = await asegurarJugadores();
  console.log(`👤 Organizador (doc ${ORG_DOC}) y ${NUM_JUGADORES} jugadores listos`);

  // 2) Login real vía API
  const { access_token } = await llamarApi('POST', '/auth/login', null, {
    documento: ORG_DOC,
    password,
  });
  console.log('🔑 Login OK vía API de producción');

  // 3) Crear torneo americano (PRIVADO para no aparecer en la app)
  const hoy = new Date().toISOString().slice(0, 10);
  const torneo = await llamarApi('POST', '/americano/torneos', access_token, {
    nombre: `${PREFIJO} ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`,
    descripcion: 'Flujo completo del americano (red del refactor).',
    fecha: hoy,
    ciudad: 'Asunción',
    visibilidad: 'privado',
    tipoInscripcion: 'individual',
  });
  console.log(`🏆 Torneo: ${torneo.nombre}`);

  // 4) Configurar modo de juego: clásico individual, puntos por games, 3 rondas
  await dormir(ESPERA_RATE_LIMIT_MS);
  await llamarApi('POST', `/americano/torneos/${torneo.id}/configurar-modo`, access_token, {
    tipoInscripcion: 'individual',
    rotacion: 'automatica',
    sistemaPuntos: 'games',
    formatoPartido: 'games',
    valorObjetivo: 6,
    categorias: 'sin',
    numRondas: String(NUM_RONDAS),
    canchasSimultaneas: 2,
    formatoAmericano: 'clasico',
  });
  console.log(`⚙️  Modo configurado: clásico individual, games a 6, ${NUM_RONDAS} rondas`);

  // 5) Reabrir inscripciones (configurar el modo las cierra automáticamente)
  await dormir(ESPERA_RATE_LIMIT_MS);
  await llamarApi('POST', `/americano/torneos/${torneo.id}/reabrir-inscripciones`, access_token);
  console.log('🔓 Inscripciones reabiertas (flujo real de la app)');

  // 6) Inscribir 8 jugadores vía API
  for (const jugadorId of jugadoresIds) {
    await llamarApi('POST', `/americano/torneos/${torneo.id}/inscribir`, access_token, { jugadorId });
  }
  console.log(`📝 ${NUM_JUGADORES} jugadores inscriptos vía API`);

  // 6) Cerrar inscripciones
  await dormir(ESPERA_RATE_LIMIT_MS);
  await llamarApi('POST', `/americano/torneos/${torneo.id}/cerrar-inscripciones`, access_token);
  console.log('🔒 Inscripciones cerradas');

  // 7) Iniciar primera ronda
  await dormir(ESPERA_RATE_LIMIT_MS);
  let rondas = await llamarApi('POST', `/americano/torneos/${torneo.id}/rondas/iniciar-primera`, access_token);
  console.log(`🎲 Ronda 1 iniciada (${rondas.length} grupo/s)`);

  // 8) Jugar las rondas: registrar resultados deterministas, finalizar, siguiente
  for (let r = 1; r <= NUM_RONDAS; r++) {
    for (const ronda of rondas) {
      for (let p = 0; p < ronda.partidos.length; p++) {
        const partido = ronda.partidos[p];
        // Resultado determinista: partidos pares gana A 6-2, impares gana B 3-6
        const sets = p % 2 === 0
          ? [{ gamesEquipoA: 6, gamesEquipoB: 2 }]
          : [{ gamesEquipoA: 3, gamesEquipoB: 6 }];
        await dormir(ESPERA_RATE_LIMIT_MS);
        await llamarApi('POST', `/americano/torneos/${torneo.id}/rondas/${ronda.id}/resultado`, access_token, {
          partidoId: partido.id,
          parejaAId: partido.parejaAId,
          parejaBId: partido.parejaBId,
          sets,
        });
      }
      await dormir(ESPERA_RATE_LIMIT_MS);
      await llamarApi('POST', `/americano/torneos/${torneo.id}/rondas/${ronda.id}/finalizar`, access_token);
      console.log(`✅ Ronda ${r}: ${ronda.partidos.length} resultados cargados y finalizada`);
    }

    if (r < NUM_RONDAS) {
      await dormir(ESPERA_RATE_LIMIT_MS);
      rondas = await llamarApi('POST', `/americano/torneos/${torneo.id}/rondas/siguiente`, access_token);
      console.log(`🎲 Ronda ${r + 1} generada (${rondas.length} grupo/s)`);
    }
  }

  // 9) Clasificación final vía API
  const clasificacion = await llamarApi('GET', `/americano/torneos/${torneo.id}/clasificacion`, access_token);

  // 10) BASELINE ESTRUCTURAL (desde la BD, números duros)
  const rondasDb = await prisma.americanoRonda.findMany({
    where: { torneoId: torneo.id },
    include: { partidos: true, parejas: true },
    orderBy: { numero: 'asc' },
  });
  const torneoFinal = await prisma.tournament.findUnique({ where: { id: torneo.id } });
  const puntajes = await prisma.americanoPuntaje.count({ where: { torneoId: torneo.id } });

  // Invariante del americano: nadie repite compañero entre rondas
  const clavesPareja = new Set<string>();
  let parejasRepetidas = 0;
  for (const ronda of rondasDb) {
    for (const pareja of ronda.parejas) {
      const clave = [pareja.jugador1Id, pareja.jugador2Id].sort().join('|');
      if (clavesPareja.has(clave)) parejasRepetidas++;
      clavesPareja.add(clave);
    }
  }

  const partidosPorRonda = rondasDb.map(r => r.partidos.length).join('|');
  const partidosFinalizados = rondasDb.reduce(
    (acc, r) => acc + r.partidos.filter(p => p.estado === 'FINALIZADO').length, 0,
  );
  const totalPartidos = rondasDb.reduce((acc, r) => acc + r.partidos.length, 0);
  const rondasFinalizadas = rondasDb.filter(r => r.estado === 'FINALIZADA').length;
  const filasClasificacion = Array.isArray(clasificacion)
    ? clasificacion.length
    : (clasificacion?.clasificacion?.length ?? clasificacion?.data?.length ?? 'desconocido');

  console.log('\n═══════════════ BASELINE AMERICANO ═══════════════');
  console.log(`   Rondas:               ${rondasDb.length} (finalizadas: ${rondasFinalizadas})`);
  console.log(`   Partidos por ronda:   ${partidosPorRonda}`);
  console.log(`   Partidos finalizados: ${partidosFinalizados}/${totalPartidos}`);
  console.log(`   Parejas por ronda:    ${rondasDb.map(r => r.parejas.length).join('|')}`);
  console.log(`   Parejas repetidas:    ${parejasRepetidas}`);
  console.log(`   Filas de puntaje:     ${puntajes}`);
  console.log(`   Filas clasificación:  ${filasClasificacion}`);
  console.log(`   Estado del torneo:    ${torneoFinal?.estado}`);
  console.log('═══════════════════════════════════════════════════');

  const ok =
    rondasDb.length === NUM_RONDAS &&
    rondasFinalizadas === NUM_RONDAS &&
    partidosFinalizados === totalPartidos &&
    totalPartidos === NUM_RONDAS * (NUM_JUGADORES / 4) &&
    parejasRepetidas === 0 &&
    torneoFinal?.estado === 'FINALIZADO';

  console.log(ok
    ? '\n✅ RESULTADO: flujo americano completo y consistente vía API de producción.'
    : '\n⚠️ RESULTADO: alguna métrica no coincide con lo esperado — revisar arriba.');
}

async function limpiar() {
  const torneos = await prisma.tournament.findMany({
    where: { nombre: { startsWith: PREFIJO } },
    select: { id: true, nombre: true },
  });
  for (const t of torneos) {
    await prisma.tournament.delete({ where: { id: t.id } }); // cascade borra grupos/rondas/partidos/puntajes
    console.log(`🗑️  Borrado: ${t.nombre}`);
  }
  console.log(`✅ ${torneos.length} torneo(s) de prueba del americano eliminados.`);
}

async function main() {
  const modo = process.argv[2] || 'correr';
  console.log(`🔌 DB: ${(process.env.DATABASE_URL || '').replace(/\/\/.*@/, '//***@')}\n`);
  if (modo === 'correr') return correr();
  if (modo === 'limpiar') return limpiar();
  throw new Error(`Modo desconocido: ${modo}. Usar: correr | limpiar`);
}

main()
  .catch((e) => {
    console.error('❌ Error:', e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
