/**
 * Script de recuperación: calcular puntos y guardar historial para un torneo/categoría
 * Uso: npx ts-node scripts/calcular-puntos-torneo.ts <tournamentId> <categoryId>
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const [tournamentId, categoryId] = process.argv.slice(2);

  if (!tournamentId || !categoryId) {
    console.error('Uso: npx ts-node scripts/calcular-puntos-torneo.ts <tournamentId> <categoryId>');
    process.exit(1);
  }

  console.log(`🔍 Procesando torneo ${tournamentId} / categoría ${categoryId}`);

  // Verificar que no existan historiales previos para evitar duplicados
  const existentes = await prisma.historialPuntos.count({
    where: { tournamentId, categoryId },
  });

  if (existentes > 0) {
    console.warn(`⚠️  Ya existen ${existentes} registros de historial_puntos para este torneo/categoría.`);
    console.warn('   Abortando para evitar duplicados. Si deseas recalcular, elimínalos primero.');
    process.exit(1);
  }

  const torneo = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { multiplicadorPuntos: true, nombre: true, fechaInicio: true },
  });

  if (!torneo) {
    console.error('❌ Torneo no encontrado');
    process.exit(1);
  }

  // Buscar relación con circuito aprobada
  const torneoCircuito = await prisma.torneoCircuito.findFirst({
    where: { torneoId: tournamentId, estado: 'APROBADO' },
    include: { circuito: true },
  });

  let multiplicadorFinal = torneo.multiplicadorPuntos || 1;
  if (torneoCircuito?.circuito) {
    multiplicadorFinal *= (torneoCircuito.multiplicador || 1) * (torneoCircuito.circuito.multiplicadorGlobal || 1);
  }

  console.log(`📌 Torneo: ${torneo.nombre} | Multiplicador base: ${torneo.multiplicadorPuntos} | Final: ${multiplicadorFinal.toFixed(2)}`);
  if (torneoCircuito?.circuito) {
    console.log(`   🏆 Circuito: ${torneoCircuito.circuito.nombre} (multiplicador torneo-circuito=${torneoCircuito.multiplicador}, global=${torneoCircuito.circuito.multiplicadorGlobal})`);
  }

  const partidos = await prisma.match.findMany({
    where: {
      tournamentId,
      categoryId,
      estado: 'FINALIZADO',
      inscripcionGanadoraId: { not: null },
    },
    include: {
      inscripcionGanadora: {
        include: { jugador1: true, jugador2: true },
      },
      inscripcionPerdedora: {
        include: { jugador1: true, jugador2: true },
      },
    },
  });

  console.log(`⚔️  Partidos finalizados encontrados: ${partidos.length}`);

  const resultados: Array<{ posicion: string; jugadoresIds: string[] }> = [];

  // Final
  const final = partidos.find((p) => p.ronda === 'FINAL');
  if (final) {
    resultados.push({
      posicion: '1ro',
      jugadoresIds: [final.inscripcionGanadora!.jugador1Id, final.inscripcionGanadora!.jugador2Id].filter(Boolean),
    });
    resultados.push({
      posicion: '2do',
      jugadoresIds: [final.inscripcionPerdedora!.jugador1Id, final.inscripcionPerdedora!.jugador2Id].filter(Boolean),
    });
  }

  // Semifinalistas
  const semis = partidos.filter((p) => p.ronda === 'SEMIS');
  for (const semi of semis) {
    resultados.push({
      posicion: '3ro-4to',
      jugadoresIds: [semi.inscripcionPerdedora!.jugador1Id, semi.inscripcionPerdedora!.jugador2Id].filter(Boolean),
    });
  }

  // Cuartos
  const cuartos = partidos.filter((p) => p.ronda === 'CUARTOS');
  for (const cuarto of cuartos) {
    resultados.push({
      posicion: '5to-8vo',
      jugadoresIds: [cuarto.inscripcionPerdedora!.jugador1Id, cuarto.inscripcionPerdedora!.jugador2Id].filter(Boolean),
    });
  }

  // Octavos
  const octavos = partidos.filter((p) => p.ronda === 'OCTAVOS');
  for (const octavo of octavos) {
    resultados.push({
      posicion: '9no-16to',
      jugadoresIds: [octavo.inscripcionPerdedora!.jugador1Id, octavo.inscripcionPerdedora!.jugador2Id].filter(Boolean),
    });
  }

  console.log(`🏆 Posiciones determinadas:`);
  for (const r of resultados) {
    console.log(`   ${r.posicion}: ${r.jugadoresIds.length} jugador(es)`);
  }

  const configs = await prisma.configuracionPuntos.findMany({ where: { activo: true } });
  if (configs.length === 0) {
    console.error('❌ No hay configuración de puntos activa');
    process.exit(1);
  }

  const puntosCalculados: any[] = [];
  const fechaTorneo = torneo.fechaInicio || new Date().toISOString().split('T')[0];
  const temporada = fechaTorneo.split('-')[0];

  for (const resultado of resultados) {
    const config = encontrarConfigParaPosicion(configs, resultado.posicion);
    if (!config) {
      console.warn(`⚠️  No se encontró config para ${resultado.posicion}, saltando.`);
      continue;
    }

    const puntosFinales = Math.round(config.puntosBase * multiplicadorFinal);

    for (const jugadorId of resultado.jugadoresIds) {
      const historial = await prisma.historialPuntos.create({
        data: {
          jugadorId,
          tournamentId,
          categoryId,
          posicionFinal: resultado.posicion,
          puntosGanados: puntosFinales,
          puntosBase: config.puntosBase,
          multiplicadorAplicado: multiplicadorFinal,
          fechaTorneo,
        },
      });
      puntosCalculados.push(historial);
      console.log(`   ➕ Jugador ${jugadorId}: ${resultado.posicion} = ${puntosFinales} pts`);
    }
  }

  // Actualizar rankings
  console.log('\n📊 Actualizando rankings...');
  await actualizarRankingsCategoria(categoryId, temporada);
  if (torneoCircuito?.circuito) {
    await actualizarRankingsCircuito(torneoCircuito.circuito.id, categoryId, temporada);
  }
  await actualizarRankingsGlobal(temporada);

  console.log(`\n✅ Listo. ${puntosCalculados.length} registros creados en historial_puntos.`);
}

function encontrarConfigParaPosicion(configs: any[], posicion: string) {
  let config = configs.find((c) => c.posicion === posicion);
  if (!config) {
    if (posicion.startsWith('3ro') || posicion.startsWith('4to')) {
      config = configs.find((c) => c.posicion === '3ro-4to');
    } else if (['5to', '6to', '7mo', '8vo'].some((p) => posicion.startsWith(p))) {
      config = configs.find((c) => c.posicion === '5to-8vo');
    } else if (['9no', '10mo', '11vo', '12do', '13ro', '14to', '15to', '16to'].some((p) => posicion.startsWith(p))) {
      config = configs.find((c) => c.posicion === '9no-16to');
    }
  }
  return config;
}

async function obtenerTorneosEnCircuitosAprobados(): Promise<string[]> {
  const torneos = await prisma.torneoCircuito.findMany({
    where: { estado: 'APROBADO' },
    select: { torneoId: true },
  });
  return Array.from(new Set(torneos.map((t) => t.torneoId)));
}

async function upsertRankings(
  historiales: any[],
  tipoRanking: 'CATEGORIA' | 'GLOBAL' | 'LIGA',
  alcance: string,
  temporada: string,
) {
  if (historiales.length === 0) return;

  const jugadorIds = historiales.map((h) => h.jugadorId);
  const jugadores = await prisma.user.findMany({
    where: { id: { in: jugadorIds } },
    select: { id: true, genero: true },
  });
  const generoMap = new Map(jugadores.map((j) => [j.id, j.genero]));

  const ordenados = historiales.sort((a, b) => (b._sum.puntosGanados || 0) - (a._sum.puntosGanados || 0));

  let posicion = 1;
  for (let i = 0; i < ordenados.length; i++) {
    const { jugadorId, _sum, _count } = ordenados[i];
    const puntosTotales = _sum.puntosGanados || 0;
    const torneosJugados = _count.id;

    if (i > 0 && puntosTotales !== (ordenados[i - 1]._sum.puntosGanados || 0)) {
      posicion = i + 1;
    }

    await prisma.ranking.upsert({
      where: {
        jugadorId_tipoRanking_alcance_temporada: {
          jugadorId,
          tipoRanking,
          alcance,
          temporada,
        },
      },
      update: {
        puntosTotales,
        posicion,
        torneosJugados,
        ultimaActualizacion: new Date(),
      },
      create: {
        jugadorId,
        tipoRanking,
        alcance,
        genero: generoMap.get(jugadorId) || 'MASCULINO',
        puntosTotales,
        posicion,
        torneosJugados,
        temporada,
      },
    });
  }

  console.log(`   📊 ${tipoRanking}${alcance ? `(${alcance})` : ''}: ${ordenados.length} ranking(s) actualizados`);
}

async function actualizarRankingsCategoria(categoryId: string, temporada: string) {
  const torneoIds = await obtenerTorneosEnCircuitosAprobados();
  if (torneoIds.length === 0) {
    console.log('   ⚠️  No hay torneos en circuitos aprobados. Ranking de categoría no actualizado.');
    return;
  }

  const historiales = await prisma.historialPuntos.groupBy({
    by: ['jugadorId'],
    where: {
      categoryId,
      tournamentId: { in: torneoIds },
      fechaTorneo: { startsWith: temporada },
    },
    _sum: { puntosGanados: true },
    _count: { id: true },
  });

  await upsertRankings(historiales, 'CATEGORIA', categoryId, temporada);
}

async function actualizarRankingsGlobal(temporada: string) {
  const torneoIds = await obtenerTorneosEnCircuitosAprobados();
  if (torneoIds.length === 0) {
    console.log('   ⚠️  No hay torneos en circuitos aprobados. Ranking global no actualizado.');
    return;
  }

  const historiales = await prisma.historialPuntos.groupBy({
    by: ['jugadorId'],
    where: {
      tournamentId: { in: torneoIds },
      fechaTorneo: { startsWith: temporada },
    },
    _sum: { puntosGanados: true },
    _count: { id: true },
  });

  await upsertRankings(historiales, 'GLOBAL', '', temporada);
}

async function actualizarRankingsCircuito(circuitoId: string, categoryId: string, temporada: string) {
  const torneosCircuito = await prisma.torneoCircuito.findMany({
    where: { circuitoId, estado: 'APROBADO', puntosValidos: true },
    include: { torneo: { select: { id: true, multiplicadorPuntos: true } } },
  });
  const torneoIds = torneosCircuito.map((t) => t.torneoId);
  if (torneoIds.length === 0) {
    console.log('   ⚠️  No hay torneos aprobados en el circuito. Ranking de circuito no actualizado.');
    return;
  }

  const historiales = await prisma.historialPuntos.findMany({
    where: {
      tournamentId: { in: torneoIds },
      categoryId,
      fechaTorneo: { startsWith: temporada },
    },
    select: {
      jugadorId: true,
      tournamentId: true,
      puntosBase: true,
    },
  });

  // Recalcular puntos de circuito SIN aplicar circuito.multiplicadorGlobal
  const puntosPorJugador = new Map<string, { puntos: number; torneos: number }>();
  for (const h of historiales) {
    const tc = torneosCircuito.find((t) => t.torneoId === h.tournamentId);
    if (!tc) continue;
    const puntosCircuito = Math.round(
      h.puntosBase * (tc.torneo.multiplicadorPuntos || 1) * (tc.multiplicador || 1),
    );
    const actual = puntosPorJugador.get(h.jugadorId) || { puntos: 0, torneos: 0 };
    actual.puntos += puntosCircuito;
    actual.torneos += 1;
    puntosPorJugador.set(h.jugadorId, actual);
  }

  const historialesRecalculados = Array.from(puntosPorJugador.entries()).map(
    ([jugadorId, { puntos, torneos }]) => ({
      jugadorId,
      _sum: { puntosGanados: puntos },
      _count: { id: torneos },
    }),
  );

  await upsertRankings(historialesRecalculados, 'LIGA', circuitoId, temporada);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
