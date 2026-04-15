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
    select: { multiplicadorPuntos: true, nombre: true },
  });

  if (!torneo) {
    console.error('❌ Torneo no encontrado');
    process.exit(1);
  }

  console.log(`📌 Torneo: ${torneo.nombre} | Multiplicador: ${torneo.multiplicadorPuntos}`);

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
  const fechaTorneo = new Date().toISOString().split('T')[0];

  for (const resultado of resultados) {
    const config = encontrarConfigParaPosicion(configs, resultado.posicion);
    if (!config) {
      console.warn(`⚠️  No se encontró config para ${resultado.posicion}, saltando.`);
      continue;
    }

    const puntosFinales = Math.round(config.puntosBase * torneo.multiplicadorPuntos);

    for (const jugadorId of resultado.jugadoresIds) {
      const historial = await prisma.historialPuntos.create({
        data: {
          jugadorId,
          tournamentId,
          categoryId,
          posicionFinal: resultado.posicion,
          puntosGanados: puntosFinales,
          puntosBase: config.puntosBase,
          multiplicadorAplicado: torneo.multiplicadorPuntos,
          fechaTorneo,
        },
      });
      puntosCalculados.push(historial);
      console.log(`   ➕ Jugador ${jugadorId}: ${resultado.posicion} = ${puntosFinales} pts`);
    }
  }

  // Actualizar rankings
  await actualizarRankings(categoryId);

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

async function actualizarRankings(categoryId: string) {
  const historiales = await prisma.historialPuntos.groupBy({
    by: ['jugadorId'],
    where: { categoryId },
    _sum: { puntosGanados: true },
    _count: { id: true },
  });

  const ordenados = historiales.sort((a, b) => (b._sum.puntosGanados || 0) - (a._sum.puntosGanados || 0));

  for (let i = 0; i < ordenados.length; i++) {
    const { jugadorId, _sum, _count } = ordenados[i];
    const puntosTotales = _sum.puntosGanados || 0;
    const torneosJugados = _count.id;

    await prisma.ranking.upsert({
      where: {
        jugadorId_tipoRanking_alcance_temporada: {
          jugadorId,
          tipoRanking: 'CATEGORIA',
          alcance: categoryId,
          temporada: new Date().getFullYear().toString(),
        },
      },
      update: {
        puntosTotales,
        posicion: i + 1,
        torneosJugados,
        ultimaActualizacion: new Date(),
      },
      create: {
        jugadorId,
        tipoRanking: 'CATEGORIA',
        alcance: categoryId,
        genero: 'MASCULINO',
        puntosTotales,
        posicion: i + 1,
        torneosJugados,
        temporada: new Date().getFullYear().toString(),
      },
    });
  }

  console.log(`   📊 ${ordenados.length} ranking(s) actualizados`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
