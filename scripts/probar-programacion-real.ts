/**
 * Red de seguridad del motor de agenda/cuadro, vía la API de producción.
 * Crea un torneo de prueba, lo sortea (arma el cuadro + auto-programa) y verifica.
 *
 * Uso:
 *   npx ts-node scripts/probar-programacion-real.ts reprogramar  # reprogramar agenda (predictivo)
 *   npx ts-node scripts/probar-programacion-real.ts labels       # "Ganador/Mejor perdedor de X" en el cuadro
 *   npx ts-node scripts/probar-programacion-real.ts agenda       # agenda proyectada del jugador
 *   npx ts-node scripts/probar-programacion-real.ts limpiar      # borra los torneos de esta prueba
 *
 * Organizador de PRUEBA (doc 99999001, password aleatoria por corrida).
 * Prefijo "[PRUEBA-PROG]". Correr ANTES y DESPUÉS de tocar el core de agenda.
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
      update: { password: hash, estado: 'ACTIVO' },
      create: {
        documento: `PRUEBA-J${i}`, email: `prueba.j${i}@fairpadel.test`, password: hash,
        nombre: 'Jugador', apellido: `Prueba ${i}`, genero: Gender.MASCULINO, estado: 'ACTIVO',
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

// Verifica "Ganador de X": tras sortear, los lados sin pareja del cuadro deben
// traer un label de procedencia ("Ganador Zona 3", etc.).
async function labels() {
  const { torneoId, tcId, token } = await crearTorneoSorteado();
  const tc = await prisma.tournamentCategory.findUnique({
    where: { id: tcId }, select: { fixtureVersionId: true },
  });
  const resp = await api('GET', `/admin/bracket/${tc!.fixtureVersionId}/partidos`, token);
  const partidos: any[] = resp.partidos || [];

  // Lados vacíos (no bye) que deberían tener "Ganador de X"
  const conLadoVacio = partidos.filter(
    (p) => !p.esBye && (!p.inscripcion1 || !p.inscripcion2),
  );
  const conLabel = conLadoVacio.filter((p) => p.origen1 || p.origen2);

  console.log(`\n🏷️  Partidos con lado vacío: ${conLadoVacio.length}, con label: ${conLabel.length}`);
  conLabel.slice(0, 6).forEach((p) =>
    console.log(`   ${p.fase} ${p.orden}:  o1="${p.origen1 || '-'}"  o2="${p.origen2 || '-'}"`),
  );

  const ok = conLadoVacio.length > 0 && conLabel.length === conLadoVacio.length;
  console.log(ok
    ? '\n✅ RESULTADO: todos los lados vacíos muestran "Ganador de X".'
    : '\n⚠️ RESULTADO: hay lados vacíos sin label (revisar partidoOrigen).');
  console.log(`   (torneo de prueba ${torneoId} — corré "limpiar" al terminar)`);
}

// Verifica la AGENDA DEL JUGADOR: loguea como un jugador de prueba y revisa que
// /jugador/mi-agenda traiga próximo partido + camino "si ganás" + repechaje.
async function agenda() {
  const { torneoId } = await crearTorneoSorteado();
  const login = await api('POST', '/auth/login', '', { documento: 'PRUEBA-J1', password: 'test123' });
  const resp = await api('GET', '/jugador/mi-agenda', login.access_token);
  const data: any[] = resp.data || [];
  const ag = data.find((a) => a.torneo?.id === torneoId) || data[0];

  console.log('\n🗓️  AGENDA DE PRUEBA-J1');
  if (!ag) {
    console.log('   (sin agenda)');
  } else {
    console.log(`   Torneo: ${ag.torneo.nombre} · ${ag.categoria}`);
    const f = (n: any) => (n ? `${n.fase} ${n.programado ? `${n.fecha} ${n.hora}` : '(por confirmar)'}${n.rival ? ` vs ${n.rival}` : ''}` : '-');
    console.log(`   Próximo:   ${f(ag.proximoPartido)}`);
    ag.siGanas.forEach((n: any, i: number) => console.log(`   Si ganás ${i + 1}: ${f(n)}`));
    console.log(`   Si perdés: ${f(ag.siPerdes)}`);
  }

  const ok = !!ag && !!ag.proximoPartido && Array.isArray(ag.siGanas) && ag.siGanas.length >= 1;
  console.log(ok
    ? '\n✅ RESULTADO: la agenda del jugador trae próximo + camino si gana.'
    : '\n⚠️ RESULTADO: revisar (sin próximo o sin camino proyectado).');
  console.log(`   (torneo de prueba ${torneoId} — corré "limpiar" al terminar)`);
}

// BLINDAJE W.O.: carga un walkover en un partido de ZONA y luego reprograma.
// Verifica que el partido decidido por W.O. NO se mueve, sigue terminal y NO se borra.
async function wo() {
  const { torneoId, token } = await crearTorneoSorteado();

  // Tomar un partido de ZONA programado con ambas parejas.
  const zona = await prisma.match.findFirst({
    where: {
      tournamentId: torneoId, ronda: 'ZONA',
      inscripcion1Id: { not: null }, inscripcion2Id: { not: null },
      torneoCanchaId: { not: null }, fechaProgramada: { not: null }, horaProgramada: { not: null },
    },
  });
  if (!zona) { console.log('⚠️ No hay partido de ZONA programado'); return; }

  const slotAntes = { fecha: zona.fechaProgramada, hora: zona.horaProgramada, cancha: zona.torneoCanchaId };
  console.log(`📌 ZONA elegida ${zona.id.slice(0, 6)} en ${slotAntes.fecha} ${slotAntes.hora}`);

  // Cargar W.O. (pareja 2 no se presentó → gana pareja 1).
  await api('POST', `/admin/resultados/matches/${zona.id}/resultado-especial`, token, {
    tipo: 'WO', parejaAfectada: 2, razon: '[PRUEBA] walkover',
  });
  const trasWO = await prisma.match.findUnique({ where: { id: zona.id } });
  console.log(`🏳️  Tras W.O.: estado=${trasWO?.estado} ganador=${trasWO?.inscripcionGanadoraId ? 'sí' : 'no'}`);

  // Reprogramar toda la agenda.
  await api('POST', `/admin/canchas-sorteo/${torneoId}/reprogramar-general`, token);

  // Verificar que el partido W.O. quedó intacto.
  const despues = await prisma.match.findUnique({ where: { id: zona.id } });
  const existe = !!despues;
  const sigueTerminal = ['FINALIZADO', 'WO', 'RETIRADO', 'DESCALIFICADO'].includes(despues?.estado as string);
  const mismoSlot = !!despues &&
    despues.fechaProgramada === slotAntes.fecha &&
    despues.horaProgramada === slotAntes.hora &&
    despues.torneoCanchaId === slotAntes.cancha;

  // Doble reserva de cancha en todo el torneo tras reprogramar.
  const progs = await prisma.match.findMany({
    where: { tournamentId: torneoId, fechaProgramada: { not: null } },
    select: { fechaProgramada: true, horaProgramada: true, torneoCanchaId: true },
  });
  const ocup = new Map<string, number>();
  let dobles = 0;
  for (const m of progs) {
    const k = `${m.fechaProgramada}|${m.horaProgramada}|${m.torneoCanchaId}`;
    const prev = ocup.get(k) || 0;
    if (prev > 0) dobles++;
    ocup.set(k, prev + 1);
  }

  console.log('\n═══════════════ BLINDAJE W.O. ═══════════════');
  console.log(`   Partido W.O. existe:     ${existe}`);
  console.log(`   Sigue terminal:          ${sigueTerminal} (${despues?.estado})`);
  console.log(`   Conserva su slot:        ${mismoSlot}`);
  console.log(`   Dobles reservas cancha:  ${dobles}`);
  console.log('══════════════════════════════════════════════');

  const ok = existe && sigueTerminal && mismoSlot && dobles === 0;
  console.log(ok
    ? '\n✅ RESULTADO: el W.O. se respeta como ancla — no se movió, no se borró, sin choques.'
    : '\n❌ RESULTADO: el W.O. NO se respetó (revisar).');
  console.log(`   (torneo de prueba ${torneoId} — corré "limpiar" al terminar)`);
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
  const modo = process.argv[2] || 'reprogramar';
  console.log(`🔌 DB: ${(process.env.DATABASE_URL || '').replace(/\/\/.*@/, '//***@')}\n`);
  if (modo === 'reprogramar') return reprogramar();
  if (modo === 'labels') return labels();
  if (modo === 'agenda') return agenda();
  if (modo === 'wo') return wo();
  if (modo === 'limpiar') return limpiar();
  throw new Error(`Modo desconocido: ${modo}. Usar: reprogramar | labels | agenda | wo | limpiar`);
}

main()
  .catch((e) => { console.error('❌ Error:', e.message); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
