/**
 * Red de seguridad para el refactor del SORTEO: crea un torneo PRE-SORTEO
 * (inscriptos confirmados + canchas + días con slots, SIN sortear) y luego
 * dispara el SORTEO REAL vía la API de producción (ejercitando el código
 * desplegado, incluido el guard de permisos) y lo audita.
 *
 * Uso:
 *   npx ts-node scripts/probar-sorteo-real.ts crear            # torneo pre-sorteo
 *   npx ts-node scripts/probar-sorteo-real.ts sortear          # sorteo real vía API + auditoría
 *   npx ts-node scripts/probar-sorteo-real.ts limpiar          # borra los torneos de esta prueba
 *
 * El torneo pertenece a un organizador de PRUEBA (doc 99999001) cuya
 * contraseña se regenera aleatoria en cada corrida (no es una puerta fija).
 * Todos los datos llevan el prefijo "[PRUEBA-SORTEO]".
 */
import 'dotenv/config';
import { PrismaClient, Gender } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

const PREFIJO = '[PRUEBA-SORTEO]';
const ORG_DOC = '99999001';
const API_BASE = process.env.API_BASE || 'https://api.fairpadel.com/api';
const CATEGORIA_DEFAULT = '8ª Categoría';
const NUM_PAREJAS = 8;

function fmtFecha(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 24 * 60 * 60 * 1000);
}

/** Próximo jueves estrictamente futuro (en UTC, igual que obtenerFasesParaDia). */
function proximoJueves(desde: Date): Date {
  const d = new Date(desde.getTime());
  do {
    d.setUTCDate(d.getUTCDate() + 1);
  } while (d.getUTCDay() !== 4);
  return d;
}

/** Misma regla que fases-dia.util.ts (jue/vie=Zona+Repechaje, sáb=8vos+4tos, dom=Semis+Final). */
function fasesParaFecha(fecha: string): string {
  const [y, m, day] = fecha.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, day, 12, 0, 0)).getUTCDay();
  if (dow === 4 || dow === 5) return 'ZONA,REPECHAJE';
  if (dow === 6) return 'OCTAVOS,CUARTOS';
  if (dow === 0) return 'SEMIS,FINAL';
  return 'ZONA';
}

function slotsDelDia(horaInicio: string, horaFin: string, minutosSlot: number): Array<{ inicio: string; fin: string }> {
  const [ih, im] = horaInicio.split(':').map(Number);
  const [fh, fm] = horaFin.split(':').map(Number);
  const total = fh * 60 + fm - (ih * 60 + im);
  const n = Math.ceil(total / minutosSlot);
  const res = [];
  for (let i = 0; i < n; i++) {
    const a = ih * 60 + im + i * minutosSlot;
    const b = Math.min(a + minutosSlot, 23 * 60 + 59);
    const f = (x: number) => `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`;
    res.push({ inicio: f(a), fin: f(b) });
  }
  return res;
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

async function crear() {
  const { id: orgId } = await asegurarOrganizadorPrueba();
  console.log(`👤 Organizador de prueba listo (doc ${ORG_DOC})`);

  const categoria = await prisma.category.findFirst({ where: { nombre: CATEGORIA_DEFAULT } });
  if (!categoria) throw new Error(`No existe la categoría ${CATEGORIA_DEFAULT}`);

  // Jugadores de prueba (reutiliza los PRUEBA-Jn del otro script)
  const numJugadores = NUM_PAREJAS * 2;
  const hash = bcrypt.hashSync('test123', 10);
  const jugadores = [];
  for (let i = 1; i <= numJugadores; i++) {
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
    jugadores.push(j);
  }
  console.log(`👥 ${numJugadores} jugadores listos`);

  // Fechas: próximo jueves a domingo
  const jueves = proximoJueves(new Date());
  const dias = [0, 1, 2, 3].map(n => fmtFecha(addDays(jueves, n))); // jue, vie, sáb, dom

  const torneo = await prisma.tournament.create({
    data: {
      nombre: `${PREFIJO} ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`,
      descripcion: 'Torneo pre-sorteo para probar el sorteo real (red del refactor).',
      pais: 'Paraguay',
      region: 'Central',
      ciudad: 'Asunción',
      fechaInicio: dias[0],
      fechaFin: dias[3],
      fechaLimiteInscr: fmtFecha(new Date()),
      flyerUrl: '',
      estado: 'PUBLICADO',
      costoInscripcion: 0,
      organizadorId: orgId,
    },
  });
  console.log(`🏆 Torneo: ${torneo.nombre}`);

  const tc = await prisma.tournamentCategory.create({
    data: { tournamentId: torneo.id, categoryId: categoria.id },
  });

  // 8 inscripciones CONFIRMADAS (sin sortear)
  for (let p = 0; p < NUM_PAREJAS; p++) {
    const j1 = jugadores[p * 2];
    const j2 = jugadores[p * 2 + 1];
    await prisma.inscripcion.create({
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
  }
  console.log(`📝 ${NUM_PAREJAS} inscripciones confirmadas (SIN sortear)`);

  // Sede + 3 canchas + vínculo al torneo
  let sede = await prisma.sede.findFirst({ where: { nombre: `${PREFIJO} Sede` } });
  if (!sede) {
    sede = await prisma.sede.create({
      data: { nombre: `${PREFIJO} Sede`, ciudad: 'Asunción' },
    });
  }
  const torneoCanchas = [];
  for (let c = 1; c <= 3; c++) {
    let cancha = await prisma.sedeCancha.findFirst({ where: { sedeId: sede.id, nombre: `Cancha ${c}` } });
    if (!cancha) {
      cancha = await prisma.sedeCancha.create({ data: { sedeId: sede.id, nombre: `Cancha ${c}` } });
    }
    const tcc = await prisma.torneoCancha.upsert({
      where: { tournamentId_sedeCanchaId: { tournamentId: torneo.id, sedeCanchaId: cancha.id } },
      update: {},
      create: { tournamentId: torneo.id, sedeCanchaId: cancha.id, orden: c },
    });
    torneoCanchas.push(tcc);
  }
  console.log(`🏟️  Sede + 3 canchas vinculadas`);

  // Días de juego con slots (mismo formato que genera configurarDiaJuego)
  const MINUTOS_SLOT = 90;
  let totalSlots = 0;
  for (const fecha of dias) {
    const dia = await prisma.torneoDisponibilidadDia.create({
      data: {
        tournamentId: torneo.id,
        fecha,
        horaInicio: '14:00',
        horaFin: '23:00',
        minutosSlot: MINUTOS_SLOT,
        fasesPermitidas: fasesParaFecha(fecha),
      },
    });
    for (const cancha of torneoCanchas) {
      for (const s of slotsDelDia('14:00', '23:00', MINUTOS_SLOT)) {
        await prisma.torneoSlot.create({
          data: {
            disponibilidadId: dia.id,
            torneoCanchaId: cancha.id,
            horaInicio: s.inicio,
            horaFin: s.fin,
            estado: 'LIBRE',
          },
        });
        totalSlots++;
      }
    }
  }
  console.log(`📅 4 días configurados (${dias[0]} a ${dias[3]}), ${totalSlots} slots LIBRES`);

  console.log('\n═══════════════════════════════════════════════');
  console.log('✅ TORNEO PRE-SORTEO LISTO');
  console.log(`   ID torneo:    ${torneo.id}`);
  console.log(`   ID categoría: ${tc.id}`);
  console.log(`   Siguiente:    npx ts-node scripts/probar-sorteo-real.ts sortear`);
  console.log('═══════════════════════════════════════════════');
}

async function sortear() {
  // Torneo pre-sorteo más reciente
  const torneo = await prisma.tournament.findFirst({
    where: { nombre: { startsWith: PREFIJO } },
    orderBy: { createdAt: 'desc' },
    include: { categorias: true },
  });
  if (!torneo) throw new Error('No hay torneo pre-sorteo. Corré primero el modo "crear".');
  console.log(`🏆 Torneo: ${torneo.nombre}`);

  // Password fresco para el organizador de prueba y login real
  const { password } = await asegurarOrganizadorPrueba();
  const loginRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ documento: ORG_DOC, password }),
  });
  if (!loginRes.ok) throw new Error(`Login falló: HTTP ${loginRes.status} ${await loginRes.text()}`);
  const { access_token } = await loginRes.json();
  console.log('🔑 Login OK vía API de producción');

  const auth = { 'Content-Type': 'application/json', Authorization: `Bearer ${access_token}` };

  // SORTEO REAL (el endpoint de producción, con el guard de permisos activo)
  console.log('🎲 Ejecutando cerrar-y-sortear...');
  const sorteoRes = await fetch(`${API_BASE}/admin/canchas-sorteo/cerrar-y-sortear`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      tournamentId: torneo.id,
      categoriasIds: torneo.categorias.map(c => c.id),
    }),
  });
  const sorteoBody = await sorteoRes.json();
  if (!sorteoRes.ok) {
    throw new Error(`Sorteo falló: HTTP ${sorteoRes.status} ${JSON.stringify(sorteoBody)}`);
  }
  console.log(`✅ ${sorteoBody.message || 'Sorteo OK'}`);

  // AUDITORÍA del fixture resultante
  const audRes = await fetch(`${API_BASE}/admin/canchas-sorteo/${torneo.id}/auditar`, { headers: auth });
  const aud = await audRes.json();
  const resumen = aud?.data?.resumen;
  console.log('\n📋 AUDITORÍA:', JSON.stringify(resumen));
  if (aud?.data?.problemas?.length) {
    for (const p of aud.data.problemas.slice(0, 10)) {
      console.log(`   [${p.tipo}] ${p.mensaje}`);
    }
  }

  // Resumen estructural desde la BD
  const partidos = await prisma.match.groupBy({
    by: ['ronda'],
    where: { tournamentId: torneo.id },
    _count: { id: true },
  });
  const conFecha = await prisma.match.count({ where: { tournamentId: torneo.id, fechaProgramada: { not: null } } });
  const total = await prisma.match.count({ where: { tournamentId: torneo.id } });
  console.log('\n🎾 PARTIDOS POR RONDA:', partidos.map(p => `${p.ronda}: ${p._count.id}`).join(' | '));
  console.log(`📆 Con fecha asignada: ${conFecha}/${total}`);

  const criticos = resumen?.criticos ?? -1;
  console.log(criticos === 0
    ? '\n✅ RESULTADO: sorteo real exitoso y auditoría sin críticos.'
    : `\n⚠️ RESULTADO: auditoría reporta ${criticos} problema(s) crítico(s) — revisar arriba.`);
}

async function limpiar() {
  const torneos = await prisma.tournament.findMany({
    where: { nombre: { startsWith: PREFIJO } },
    select: { id: true, nombre: true },
  });
  for (const t of torneos) {
    await prisma.tournament.delete({ where: { id: t.id } });
    await prisma.fixtureVersion.deleteMany({ where: { tournamentId: t.id } });
    console.log(`🗑️  Borrado: ${t.nombre}`);
  }
  console.log(`✅ ${torneos.length} torneo(s) de prueba de sorteo eliminados.`);
  console.log('   (Sede [PRUEBA-SORTEO], canchas y usuarios quedan para reutilizar.)');
}

async function main() {
  const modo = process.argv[2] || 'crear';
  console.log(`🔌 DB: ${(process.env.DATABASE_URL || '').replace(/\/\/.*@/, '//***@')}\n`);
  if (modo === 'crear') return crear();
  if (modo === 'sortear') return sortear();
  if (modo === 'limpiar') return limpiar();
  throw new Error(`Modo desconocido: ${modo}. Usar: crear | sortear | limpiar`);
}

main()
  .catch((e) => {
    console.error('❌ Error:', e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
