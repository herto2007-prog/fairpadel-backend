/**
 * Red de seguridad para el refactor de programacion.service (1670 líneas).
 * Ejercita el flujo de PROGRAMACIÓN INTELIGENTE vía la API de producción:
 * crea un torneo, lo sortea (arma el cuadro), RESETEA la programación
 * automática del sorteo (desprograma + libera slots), y luego dispara
 * calcular -> aplicar, reportando un baseline estructural desde la BD.
 *
 * Por qué el reset: cerrar-y-sortear ya auto-programa los partidos y ocupa
 * slots; calcularProgramacion necesita partidos SIN programar y slots LIBRES.
 *
 * Uso:
 *   npx ts-node scripts/probar-programacion-real.ts correr    # flujo completo + baseline
 *   npx ts-node scripts/probar-programacion-real.ts limpiar   # borra los torneos de esta prueba
 *
 * Organizador de PRUEBA (doc 99999001, password aleatoria por corrida).
 * Prefijo "[PRUEBA-PROG]". Correr ANTES y DESPUÉS de tocar el core de programación.
 */
import 'dotenv/config';
import { PrismaClient, Gender } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });

const PREFIJO = '[PRUEBA-PROG]';
const ORG_DOC = '99999001';
const API = process.env.API_BASE || 'https://api.fairpadel.com/api';
const CATEGORIA_DEFAULT = '8ª Categoría';
const NUM_PAREJAS = 8;
const MINUTOS_SLOT = 90;

const fmt = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);

function proximoJueves(desde: Date): Date {
  const d = new Date(desde.getTime());
  do { d.setUTCDate(d.getUTCDate() + 1); } while (d.getUTCDay() !== 4);
  return d;
}
function fasesParaFecha(fecha: string): string {
  const [y, m, day] = fecha.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, day, 12, 0, 0)).getUTCDay();
  if (dow === 4 || dow === 5) return 'ZONA,REPECHAJE';
  if (dow === 6) return 'OCTAVOS,CUARTOS';
  if (dow === 0) return 'SEMIS,FINAL';
  return 'ZONA';
}
function slotsDelDia(horaInicio: string, horaFin: string, minutosSlot: number) {
  const [ih, im] = horaInicio.split(':').map(Number);
  const [fh, fm] = horaFin.split(':').map(Number);
  const total = fh * 60 + fm - (ih * 60 + im);
  const n = Math.ceil(total / minutosSlot);
  const res: Array<{ inicio: string; fin: string }> = [];
  for (let i = 0; i < n; i++) {
    const a = ih * 60 + im + i * minutosSlot;
    const b = Math.min(a + minutosSlot, 23 * 60 + 59);
    const f = (x: number) => `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`;
    res.push({ inicio: f(a), fin: f(b) });
  }
  return res;
}

async function asegurarOrg(): Promise<{ id: string; password: string }> {
  const password = crypto.randomBytes(12).toString('base64url');
  const hash = bcrypt.hashSync(password, 10);
  const org = await prisma.user.upsert({
    where: { documento: ORG_DOC },
    update: { password: hash, estado: 'ACTIVO' },
    create: {
      documento: ORG_DOC, email: 'prueba.organizador@fairpadel.test', password: hash,
      nombre: 'Organizador', apellido: 'Prueba Sorteo', genero: Gender.MASCULINO, estado: 'ACTIVO',
    },
  });
  const rol = await prisma.role.findUnique({ where: { nombre: 'organizador' } });
  if (!rol) throw new Error('No existe el rol organizador');
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: org.id, roleId: rol.id } },
    update: {}, create: { userId: org.id, roleId: rol.id },
  });
  return { id: org.id, password };
}

async function api(metodo: string, ruta: string, token: string, body?: any) {
  const res = await fetch(`${API}${ruta}`, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const texto = await res.text();
  let json: any = null;
  try { json = texto ? JSON.parse(texto) : null; } catch { /* no-JSON */ }
  if (!res.ok) throw new Error(`${metodo} ${ruta} → HTTP ${res.status}: ${texto.slice(0, 300)}`);
  return json;
}

interface CtxTorneo {
  torneoId: string;
  tcId: string;
  token: string;
  dispIds: string[];
  totalPartidos: number;
  fechaInicio: string;
}

// Crea org + jugadores + torneo + sede/canchas/slots, loguea y sortea (auto-programa).
async function crearTorneoSorteado(): Promise<CtxTorneo> {
  const { id: orgId, password } = await asegurarOrg();
  const categoria = await prisma.category.findFirst({ where: { nombre: CATEGORIA_DEFAULT } });
  if (!categoria) throw new Error(`No existe la categoría ${CATEGORIA_DEFAULT}`);

  // Jugadores
  const hash = bcrypt.hashSync('test123', 10);
  const jugadores = [];
  for (let i = 1; i <= NUM_PAREJAS * 2; i++) {
    jugadores.push(await prisma.user.upsert({
      where: { documento: `PRUEBA-J${i}` },
      update: {},
      create: {
        documento: `PRUEBA-J${i}`, email: `prueba.j${i}@fairpadel.test`, password: hash,
        nombre: 'Jugador', apellido: `Prueba ${i}`, genero: Gender.MASCULINO,
      },
    }));
  }
  console.log(`👤 Organizador + ${jugadores.length} jugadores listos`);

  // Torneo jue→dom con fechaFinales
  const jueves = proximoJueves(new Date());
  const dias = [0, 1, 2, 3].map(n => fmt(addDays(jueves, n)));
  const torneo = await prisma.tournament.create({
    data: {
      nombre: `${PREFIJO} ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`,
      descripcion: 'Flujo de programación inteligente (red del refactor).',
      pais: 'Paraguay', region: 'Central', ciudad: 'Asunción',
      fechaInicio: dias[0], fechaFin: dias[3], fechaFinales: dias[3],
      fechaLimiteInscr: fmt(new Date()), flyerUrl: '', estado: 'PUBLICADO',
      costoInscripcion: 0, organizadorId: orgId,
    },
  });
  const tc = await prisma.tournamentCategory.create({
    data: { tournamentId: torneo.id, categoryId: categoria.id },
  });
  for (let p = 0; p < NUM_PAREJAS; p++) {
    await prisma.inscripcion.create({
      data: {
        tournamentId: torneo.id, categoryId: categoria.id,
        jugador1Id: jugadores[p * 2].id, jugador2Id: jugadores[p * 2 + 1].id,
        jugador2Documento: jugadores[p * 2 + 1].documento,
        estado: 'CONFIRMADA', modoPago: 'COMPLETO',
      },
    });
  }
  console.log(`🏆 Torneo + ${NUM_PAREJAS} inscripciones confirmadas`);

  // Sede + 3 canchas + 4 días con slots LIBRES
  let sede = await prisma.sede.findFirst({ where: { nombre: `${PREFIJO} Sede` } });
  if (!sede) sede = await prisma.sede.create({ data: { nombre: `${PREFIJO} Sede`, ciudad: 'Asunción' } });
  const torneoCanchas = [];
  for (let c = 1; c <= 3; c++) {
    let cancha = await prisma.sedeCancha.findFirst({ where: { sedeId: sede.id, nombre: `Cancha ${c}` } });
    if (!cancha) cancha = await prisma.sedeCancha.create({ data: { sedeId: sede.id, nombre: `Cancha ${c}` } });
    torneoCanchas.push(await prisma.torneoCancha.upsert({
      where: { tournamentId_sedeCanchaId: { tournamentId: torneo.id, sedeCanchaId: cancha.id } },
      update: {}, create: { tournamentId: torneo.id, sedeCanchaId: cancha.id, orden: c },
    }));
  }
  let totalSlots = 0;
  for (const fecha of dias) {
    const dia = await prisma.torneoDisponibilidadDia.create({
      data: {
        tournamentId: torneo.id, fecha, horaInicio: '14:00', horaFin: '23:00',
        minutosSlot: MINUTOS_SLOT, fasesPermitidas: fasesParaFecha(fecha),
      },
    });
    for (const cancha of torneoCanchas) {
      for (const s of slotsDelDia('14:00', '23:00', MINUTOS_SLOT)) {
        await prisma.torneoSlot.create({
          data: { disponibilidadId: dia.id, torneoCanchaId: cancha.id, horaInicio: s.inicio, horaFin: s.fin, estado: 'LIBRE' },
        });
        totalSlots++;
      }
    }
  }
  console.log(`🏟️  Sede + 3 canchas + 4 días, ${totalSlots} slots LIBRES`);

  // Login + sorteo real (arma el cuadro; también auto-programa)
  const { access_token } = await api('POST', '/auth/login', '', { documento: ORG_DOC, password });
  await api('POST', '/admin/canchas-sorteo/cerrar-y-sortear', access_token, {
    tournamentId: torneo.id, categoriasIds: [tc.id],
  });
  const totalPartidos = await prisma.match.count({ where: { tournamentId: torneo.id } });
  console.log(`🎲 Sorteo OK — ${totalPartidos} partidos en el cuadro`);

  const dispsCtx = await prisma.torneoDisponibilidadDia.findMany({
    where: { tournamentId: torneo.id }, select: { id: true },
  });
  return { torneoId: torneo.id, tcId: tc.id, token: access_token, dispIds: dispsCtx.map(d => d.id), totalPartidos, fechaInicio: dias[0] };
}

async function correr() {
  const { torneoId, tcId, token, dispIds, totalPartidos, fechaInicio } = await crearTorneoSorteado();
  const torneo = { id: torneoId };
  const tc = { id: tcId };
  const access_token = token;
  const disps = dispIds.map(id => ({ id }));

  // RESET: desprogramar todo + liberar slots (para ejercitar calcular/aplicar limpio)
  await prisma.match.updateMany({
    where: { tournamentId: torneo.id },
    data: { fechaProgramada: null, horaProgramada: null, torneoCanchaId: null },
  });
  await prisma.torneoSlot.updateMany({
    where: { disponibilidadId: { in: disps.map(d => d.id) } },
    data: { estado: 'LIBRE' },
  });
  console.log('🧹 Reset: partidos desprogramados y slots liberados');

  // CALCULAR programación inteligente
  const calc = await api('POST', `/programacion/torneos/${torneo.id}/calcular`, access_token, {
    categoriasSorteadas: [tc.id],
    fechaInicio,
  });
  const asignaciones = (calc.distribucion || []).flatMap((d: any) => d.partidos || []);
  const bloqueantes = (calc.conflictos || []).filter((c: any) => c.severidad === 'BLOQUEANTE');
  console.log(`🧠 Calcular: ${asignaciones.length} asignaciones propuestas, ${bloqueantes.length} conflictos bloqueantes`);

  // APLICAR
  const aplicar = await api('POST', `/programacion/torneos/${torneo.id}/aplicar`, access_token, { asignaciones });

  // BASELINE desde BD
  const programados = await prisma.match.count({ where: { tournamentId: torneo.id, fechaProgramada: { not: null } } });
  const slotsOcupados = await prisma.torneoSlot.count({
    where: { disponibilidadId: { in: disps.map(d => d.id) }, estado: { not: 'LIBRE' } },
  });

  // Conflictos de pareja: mismo jugador en 2 partidos con misma fecha+hora
  const progs = await prisma.match.findMany({
    where: { tournamentId: torneo.id, fechaProgramada: { not: null } },
    include: {
      inscripcion1: { select: { jugador1Id: true, jugador2Id: true } },
      inscripcion2: { select: { jugador1Id: true, jugador2Id: true } },
    },
  });
  const ocupacion = new Map<string, number>();
  let conflictosPareja = 0;
  for (const m of progs) {
    const slotKey = `${m.fechaProgramada}|${m.horaProgramada}`;
    const jugadores = [
      m.inscripcion1?.jugador1Id, m.inscripcion1?.jugador2Id,
      m.inscripcion2?.jugador1Id, m.inscripcion2?.jugador2Id,
    ].filter(Boolean) as string[];
    for (const j of jugadores) {
      const k = `${slotKey}|${j}`;
      const prev = ocupacion.get(k) || 0;
      if (prev > 0) conflictosPareja++;
      ocupacion.set(k, prev + 1);
    }
  }

  console.log('\n═══════════════ BASELINE PROGRAMACIÓN ═══════════════');
  console.log(`   Partidos totales:        ${totalPartidos}`);
  console.log(`   Asignaciones propuestas: ${asignaciones.length}`);
  console.log(`   Partidos programados:    ${programados}`);
  console.log(`   Slots ocupados:          ${slotsOcupados}`);
  console.log(`   Conflictos bloqueantes:  ${bloqueantes.length}`);
  console.log(`   Conflictos de pareja:    ${conflictosPareja}`);
  console.log(`   Predicción suficiente:   ${calc.prediccion?.suficiente}`);
  console.log(`   aplicar.totalAsignados:  ${aplicar?.totalAsignados}`);
  console.log('══════════════════════════════════════════════════════');

  const ok = asignaciones.length > 0 && programados === asignaciones.length &&
    conflictosPareja === 0 && bloqueantes.length === 0;
  console.log(ok
    ? '\n✅ RESULTADO: calcular→aplicar consistente, sin conflictos de pareja ni bloqueantes.'
    : '\n⚠️ RESULTADO: revisar métricas arriba (puede ser baseline esperado en la 1ª corrida).');
}

// Verifica "Reprogramar agenda general" (motor predictivo): sortea, luego dispara
// reprogramar-general y revisa que se reacomode TODO el cuadro sin conflictos.
async function reprogramar() {
  const { torneoId, token, dispIds, totalPartidos } = await crearTorneoSorteado();

  // Estado tras el sorteo (ya viene auto-programado por el motor predictivo)
  const programadosAntes = await prisma.match.count({
    where: { tournamentId: torneoId, fechaProgramada: { not: null } },
  });
  console.log(`📌 Tras sorteo: ${programadosAntes}/${totalPartidos} partidos con franja`);

  // APLICAR reprogramación general (motor predictivo, incluye rondas futuras)
  const aplicado = await api('POST', `/admin/canchas-sorteo/${torneoId}/reprogramar-general`, token);
  console.log(`🔁 Aplicado: asignados=${aplicado.asignados} sinFranja=${aplicado.sinFranja}`);
  const ra = { asignados: aplicado.asignados };

  // BASELINE post-reprogramación desde BD
  const programadosDespues = await prisma.match.count({
    where: { tournamentId: torneoId, fechaProgramada: { not: null } },
  });

  // Conflictos de pareja: mismo jugador en 2 partidos a la misma fecha+hora
  const progs = await prisma.match.findMany({
    where: { tournamentId: torneoId, fechaProgramada: { not: null } },
    include: {
      inscripcion1: { select: { jugador1Id: true, jugador2Id: true } },
      inscripcion2: { select: { jugador1Id: true, jugador2Id: true } },
    },
  });
  const ocupacion = new Map<string, number>();
  let conflictosPareja = 0;
  for (const m of progs) {
    const slotKey = `${m.fechaProgramada}|${m.horaProgramada}`;
    const jugadores = [
      m.inscripcion1?.jugador1Id, m.inscripcion1?.jugador2Id,
      m.inscripcion2?.jugador1Id, m.inscripcion2?.jugador2Id,
    ].filter(Boolean) as string[];
    for (const j of jugadores) {
      const k = `${slotKey}|${j}`;
      const prev = ocupacion.get(k) || 0;
      if (prev > 0) conflictosPareja++;
      ocupacion.set(k, prev + 1);
    }
  }

  // Doble reserva de cancha: 2 partidos misma fecha+hora+cancha
  const ocupacionCancha = new Map<string, number>();
  let doblesReserva = 0;
  for (const m of progs) {
    const k = `${m.fechaProgramada}|${m.horaProgramada}|${m.torneoCanchaId}`;
    const prev = ocupacionCancha.get(k) || 0;
    if (prev > 0) doblesReserva++;
    ocupacionCancha.set(k, prev + 1);
  }

  const slotsOcupados = await prisma.torneoSlot.count({
    where: { disponibilidadId: { in: dispIds }, estado: { not: 'LIBRE' } },
  });

  console.log('\n═══════════════ BASELINE REPROGRAMACIÓN ═══════════════');
  console.log(`   Partidos totales:        ${totalPartidos}`);
  console.log(`   Programados (antes):     ${programadosAntes}`);
  console.log(`   Programados (después):   ${programadosDespues}`);
  console.log(`   asignados (API):         ${ra.asignados}`);
  console.log(`   Slots ocupados:          ${slotsOcupados}`);
  console.log(`   Conflictos de pareja:    ${conflictosPareja}`);
  console.log(`   Dobles reservas cancha:  ${doblesReserva}`);
  console.log('════════════════════════════════════════════════════════');

  const ok = programadosDespues === ra.asignados && programadosDespues === totalPartidos &&
    conflictosPareja === 0 && doblesReserva === 0 && programadosDespues > 0;
  console.log(ok
    ? '\n✅ RESULTADO: reprogramación predictiva consistente (todo el cuadro reacomodado, sin conflictos ni dobles reservas).'
    : '\n⚠️ RESULTADO: revisar métricas arriba.');
}

async function limpiar() {
  const torneos = await prisma.tournament.findMany({
    where: { nombre: { startsWith: PREFIJO } }, select: { id: true, nombre: true },
  });
  for (const t of torneos) {
    await prisma.tournament.delete({ where: { id: t.id } });
    await prisma.fixtureVersion.deleteMany({ where: { tournamentId: t.id } });
    console.log(`🗑️  Borrado: ${t.nombre}`);
  }
  console.log(`✅ ${torneos.length} torneo(s) [PRUEBA-PROG] eliminados.`);
}

async function main() {
  const modo = process.argv[2] || 'correr';
  console.log(`🔌 DB: ${(process.env.DATABASE_URL || '').replace(/\/\/.*@/, '//***@')}\n`);
  if (modo === 'correr') return correr();
  if (modo === 'reprogramar') return reprogramar();
  if (modo === 'limpiar') return limpiar();
  throw new Error(`Modo desconocido: ${modo}. Usar: correr | reprogramar | limpiar`);
}

main()
  .catch((e) => { console.error('❌ Error:', e.message); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
