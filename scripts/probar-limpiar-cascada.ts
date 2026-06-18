/**
 * Verificación e2e del god-panel A2: "Limpiar resultado en cascada".
 * Crea un escenario MÍNIMO aislado ([PRUEBA-A2]): una SEMI finalizada cuyo
 * ganador ya avanzó a una FINAL también finalizada. Llama al endpoint REAL de
 * producción (admin) y verifica en la BD que:
 *   - la semi vuelve a PROGRAMADO sin ganador,
 *   - la final vuelve a PROGRAMADO sin ganador,
 *   - el casillero de la final que llenó la semi (posición 1) queda vacío,
 *   - el otro finalista (posición 2) NO se toca,
 *   - partidosAfectados = 2.
 *
 * Uso:
 *   npx ts-node scripts/probar-limpiar-cascada.ts probar     # crea, prueba y limpia
 *   npx ts-node scripts/probar-limpiar-cascada.ts limpiar    # borra datos [PRUEBA-A2]
 *
 * El org de prueba (doc 99999002) recibe rol admin (es descartable). Password
 * aleatoria por corrida.
 */
import 'dotenv/config';
import { PrismaClient, Gender, MatchStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

const PREFIJO = '[PRUEBA-A2]';
const ORG_DOC = '99999002';
const API_BASE = process.env.API_BASE || 'https://api.fairpadel.com/api';
const CATEGORIA_DEFAULT = '8ª Categoría';

async function asegurarOrgAdmin(): Promise<{ id: string; password: string }> {
  const password = crypto.randomBytes(12).toString('base64url');
  const hash = bcrypt.hashSync(password, 10);
  const org = await prisma.user.upsert({
    where: { documento: ORG_DOC },
    update: { password: hash, estado: 'ACTIVO' },
    create: {
      documento: ORG_DOC,
      email: 'prueba.a2@fairpadel.test',
      password: hash,
      nombre: 'Org',
      apellido: 'Prueba A2',
      genero: Gender.MASCULINO,
      estado: 'ACTIVO',
    },
  });
  for (const nombre of ['organizador', 'admin']) {
    const rol = await prisma.role.findUnique({ where: { nombre } });
    if (!rol) throw new Error(`No existe el rol ${nombre}`);
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: org.id, roleId: rol.id } },
      update: {},
      create: { userId: org.id, roleId: rol.id },
    });
  }
  return { id: org.id, password };
}

async function jugadorPrueba(n: number) {
  const hash = bcrypt.hashSync('test123', 10);
  return prisma.user.upsert({
    where: { documento: `PRUEBA-A2J${n}` },
    update: {},
    create: {
      documento: `PRUEBA-A2J${n}`,
      email: `prueba.a2j${n}@fairpadel.test`,
      password: hash,
      nombre: 'Jugador',
      apellido: `A2 ${n}`,
      genero: Gender.MASCULINO,
    },
  });
}

async function probar() {
  const { id: orgId, password } = await asegurarOrgAdmin();
  console.log(`👤 Org admin de prueba listo (doc ${ORG_DOC})`);

  const categoria = await prisma.category.findFirst({ where: { nombre: CATEGORIA_DEFAULT } });
  if (!categoria) throw new Error(`No existe la categoría ${CATEGORIA_DEFAULT}`);

  const js = [];
  for (let i = 1; i <= 4; i++) js.push(await jugadorPrueba(i));

  const torneo = await prisma.tournament.create({
    data: {
      nombre: `${PREFIJO} ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`,
      descripcion: 'Escenario mínimo para probar limpiar-resultado en cascada.',
      pais: 'Paraguay', region: 'Central', ciudad: 'Asunción',
      fechaInicio: '2030-01-01', fechaFin: '2030-01-02',
      fechaLimiteInscr: '2029-12-31', flyerUrl: '', estado: 'PUBLICADO',
      costoInscripcion: 0, organizadorId: orgId,
    },
  });
  await prisma.tournamentCategory.create({ data: { tournamentId: torneo.id, categoryId: categoria.id } });

  // 3 inscripciones: A y B juegan la semi; C es el otro finalista
  const mkInsc = async (j1: string, j2: string, j2doc: string) => prisma.inscripcion.create({
    data: {
      tournamentId: torneo.id, categoryId: categoria.id,
      jugador1Id: j1, jugador2Id: j2, jugador2Documento: j2doc,
      estado: 'CONFIRMADA', modoPago: 'COMPLETO',
    } as any,
  });
  const insA = await mkInsc(js[0].id, js[1].id, js[1].documento);
  const insB = await mkInsc(js[2].id, js[3].id, js[3].documento);
  const insC = await mkInsc(js[1].id, js[2].id, js[2].documento);

  // FINAL (finalizada): A (vino de la semi, pos 1) vs C (pos 2). Ganó A.
  const final = await prisma.match.create({
    data: {
      tournamentId: torneo.id, categoryId: categoria.id, ronda: 'FINAL', numeroRonda: 99,
      inscripcion1Id: insA.id, tipoEntrada1: 'GANADOR_PARTIDO',
      inscripcion2Id: insC.id, tipoEntrada2: 'INSCRIPCION',
      estado: MatchStatus.FINALIZADO,
      inscripcionGanadoraId: insA.id, inscripcionPerdedoraId: insC.id,
      set1Pareja1: 6, set1Pareja2: 3, set2Pareja1: 6, set2Pareja2: 4,
    },
  });

  // SEMI (finalizada): A vs B. Ganó A, que avanzó a la FINAL en la posición 1.
  const semi = await prisma.match.create({
    data: {
      tournamentId: torneo.id, categoryId: categoria.id, ronda: 'SEMIS', numeroRonda: 98,
      inscripcion1Id: insA.id, inscripcion2Id: insB.id,
      estado: MatchStatus.FINALIZADO,
      inscripcionGanadoraId: insA.id, inscripcionPerdedoraId: insB.id,
      set1Pareja1: 6, set1Pareja2: 2, set2Pareja1: 6, set2Pareja2: 1,
      partidoSiguienteId: final.id, posicionEnSiguiente: 1,
    },
  });
  console.log(`🏆 Escenario creado · semi=${semi.id} → final=${final.id}`);

  // Login real (token con rol admin)
  const loginRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ documento: ORG_DOC, password }),
  });
  if (!loginRes.ok) throw new Error(`Login falló: HTTP ${loginRes.status} ${await loginRes.text()}`);
  const { access_token } = await loginRes.json();
  console.log('🔑 Login OK (rol admin)');

  // Llamar al endpoint REAL de producción
  const res = await fetch(`${API_BASE}/admin/auditoria/partidos/${semi.id}/limpiar-resultado`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${access_token}` },
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`Endpoint falló: HTTP ${res.status} ${JSON.stringify(body)}`);
  console.log(`🧹 Respuesta: ${body.message} · partidosAfectados=${body.partidosAfectados}`);

  // Verificar el estado final en la BD
  const semiD = await prisma.match.findUnique({ where: { id: semi.id } });
  const finalD = await prisma.match.findUnique({ where: { id: final.id } });

  const checks: Array<[string, boolean]> = [
    ['partidosAfectados = 2', body.partidosAfectados === 2],
    ['semi → PROGRAMADO', semiD?.estado === MatchStatus.PROGRAMADO],
    ['semi sin ganador', semiD?.inscripcionGanadoraId === null],
    ['semi sin sets', semiD?.set1Pareja1 === null],
    ['final → PROGRAMADO', finalD?.estado === MatchStatus.PROGRAMADO],
    ['final sin ganador', finalD?.inscripcionGanadoraId === null],
    ['final pos1 vaciada (era el ganador de la semi)', finalD?.inscripcion1Id === null],
    ['final tipoEntrada1 limpia', finalD?.tipoEntrada1 === null],
    ['final pos2 intacta (otro finalista)', finalD?.inscripcion2Id === insC.id],
  ];

  console.log('\n📋 VERIFICACIÓN:');
  let ok = true;
  for (const [label, pass] of checks) {
    console.log(`   ${pass ? '✅' : '❌'} ${label}`);
    if (!pass) ok = false;
  }

  // Limpieza del escenario
  await prisma.match.deleteMany({ where: { tournamentId: torneo.id } });
  await prisma.tournament.delete({ where: { id: torneo.id } });
  console.log('\n🗑️  Escenario [PRUEBA-A2] eliminado.');

  console.log(ok
    ? '\n✅ RESULTADO: limpiar-resultado en cascada funciona correctamente en producción.'
    : '\n❌ RESULTADO: alguna verificación falló — revisar arriba.');
  if (!ok) process.exit(1);
}

async function limpiar() {
  const torneos = await prisma.tournament.findMany({ where: { nombre: { startsWith: PREFIJO } }, select: { id: true, nombre: true } });
  for (const t of torneos) {
    await prisma.match.deleteMany({ where: { tournamentId: t.id } });
    await prisma.tournament.delete({ where: { id: t.id } });
    console.log(`🗑️  Borrado: ${t.nombre}`);
  }
  // Higiene: el org de prueba queda INACTIVO y sin rol admin (no es una puerta abierta)
  const org = await prisma.user.findUnique({ where: { documento: ORG_DOC } });
  if (org) {
    const rolAdmin = await prisma.role.findUnique({ where: { nombre: 'admin' } });
    if (rolAdmin) {
      await prisma.userRole.deleteMany({ where: { userId: org.id, roleId: rolAdmin.id } });
    }
    await prisma.user.update({ where: { id: org.id }, data: { estado: 'INACTIVO' } });
    console.log('🔒 Org de prueba desactivado y sin rol admin.');
  }
  console.log(`✅ ${torneos.length} escenario(s) [PRUEBA-A2] eliminados.`);
}

async function main() {
  const modo = process.argv[2] || 'probar';
  console.log(`🔌 DB: ${(process.env.DATABASE_URL || '').replace(/\/\/.*@/, '//***@')}\n`);
  if (modo === 'probar') return probar();
  if (modo === 'limpiar') return limpiar();
  throw new Error(`Modo desconocido: ${modo}. Usar: probar | limpiar`);
}

main()
  .catch((e) => { console.error('❌ Error:', e.message); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
