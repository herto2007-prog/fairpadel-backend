/**
 * Verificación del fix de IDOR en admin-torneos (seguridad-4).
 * Un organizador "intruso" NO debe poder acceder a los endpoints de gestión
 * de un torneo ajeno: TorneoGestionGuard debe responder 403.
 *
 * Flujo (vía API de producción):
 *   - Org A (dueño, doc 99999001) crea un torneo [PRUEBA-IDOR].
 *   - Org A accede a un set de endpoints representativos de cada controller → espera 2xx.
 *   - Org B (intruso, doc 99999002) accede a los mismos → espera 403.
 *   - Escrituras destructivas del intruso (PUT publicar, DELETE torneo) → espera 403.
 *   - Limpia el torneo de prueba.
 *
 * Uso:
 *   npx ts-node scripts/probar-idor-admin-torneos.ts correr
 *   npx ts-node scripts/probar-idor-admin-torneos.ts limpiar
 */
import 'dotenv/config';
import { PrismaClient, Gender } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });

const PREFIJO = '[PRUEBA-IDOR]';
const ORG_A_DOC = '99999001'; // dueño (reusa el org del harness de admin-torneos)
const ORG_B_DOC = '99999002'; // intruso
const API = process.env.API_BASE || 'https://api.fairpadel.com/api';
const CATEGORIA_DEFAULT = '8ª Categoría';

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 24 * 60 * 60 * 1000);
}

async function asegurarOrg(documento: string, email: string, apellido: string): Promise<{ id: string; password: string }> {
  const password = crypto.randomBytes(12).toString('base64url');
  const hash = bcrypt.hashSync(password, 10);
  const org = await prisma.user.upsert({
    where: { documento },
    update: { password: hash, estado: 'ACTIVO' },
    create: {
      documento, email, password: hash,
      nombre: 'Organizador', apellido, genero: Gender.MASCULINO, estado: 'ACTIVO',
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

// Devuelve {status, json} sin lanzar (para poder esperar 403).
async function apiRaw(metodo: string, ruta: string, token: string | null, body?: any) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${ruta}`, {
    method: metodo, headers, body: body ? JSON.stringify(body) : undefined,
  });
  const texto = await res.text();
  let json: any = null;
  try { json = texto ? JSON.parse(texto) : null; } catch { /* no-JSON */ }
  return { status: res.status, json };
}

async function login(documento: string, password: string): Promise<string> {
  const { status, json } = await apiRaw('POST', '/auth/login', null, { documento, password });
  if (status !== 200 && status !== 201) throw new Error(`Login ${documento} → HTTP ${status}`);
  return json.access_token;
}

async function correr() {
  const a = await asegurarOrg(ORG_A_DOC, 'prueba.organizador@fairpadel.test', 'Prueba Sorteo');
  const b = await asegurarOrg(ORG_B_DOC, 'prueba.intruso@fairpadel.test', 'Intruso IDOR');
  console.log(`👤 Org A dueño (doc ${ORG_A_DOC}) y Org B intruso (doc ${ORG_B_DOC}) listos`);

  const tokenA = await login(ORG_A_DOC, a.password);
  const tokenB = await login(ORG_B_DOC, b.password);
  console.log('🔑 Login de ambos OK vía API de producción');

  // Org A crea un torneo
  const wizard = await apiRaw('GET', '/admin/torneos/datos/wizard', tokenA);
  const categoria = wizard.json.categorias.find((c: any) => c.nombre === CATEGORIA_DEFAULT) || wizard.json.categorias[0];
  const modalidad = wizard.json.modalidades[0];
  const sede = (wizard.json.sedes || []).find((s: any) => s.nombre?.startsWith('[PRUEBA')) || wizard.json.sedes?.[0];
  const hoy = new Date();
  const crear = await apiRaw('POST', '/admin/torneos', tokenA, {
    nombre: `${PREFIJO} ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`,
    descripcion: 'Verificación de IDOR (seguridad-4).',
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
  const torneoId = crear.json.torneo.id;
  console.log(`🏆 Org A creó torneo ${torneoId}\n`);

  // Endpoints representativos de cada controller (lecturas, no destructivas)
  const lecturas: { label: string; metodo: string; ruta: string }[] = [
    { label: 'GET :id (core findOne)',            metodo: 'GET', ruta: `/admin/torneos/${torneoId}` },
    { label: 'GET :id/inscripciones',             metodo: 'GET', ruta: `/admin/torneos/${torneoId}/inscripciones` },
    { label: 'GET :id/overview',                  metodo: 'GET', ruta: `/admin/torneos/${torneoId}/overview` },
    { label: 'GET :id/detalle',                   metodo: 'GET', ruta: `/admin/torneos/${torneoId}/detalle` },
    { label: 'GET :id/sedes',                     metodo: 'GET', ruta: `/admin/torneos/${torneoId}/sedes` },
    { label: 'GET :id/checklist (wizard)',        metodo: 'GET', ruta: `/admin/torneos/${torneoId}/checklist` },
    { label: 'GET :id/control-pagos',             metodo: 'GET', ruta: `/admin/torneos/${torneoId}/control-pagos` },
  ];

  // Escrituras del intruso (NO ejecutar como dueño aquí: alteran/borran el torneo)
  const escriturasIntruso: { label: string; metodo: string; ruta: string; body?: any }[] = [
    { label: 'PUT :id/publicar (intruso)',  metodo: 'PUT',    ruta: `/admin/torneos/${torneoId}/publicar` },
    { label: 'DELETE :id (intruso)',        metodo: 'DELETE', ruta: `/admin/torneos/${torneoId}` },
  ];

  let fallos = 0;
  console.log('  Endpoint                                 │ Dueño(A) │ Intruso(B)');
  console.log('  ─────────────────────────────────────────┼──────────┼───────────');
  for (const e of lecturas) {
    const ra = await apiRaw(e.metodo, e.ruta, tokenA);
    const rb = await apiRaw(e.metodo, e.ruta, tokenB);
    const okA = ra.status >= 200 && ra.status < 300;
    const okB = rb.status === 403;
    if (!okA || !okB) fallos++;
    console.log(
      `  ${e.label.padEnd(40)} │ ${String(ra.status).padEnd(8)} │ ${rb.status} ${okB ? '✅' : '❌ esperaba 403'}`,
    );
  }
  // Escrituras del intruso → 403, sin tocar al dueño
  for (const e of escriturasIntruso) {
    const rb = await apiRaw(e.metodo, e.ruta, tokenB, e.body);
    const okB = rb.status === 403;
    if (!okB) fallos++;
    console.log(
      `  ${e.label.padEnd(40)} │ ${'—'.padEnd(8)} │ ${rb.status} ${okB ? '✅' : '❌ esperaba 403'}`,
    );
  }

  console.log('\n' + (fallos === 0
    ? '✅ RESULTADO: el intruso recibe 403 en todos los endpoints; el dueño opera normal. IDOR cerrado.'
    : `⚠️ RESULTADO: ${fallos} caso(s) no cumplieron lo esperado — revisar arriba.`));

  // Limpieza
  await prisma.tournament.delete({ where: { id: torneoId } });
  console.log(`🗑️  Torneo de prueba ${torneoId} eliminado.`);
}

async function limpiar() {
  const torneos = await prisma.tournament.findMany({
    where: { nombre: { startsWith: PREFIJO } },
    select: { id: true, nombre: true },
  });
  for (const t of torneos) {
    await prisma.tournament.delete({ where: { id: t.id } });
    console.log(`🗑️  Borrado: ${t.nombre}`);
  }
  console.log(`✅ ${torneos.length} torneo(s) [PRUEBA-IDOR] eliminados.`);
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
