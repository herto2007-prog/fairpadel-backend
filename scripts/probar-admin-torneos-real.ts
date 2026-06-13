/**
 * Red de seguridad para el refactor de admin-torneos.controller (2626 líneas).
 * Ejercita el flujo admin-driven del torneo vía la API de producción:
 * crear torneo (con sede/modalidad/categoría, comisión + checklist) →
 * inscripción manual ×2 → confirmar (recalcula comisión) → control de pagos →
 * detalle/overview → y reporta un baseline estructural desde la BD.
 *
 * Uso:
 *   npx ts-node scripts/probar-admin-torneos-real.ts correr    # flujo completo + baseline
 *   npx ts-node scripts/probar-admin-torneos-real.ts limpiar   # borra los torneos de esta prueba
 *
 * Organizador de PRUEBA (doc 99999001, password aleatoria por corrida).
 * Todos los datos llevan el prefijo "[PRUEBA-ADMIN]".
 */
import 'dotenv/config';
import { PrismaClient, Gender } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });

const PREFIJO = '[PRUEBA-ADMIN]';
const ORG_DOC = '99999001';
const API = process.env.API_BASE || 'https://api.fairpadel.com/api';
const CATEGORIA_DEFAULT = '8ª Categoría';
const NUM_PAREJAS = 2; // 4 jugadores, 2 inscripciones

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 24 * 60 * 60 * 1000);
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

async function asegurarJugadores(): Promise<string[]> {
  const hash = bcrypt.hashSync('test123', 10);
  const ids: string[] = [];
  for (let i = 1; i <= NUM_PAREJAS * 2; i++) {
    const j = await prisma.user.upsert({
      where: { documento: `PRUEBA-J${i}` },
      update: {},
      create: {
        documento: `PRUEBA-J${i}`, email: `prueba.j${i}@fairpadel.test`, password: hash,
        nombre: 'Jugador', apellido: `Prueba ${i}`, genero: Gender.MASCULINO,
      },
    });
    ids.push(j.id);
  }
  return ids;
}

async function api(metodo: string, ruta: string, token: string | null, body?: any) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${ruta}`, {
    method: metodo, headers, body: body ? JSON.stringify(body) : undefined,
  });
  const texto = await res.text();
  let json: any = null;
  try { json = texto ? JSON.parse(texto) : null; } catch { /* no-JSON */ }
  if (!res.ok) throw new Error(`${metodo} ${ruta} → HTTP ${res.status}: ${texto.slice(0, 300)}`);
  return json;
}

async function correr() {
  const { id: orgId, password } = await asegurarOrg();
  const jugadores = await asegurarJugadores();
  console.log(`👤 Organizador (doc ${ORG_DOC}) y ${jugadores.length} jugadores listos`);

  const { access_token } = await api('POST', '/auth/login', null, { documento: ORG_DOC, password });
  console.log('🔑 Login OK vía API de producción');

  // Datos del wizard
  const wizard = await api('GET', '/admin/torneos/datos/wizard', access_token);
  const categoria = wizard.categorias.find((c: any) => c.nombre === CATEGORIA_DEFAULT) || wizard.categorias[0];
  const modalidad = wizard.modalidades[0];
  const sede = (wizard.sedes || []).find((s: any) => s.nombre?.startsWith('[PRUEBA')) || wizard.sedes?.[0];
  if (!categoria || !modalidad) throw new Error('Faltan categorías o modalidades en la base');

  // Crear torneo (fechas futuras)
  const hoy = new Date();
  const torneoResp = await api('POST', '/admin/torneos', access_token, {
    nombre: `${PREFIJO} ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`,
    descripcion: 'Flujo admin-driven (red del refactor).',
    fechaInicio: fmt(addDays(hoy, 7)),
    fechaFin: fmt(addDays(hoy, 9)),
    fechaFinales: fmt(addDays(hoy, 9)),
    fechaLimiteInscripcion: fmt(addDays(hoy, 5)),
    ciudad: 'Asunción',
    costoInscripcion: 100000,
    sedeId: sede?.id,
    modalidadIds: [modalidad.id],
    categoriaIds: [categoria.id],
  });
  const torneoId = torneoResp.torneo.id;
  console.log(`🏆 Torneo creado: ${torneoResp.torneo.nombre} (estado ${torneoResp.torneo.estado})`);

  // Inscripciones manuales ×2
  const inscIds: string[] = [];
  for (let p = 0; p < NUM_PAREJAS; p++) {
    const r = await api('POST', `/admin/torneos/${torneoId}/inscripciones/manual`, access_token, {
      categoryId: categoria.id,
      jugador1Id: jugadores[p * 2],
      jugador2Id: jugadores[p * 2 + 1],
      modoPago: 'COMPLETO',
    });
    inscIds.push(r.inscripcion.id);
  }
  console.log(`📝 ${inscIds.length} inscripciones manuales creadas`);

  // Confirmar (recalcula comisión)
  for (const id of inscIds) {
    await api('PUT', `/admin/torneos/${torneoId}/inscripciones/${id}/confirmar`, access_token);
  }
  console.log('✅ Inscripciones confirmadas');

  // Control de pagos sobre la primera inscripción
  await api('POST', `/admin/torneos/${torneoId}/control-pagos`, access_token, {
    inscripcionId: inscIds[0],
    jugadorId: jugadores[0],
    monto: 100000,
    metodo: 'EFECTIVO',
    fecha: fmt(hoy),
    nota: 'Pago de prueba',
  });
  console.log('💵 Pago registrado en control de pagos');

  // Lecturas (que no exploten)
  const detalle = await api('GET', `/admin/torneos/${torneoId}/detalle`, access_token);
  const overview = await api('GET', `/admin/torneos/${torneoId}/overview`, access_token);

  // BASELINE estructural desde la BD
  const checklist = await prisma.checklistItem.count({ where: { tournamentId: torneoId } });
  const comision = await prisma.torneoComision.findUnique({ where: { tournamentId: torneoId } });
  const categorias = await prisma.tournamentCategory.count({ where: { tournamentId: torneoId } });
  const modalidades = await prisma.tournamentModalidad.count({ where: { tournamentId: torneoId } });
  const inscConfirmadas = await prisma.inscripcion.count({ where: { tournamentId: torneoId, estado: 'CONFIRMADA' } });
  const pagos = await prisma.controlPagoOrganizador.count({
    where: { inscripcion: { tournamentId: torneoId } },
  });
  const canchas = await prisma.torneoCancha.count({ where: { tournamentId: torneoId } });
  const torneoDb = await prisma.tournament.findUnique({ where: { id: torneoId } });

  console.log('\n═══════════════ BASELINE ADMIN-TORNEOS ═══════════════');
  console.log(`   Estado torneo:        ${torneoDb?.estado}`);
  console.log(`   Checklist items:      ${checklist}`);
  console.log(`   Comisión estado:      ${comision?.estado} (estimado: ${comision?.montoEstimado})`);
  console.log(`   Categorías:           ${categorias}`);
  console.log(`   Modalidades:          ${modalidades}`);
  console.log(`   Canchas copiadas:     ${canchas}`);
  console.log(`   Inscripciones CONF.:  ${inscConfirmadas}`);
  console.log(`   Control de pagos:     ${pagos}`);
  console.log(`   detalle/overview:     ${detalle?.success !== false && overview ? 'OK' : 'FALLO'}`);
  console.log('═══════════════════════════════════════════════════════');

  const ok =
    torneoDb?.estado === 'BORRADOR' &&
    checklist > 0 &&
    comision?.estado === 'PENDIENTE_PAGO' &&
    categorias === 1 &&
    modalidades === 1 &&
    inscConfirmadas === NUM_PAREJAS &&
    pagos === 1 &&
    !!overview;

  console.log(ok
    ? '\n✅ RESULTADO: flujo admin-torneos completo y consistente vía API de producción.'
    : '\n⚠️ RESULTADO: alguna métrica no coincide con lo esperado — revisar arriba.');
}

async function limpiar() {
  const torneos = await prisma.tournament.findMany({
    where: { nombre: { startsWith: PREFIJO } },
    select: { id: true, nombre: true },
  });
  for (const t of torneos) {
    await prisma.tournament.delete({ where: { id: t.id } }); // cascade borra inscripciones, comisión, checklist, etc.
    console.log(`🗑️  Borrado: ${t.nombre}`);
  }
  console.log(`✅ ${torneos.length} torneo(s) de prueba admin eliminados.`);
}

async function main() {
  const modo = process.argv[2] || 'correr';
  console.log(`🔌 DB: ${(process.env.DATABASE_URL || '').replace(/\/\/.*@/, '//***@')}\n`);
  if (modo === 'correr') return correr();
  if (modo === 'limpiar') return limpiar();
  throw new Error(`Modo desconocido: ${modo}. Usar: correr | limpiar`);
}

main()
  .catch((e) => { console.error('❌ Error:', e.message); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
