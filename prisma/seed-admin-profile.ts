/**
 * Seed script para generar datos ficticios de perfil del admin.
 * Crea: jugadores ficticios, torneos, parejas, matches con scores,
 * historial de puntos, ranking, seguidores, y fotos.
 *
 * Ejecutar: npx ts-node prisma/seed-admin-profile.ts
 */

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// ─── Jugadores ficticios compañeros/oponentes ───────────────────────
const JUGADORES = [
  { doc: '8000001', nombre: 'Matías', apellido: 'Benítez', genero: 'MASCULINO' as const, ciudad: 'Asunción' },
  { doc: '8000002', nombre: 'Rodrigo', apellido: 'Caballero', genero: 'MASCULINO' as const, ciudad: 'Luque' },
  { doc: '8000003', nombre: 'Diego', apellido: 'Ferreira', genero: 'MASCULINO' as const, ciudad: 'San Lorenzo' },
  { doc: '8000004', nombre: 'Sebastián', apellido: 'Giménez', genero: 'MASCULINO' as const, ciudad: 'Asunción' },
  { doc: '8000005', nombre: 'Andrés', apellido: 'López', genero: 'MASCULINO' as const, ciudad: 'Fernando de la Mora' },
  { doc: '8000006', nombre: 'Fernando', apellido: 'Martínez', genero: 'MASCULINO' as const, ciudad: 'Lambaré' },
  { doc: '8000007', nombre: 'Lucas', apellido: 'Núñez', genero: 'MASCULINO' as const, ciudad: 'Asunción' },
  { doc: '8000008', nombre: 'Gabriel', apellido: 'Ovelar', genero: 'MASCULINO' as const, ciudad: 'Luque' },
  { doc: '8000009', nombre: 'Pablo', apellido: 'Ramírez', genero: 'MASCULINO' as const, ciudad: 'Asunción' },
  { doc: '8000010', nombre: 'Nicolás', apellido: 'Sanabria', genero: 'MASCULINO' as const, ciudad: 'San Lorenzo' },
  { doc: '8000011', nombre: 'Tomás', apellido: 'Villalba', genero: 'MASCULINO' as const, ciudad: 'Asunción' },
  { doc: '8000012', nombre: 'Javier', apellido: 'Acosta', genero: 'MASCULINO' as const, ciudad: 'Luque' },
  { doc: '8000013', nombre: 'Manuel', apellido: 'Bareiro', genero: 'MASCULINO' as const, ciudad: 'Fernando de la Mora' },
  { doc: '8000014', nombre: 'Santiago', apellido: 'Cáceres', genero: 'MASCULINO' as const, ciudad: 'Asunción' },
  { doc: '8000015', nombre: 'Emilio', apellido: 'Duarte', genero: 'MASCULINO' as const, ciudad: 'Lambaré' },
];

// ─── Torneos ficticios ──────────────────────────────────────────────
const TORNEOS = [
  {
    nombre: 'Copa Asunción Verano 2025',
    ciudad: 'Asunción',
    fechaInicio: new Date('2025-01-15'),
    fechaFin: new Date('2025-01-19'),
    posicion: 'CAMPEON',
    puntos: 100,
  },
  {
    nombre: 'Open Luque Masters',
    ciudad: 'Luque',
    fechaInicio: new Date('2025-03-08'),
    fechaFin: new Date('2025-03-12'),
    posicion: 'FINALISTA',
    puntos: 60,
  },
  {
    nombre: 'Gran Prix San Lorenzo',
    ciudad: 'San Lorenzo',
    fechaInicio: new Date('2025-05-20'),
    fechaFin: new Date('2025-05-24'),
    posicion: 'CAMPEON',
    puntos: 100,
  },
  {
    nombre: 'Copa Lambaré Invierno',
    ciudad: 'Lambaré',
    fechaInicio: new Date('2025-07-10'),
    fechaFin: new Date('2025-07-14'),
    posicion: 'SEMIFINALISTA',
    puntos: 35,
  },
  {
    nombre: 'Master Series Paraguay',
    ciudad: 'Asunción',
    fechaInicio: new Date('2025-09-05'),
    fechaFin: new Date('2025-09-09'),
    posicion: 'CAMPEON',
    puntos: 100,
  },
  {
    nombre: 'Torneo Navideño FairPadel',
    ciudad: 'Asunción',
    fechaInicio: new Date('2025-12-10'),
    fechaFin: new Date('2025-12-14'),
    posicion: 'FINALISTA',
    puntos: 60,
  },
  {
    nombre: 'Copa de Oro 2026',
    ciudad: 'Asunción',
    fechaInicio: new Date('2026-01-20'),
    fechaFin: new Date('2026-01-24'),
    posicion: 'CAMPEON',
    puntos: 100,
  },
];

// ─── Partidos por torneo (scores realistas) ─────────────────────────
// admin + compañero vs 2 oponentes. companeroIdx y oponenteIdx son índices en JUGADORES[]
interface MatchData {
  ronda: string;
  companeroIdx: number;
  oponente1Idx: number;
  oponente2Idx: number;
  scores: [number, number, number, number, number?, number?]; // s1p1,s1p2,s2p1,s2p2,s3p1?,s3p2?
  adminGana: boolean;
}

const PARTIDOS_POR_TORNEO: MatchData[][] = [
  // Torneo 0: Copa Asunción — CAMPEON (4 wins)
  [
    { ronda: 'ACOMODACION_1', companeroIdx: 0, oponente1Idx: 2, oponente2Idx: 3, scores: [6, 3, 6, 2], adminGana: true },
    { ronda: 'CUARTOS', companeroIdx: 0, oponente1Idx: 4, oponente2Idx: 5, scores: [6, 4, 6, 4], adminGana: true },
    { ronda: 'SEMIFINAL', companeroIdx: 0, oponente1Idx: 6, oponente2Idx: 7, scores: [6, 7, 7, 5, 10, 7], adminGana: true },
    { ronda: 'FINAL', companeroIdx: 0, oponente1Idx: 8, oponente2Idx: 9, scores: [7, 5, 6, 3], adminGana: true },
  ],
  // Torneo 1: Open Luque — FINALISTA (3 wins, 1 loss)
  [
    { ronda: 'ACOMODACION_1', companeroIdx: 1, oponente1Idx: 10, oponente2Idx: 11, scores: [6, 1, 6, 2], adminGana: true },
    { ronda: 'CUARTOS', companeroIdx: 1, oponente1Idx: 12, oponente2Idx: 13, scores: [7, 6, 6, 3], adminGana: true },
    { ronda: 'SEMIFINAL', companeroIdx: 1, oponente1Idx: 2, oponente2Idx: 3, scores: [6, 4, 3, 6, 10, 8], adminGana: true },
    { ronda: 'FINAL', companeroIdx: 1, oponente1Idx: 4, oponente2Idx: 5, scores: [4, 6, 6, 7], adminGana: false },
  ],
  // Torneo 2: Gran Prix — CAMPEON (4 wins)
  [
    { ronda: 'ACOMODACION_1', companeroIdx: 0, oponente1Idx: 6, oponente2Idx: 7, scores: [6, 0, 6, 1], adminGana: true },
    { ronda: 'CUARTOS', companeroIdx: 0, oponente1Idx: 10, oponente2Idx: 11, scores: [6, 4, 7, 5], adminGana: true },
    { ronda: 'SEMIFINAL', companeroIdx: 0, oponente1Idx: 12, oponente2Idx: 13, scores: [6, 3, 6, 4], adminGana: true },
    { ronda: 'FINAL', companeroIdx: 0, oponente1Idx: 8, oponente2Idx: 9, scores: [6, 4, 4, 6, 7, 5], adminGana: true },
  ],
  // Torneo 3: Copa Lambaré — SEMIFINALISTA (2 wins, 1 loss)
  [
    { ronda: 'ACOMODACION_1', companeroIdx: 3, oponente1Idx: 14, oponente2Idx: 2, scores: [6, 2, 6, 3], adminGana: true },
    { ronda: 'CUARTOS', companeroIdx: 3, oponente1Idx: 4, oponente2Idx: 5, scores: [7, 6, 6, 2], adminGana: true },
    { ronda: 'SEMIFINAL', companeroIdx: 3, oponente1Idx: 8, oponente2Idx: 9, scores: [3, 6, 6, 7], adminGana: false },
  ],
  // Torneo 4: Master Series — CAMPEON (4 wins)
  [
    { ronda: 'ACOMODACION_1', companeroIdx: 0, oponente1Idx: 10, oponente2Idx: 11, scores: [6, 2, 6, 1], adminGana: true },
    { ronda: 'CUARTOS', companeroIdx: 0, oponente1Idx: 14, oponente2Idx: 2, scores: [6, 3, 7, 6], adminGana: true },
    { ronda: 'SEMIFINAL', companeroIdx: 0, oponente1Idx: 6, oponente2Idx: 7, scores: [4, 6, 6, 3, 10, 6], adminGana: true },
    { ronda: 'FINAL', companeroIdx: 0, oponente1Idx: 4, oponente2Idx: 5, scores: [6, 4, 6, 2], adminGana: true },
  ],
  // Torneo 5: Navideño — FINALISTA (3 wins, 1 loss)
  [
    { ronda: 'ACOMODACION_1', companeroIdx: 1, oponente1Idx: 3, oponente2Idx: 14, scores: [6, 3, 6, 4], adminGana: true },
    { ronda: 'CUARTOS', companeroIdx: 1, oponente1Idx: 6, oponente2Idx: 7, scores: [6, 4, 4, 6, 10, 5], adminGana: true },
    { ronda: 'SEMIFINAL', companeroIdx: 1, oponente1Idx: 10, oponente2Idx: 11, scores: [6, 2, 6, 3], adminGana: true },
    { ronda: 'FINAL', companeroIdx: 1, oponente1Idx: 8, oponente2Idx: 9, scores: [6, 7, 5, 7], adminGana: false },
  ],
  // Torneo 6: Copa de Oro 2026 — CAMPEON (4 wins)
  [
    { ronda: 'ACOMODACION_1', companeroIdx: 0, oponente1Idx: 12, oponente2Idx: 13, scores: [6, 1, 6, 0], adminGana: true },
    { ronda: 'CUARTOS', companeroIdx: 0, oponente1Idx: 3, oponente2Idx: 14, scores: [6, 3, 6, 4], adminGana: true },
    { ronda: 'SEMIFINAL', companeroIdx: 0, oponente1Idx: 8, oponente2Idx: 9, scores: [6, 4, 6, 3], adminGana: true },
    { ronda: 'FINAL', companeroIdx: 0, oponente1Idx: 6, oponente2Idx: 7, scores: [7, 6, 3, 6, 7, 5], adminGana: true },
  ],
];

// ─── Fotos ficticias (Unsplash padel images) ────────────────────────
const FOTOS = [
  { url: 'https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=800', desc: 'Ganando la final en Copa Asunción' },
  { url: 'https://images.unsplash.com/photo-1617083934555-6dba39984a5e?w=800', desc: 'Entrenamiento matutino' },
  { url: 'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=800', desc: 'Premiación Master Series' },
  { url: 'https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?w=800', desc: 'Dobles con Matías' },
  { url: 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=800', desc: 'Club de pádel Asunción' },
  { url: 'https://images.unsplash.com/photo-1599058917212-d750089bc07e?w=800', desc: 'Trofeo Copa de Oro 2026' },
  { url: 'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=800', desc: 'Post-match con el equipo' },
  { url: 'https://images.unsplash.com/photo-1587280501635-68a0e82cd5ff?w=800', desc: 'Cancha nocturna' },
];

async function main() {
  console.log('🎯 Seed de perfil admin — Iniciando...\n');

  // ── 1. Buscar admin ─────────────────────────────────────────────
  const admin = await prisma.user.findUnique({ where: { email: 'admin@fairpadel.com' } });
  if (!admin) {
    console.error('❌ Admin no encontrado. Ejecutá primero npm run seed');
    return;
  }
  console.log(`✅ Admin encontrado: ${admin.nombre} ${admin.apellido} (${admin.id})`);

  // Actualizar bio del admin
  await prisma.user.update({
    where: { id: admin.id },
    data: {
      bio: 'Apasionado del pádel 🏆 4x Campeón nacional. Jugando desde 2019. Siempre buscando mejorar.',
      fechaNacimiento: new Date('1992-06-15'),
    },
  });

  // ── 2. Buscar categoría ─────────────────────────────────────────
  const categoria = await prisma.category.findFirst({ where: { nombre: '4ta Caballeros' } });
  if (!categoria) {
    console.error('❌ Categoría 4ta Caballeros no encontrada');
    return;
  }
  console.log(`✅ Categoría: ${categoria.nombre} (${categoria.id})`);

  // ── 3. Buscar rol jugador ───────────────────────────────────────
  const rolJugador = await prisma.role.findUnique({ where: { nombre: 'jugador' } });
  if (!rolJugador) {
    console.error('❌ Rol jugador no encontrado');
    return;
  }

  // ── 4. Crear jugadores ficticios ────────────────────────────────
  console.log('\n📝 Creando 15 jugadores ficticios...');
  const passwordHash = await bcrypt.hash('test123', 10);
  const jugadores: { id: string; documento: string; nombre: string; apellido: string }[] = [];

  for (const j of JUGADORES) {
    const existing = await prisma.user.findUnique({ where: { documento: j.doc } });
    if (existing) {
      jugadores.push({ id: existing.id, documento: existing.documento, nombre: existing.nombre, apellido: existing.apellido });
      continue;
    }

    const user = await prisma.user.create({
      data: {
        documento: j.doc,
        nombre: j.nombre,
        apellido: j.apellido,
        genero: j.genero,
        email: `jugador.${j.doc}@test.com`,
        telefono: `+5959${j.doc}`,
        passwordHash,
        estado: 'ACTIVO',
        emailVerificado: true,
        ciudad: j.ciudad,
      },
    });

    await prisma.userRole.create({
      data: { userId: user.id, roleId: rolJugador.id },
    });

    jugadores.push({ id: user.id, documento: user.documento, nombre: user.nombre, apellido: user.apellido });
  }
  console.log(`✅ ${jugadores.length} jugadores listos`);

  // También asegurar admin tiene rol jugador
  const adminJugadorRole = await prisma.userRole.findFirst({
    where: { userId: admin.id, roleId: rolJugador.id },
  });
  if (!adminJugadorRole) {
    await prisma.userRole.create({
      data: { userId: admin.id, roleId: rolJugador.id },
    });
  }

  // ── 5. Crear torneos + partidos + historial ─────────────────────
  console.log('\n📝 Creando 7 torneos con partidos...');

  for (let t = 0; t < TORNEOS.length; t++) {
    const torneoData = TORNEOS[t];
    const matchesData = PARTIDOS_POR_TORNEO[t];

    // Create tournament
    const torneo = await prisma.tournament.create({
      data: {
        nombre: torneoData.nombre,
        descripcion: `Torneo de pádel en ${torneoData.ciudad}`,
        pais: 'Paraguay',
        region: 'Central',
        ciudad: torneoData.ciudad,
        fechaInicio: torneoData.fechaInicio,
        fechaFin: torneoData.fechaFin,
        fechaLimiteInscr: new Date(torneoData.fechaInicio.getTime() - 7 * 24 * 60 * 60 * 1000),
        costoInscripcion: 100000,
        flyerUrl: 'https://via.placeholder.com/400x600',
        estado: 'FINALIZADO',
        organizadorId: admin.id,
        minutosPorPartido: 90,
      },
    });

    // Link category
    const tc = await prisma.tournamentCategory.create({
      data: {
        tournamentId: torneo.id,
        categoryId: categoria.id,
        inscripcionAbierta: false,
        estado: 'FINALIZADA',
      },
    });

    // Create matches for this tournament
    for (let mi = 0; mi < matchesData.length; mi++) {
      const md = matchesData[mi];
      const companero = jugadores[md.companeroIdx];
      const oponente1 = jugadores[md.oponente1Idx];
      const oponente2 = jugadores[md.oponente2Idx];

      // Create pareja for admin + companero
      const parejaAdmin = await prisma.pareja.create({
        data: {
          jugador1Id: admin.id,
          jugador2Id: companero.id,
          jugador2Documento: companero.documento,
        },
      });

      // Create pareja for opponents
      const parejaOpp = await prisma.pareja.create({
        data: {
          jugador1Id: oponente1.id,
          jugador2Id: oponente2.id,
          jugador2Documento: oponente2.documento,
        },
      });

      const ganadoraId = md.adminGana ? parejaAdmin.id : parejaOpp.id;
      const perdedoraId = md.adminGana ? parejaOpp.id : parejaAdmin.id;

      await prisma.match.create({
        data: {
          tournamentId: torneo.id,
          categoryId: categoria.id,
          ronda: md.ronda,
          numeroRonda: mi + 1,
          pareja1Id: parejaAdmin.id,
          pareja2Id: parejaOpp.id,
          parejaGanadoraId: ganadoraId,
          parejaPerdedoraId: perdedoraId,
          set1Pareja1: md.scores[0],
          set1Pareja2: md.scores[1],
          set2Pareja1: md.scores[2],
          set2Pareja2: md.scores[3],
          set3Pareja1: md.scores[4] ?? null,
          set3Pareja2: md.scores[5] ?? null,
          estado: 'FINALIZADO',
          fechaProgramada: torneoData.fechaInicio,
          horaProgramada: `${8 + mi * 2}:00`,
        },
      });
    }

    // Create historial de puntos
    await prisma.historialPuntos.create({
      data: {
        jugadorId: admin.id,
        tournamentId: torneo.id,
        categoryId: categoria.id,
        posicionFinal: torneoData.posicion,
        puntosGanados: torneoData.puntos,
        fechaTorneo: torneoData.fechaFin,
      },
    });

    console.log(`  ✅ ${torneoData.nombre} — ${torneoData.posicion} (+${torneoData.puntos}pts, ${matchesData.length} partidos)`);
  }

  // ── 6. Crear Ranking GLOBAL ─────────────────────────────────────
  console.log('\n📝 Creando ranking GLOBAL...');
  const totalPuntos = TORNEOS.reduce((acc, t) => acc + t.puntos, 0);
  const totalWins = PARTIDOS_POR_TORNEO.flat().filter((m) => m.adminGana).length;
  const totalLosses = PARTIDOS_POR_TORNEO.flat().filter((m) => !m.adminGana).length;
  const campeonatos = TORNEOS.filter((t) => t.posicion === 'CAMPEON').length;

  const temporada = new Date().getFullYear().toString();
  await prisma.ranking.upsert({
    where: {
      jugadorId_tipoRanking_alcance_temporada: {
        jugadorId: admin.id,
        tipoRanking: 'GLOBAL',
        alcance: 'GLOBAL',
        temporada,
      },
    },
    update: {
      puntosTotales: totalPuntos,
      posicion: 3,
      posicionAnterior: 5,
      torneosJugados: TORNEOS.length,
      victorias: totalWins,
      derrotas: totalLosses,
      campeonatos,
      rachaActual: 4,
      mejorPosicion: 1,
      porcentajeVictorias: parseFloat(((totalWins / (totalWins + totalLosses)) * 100).toFixed(2)),
    },
    create: {
      jugadorId: admin.id,
      tipoRanking: 'GLOBAL',
      alcance: 'GLOBAL',
      genero: 'MASCULINO',
      temporada,
      puntosTotales: totalPuntos,
      posicion: 3,
      posicionAnterior: 5,
      torneosJugados: TORNEOS.length,
      victorias: totalWins,
      derrotas: totalLosses,
      campeonatos,
      rachaActual: 4,
      mejorPosicion: 1,
      porcentajeVictorias: parseFloat(((totalWins / (totalWins + totalLosses)) * 100).toFixed(2)),
    },
  });

  console.log(`✅ Ranking: #3 (↑2) | ${totalPuntos}pts | ${totalWins}W-${totalLosses}L | ${campeonatos} campeonatos`);

  // ── 7. Crear seguidores ─────────────────────────────────────────
  console.log('\n📝 Creando seguidores/siguiendo...');

  // 12 people follow admin
  for (let i = 0; i < 12; i++) {
    const seguidorId = jugadores[i].id;
    const exists = await prisma.seguimiento.findFirst({
      where: { seguidorId, seguidoId: admin.id },
    });
    if (!exists) {
      await prisma.seguimiento.create({
        data: { seguidorId, seguidoId: admin.id },
      });
    }
  }

  // Admin follows 8 people
  for (let i = 0; i < 8; i++) {
    const seguidoId = jugadores[i].id;
    const exists = await prisma.seguimiento.findFirst({
      where: { seguidorId: admin.id, seguidoId },
    });
    if (!exists) {
      await prisma.seguimiento.create({
        data: { seguidorId: admin.id, seguidoId },
      });
    }
  }

  console.log('✅ 12 seguidores, 8 siguiendo');

  // ── 8. Crear fotos aprobadas ────────────────────────────────────
  console.log('\n📝 Creando 8 fotos...');
  for (const foto of FOTOS) {
    await prisma.foto.create({
      data: {
        userId: admin.id,
        urlImagen: foto.url,
        urlThumbnail: foto.url.replace('w=800', 'w=300'),
        descripcion: foto.desc,
        tipo: 'PERSONAL',
        estadoModeracion: 'APROBADA',
        likesCount: Math.floor(Math.random() * 25) + 5,
        comentariosCount: Math.floor(Math.random() * 10) + 1,
      },
    });
  }
  console.log('✅ 8 fotos aprobadas creadas');

  // ── Resumen ─────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════');
  console.log('🎉 Seed de perfil admin completado!');
  console.log('═══════════════════════════════════════');
  console.log(`   Jugadores ficticios: 15`);
  console.log(`   Torneos: ${TORNEOS.length}`);
  console.log(`   Partidos totales: ${PARTIDOS_POR_TORNEO.flat().length}`);
  console.log(`   Wins/Losses: ${totalWins}/${totalLosses}`);
  console.log(`   Puntos: ${totalPuntos}`);
  console.log(`   Ranking: #3 (subió 2)`);
  console.log(`   Seguidores/Siguiendo: 12/8`);
  console.log(`   Fotos: ${FOTOS.length}`);
  console.log('═══════════════════════════════════════\n');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
