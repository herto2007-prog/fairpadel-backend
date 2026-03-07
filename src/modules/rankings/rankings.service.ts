import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TipoRanking, RondaTipo, MatchStatus } from '@prisma/client';

// Sistema de puntos por puesto en torneo
const PUNTOS_POR_PUESTO = {
  CAMPEON: 100,
  FINALISTA: 70,
  SEMIFINALISTA: 50,
  CUARTOS: 30,
  OCTAVOS: 20,
  PARTICIPACION: 10, // Solo por participar
};

// Puntos adicionales por partido ganado
const PUNTOS_POR_PARTIDO_GANADO = 5;

interface ResultadoTorneo {
  jugadorId: string;
  inscripcionId: string;
  puesto: number;
  esCampeon: boolean;
  esFinalista: boolean;
  esSemifinalista: boolean;
  partidosGanados: number;
  partidosPerdidos: number;
  categoryId: string;
}

@Injectable()
export class RankingsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Actualiza los rankings de todos los jugadores de un torneo/categoría
   * Llamar cuando el torneo finaliza
   */
  async actualizarRankingsPorTorneo(tournamentId: string, categoryId: string) {
    // Obtener todos los partidos finalizados de la categoría
    const partidos = await this.prisma.match.findMany({
      where: {
        tournamentId,
        categoryId,
        estado: MatchStatus.FINALIZADO,
        ronda: {
          in: [RondaTipo.FINAL, RondaTipo.SEMIS, RondaTipo.CUARTOS, RondaTipo.OCTAVOS],
        },
      },
      include: {
        inscripcionGanadora: {
          include: {
            jugador1: true,
            jugador2: true,
          },
        },
        inscripcionPerdedora: {
          include: {
            jugador1: true,
            jugador2: true,
          },
        },
      },
    });

    // Calcular resultados por jugador
    const resultadosPorJugador = new Map<string, ResultadoTorneo>();

    // Inicializar con todas las inscripciones confirmadas
    const inscripciones = await this.prisma.inscripcion.findMany({
      where: {
        tournamentId,
        categoryId,
        estado: 'CONFIRMADA',
      },
      include: {
        jugador1: true,
        jugador2: true,
      },
    });

    for (const insc of inscripciones) {
      // Jugador 1
      if (!resultadosPorJugador.has(insc.jugador1Id)) {
        resultadosPorJugador.set(insc.jugador1Id, {
          jugadorId: insc.jugador1Id,
          inscripcionId: insc.id,
          puesto: 999,
          esCampeon: false,
          esFinalista: false,
          esSemifinalista: false,
          partidosGanados: 0,
          partidosPerdidos: 0,
          categoryId,
        });
      }
      // Jugador 2 (si existe)
      if (insc.jugador2Id && !resultadosPorJugador.has(insc.jugador2Id)) {
        resultadosPorJugador.set(insc.jugador2Id, {
          jugadorId: insc.jugador2Id,
          inscripcionId: insc.id,
          puesto: 999,
          esCampeon: false,
          esFinalista: false,
          esSemifinalista: false,
          partidosGanados: 0,
          partidosPerdidos: 0,
          categoryId,
        });
      }
    }

    // Procesar partidos para determinar puestos
    const final = partidos.find(p => p.ronda === RondaTipo.FINAL);
    const semis = partidos.filter(p => p.ronda === RondaTipo.SEMIS);
    const cuartos = partidos.filter(p => p.ronda === RondaTipo.CUARTOS);

    // Campeón y finalista
    if (final?.inscripcionGanadora) {
      const ganador = resultadosPorJugador.get(final.inscripcionGanadora.jugador1Id);
      if (ganador) {
        ganador.esCampeon = true;
        ganador.puesto = 1;
        ganador.partidosGanados++;
      }
      if (final.inscripcionGanadora.jugador2Id) {
        const ganador2 = resultadosPorJugador.get(final.inscripcionGanadora.jugador2Id);
        if (ganador2) {
          ganador2.esCampeon = true;
          ganador2.puesto = 1;
          ganador2.partidosGanados++;
        }
      }
    }

    if (final?.inscripcionPerdedora) {
      const perdedor = resultadosPorJugador.get(final.inscripcionPerdedora.jugador1Id);
      if (perdedor) {
        perdedor.esFinalista = true;
        perdedor.puesto = 2;
        perdedor.partidosPerdidos++;
      }
      if (final.inscripcionPerdedora.jugador2Id) {
        const perdedor2 = resultadosPorJugador.get(final.inscripcionPerdedora.jugador2Id);
        if (perdedor2) {
          perdedor2.esFinalista = true;
          perdedor2.puesto = 2;
          perdedor2.partidosPerdidos++;
        }
      }
    }

    // Semifinalistas (3ro-4to)
    for (const semi of semis) {
      if (semi.inscripcionPerdedora) {
        const perdedor = resultadosPorJugador.get(semi.inscripcionPerdedora.jugador1Id);
        if (perdedor) {
          perdedor.esSemifinalista = true;
          perdedor.puesto = Math.min(perdedor.puesto, 3);
          perdedor.partidosPerdidos++;
        }
        if (semi.inscripcionPerdedora.jugador2Id) {
          const perdedor2 = resultadosPorJugador.get(semi.inscripcionPerdedora.jugador2Id);
          if (perdedor2) {
            perdedor2.esSemifinalista = true;
            perdedor2.puesto = Math.min(perdedor2.puesto, 3);
            perdedor2.partidosPerdidos++;
          }
        }
      }
      // Los ganadores de semis ya fueron contados (finalistas/campeón)
      if (semi.inscripcionGanadora) {
        const ganador = resultadosPorJugador.get(semi.inscripcionGanadora.jugador1Id);
        if (ganador) ganador.partidosGanados++;
        if (semi.inscripcionGanadora.jugador2Id) {
          const ganador2 = resultadosPorJugador.get(semi.inscripcionGanadora.jugador2Id);
          if (ganador2) ganador2.partidosGanados++;
        }
      }
    }

    // Cuartos (5to-8vo)
    for (const cuarto of cuartos) {
      if (cuarto.inscripcionPerdedora) {
        const perdedor = resultadosPorJugador.get(cuarto.inscripcionPerdedora.jugador1Id);
        if (perdedor) {
          perdedor.puesto = Math.min(perdedor.puesto, 5);
          perdedor.partidosPerdidos++;
        }
        if (cuarto.inscripcionPerdedora.jugador2Id) {
          const perdedor2 = resultadosPorJugador.get(cuarto.inscripcionPerdedora.jugador2Id);
          if (perdedor2) {
            perdedor2.puesto = Math.min(perdedor2.puesto, 5);
            perdedor2.partidosPerdidos++;
          }
        }
      }
      if (cuarto.inscripcionGanadora) {
        const ganador = resultadosPorJugador.get(cuarto.inscripcionGanadora.jugador1Id);
        if (ganador) ganador.partidosGanados++;
        if (cuarto.inscripcionGanadora.jugador2Id) {
          const ganador2 = resultadosPorJugador.get(cuarto.inscripcionGanadora.jugador2Id);
          if (ganador2) ganador2.partidosGanados++;
        }
      }
    }

    // Actualizar rankings en la base de datos
    for (const resultado of resultadosPorJugador.values()) {
      await this.actualizarRankingJugador(resultado);
    }

    return {
      mensaje: 'Rankings actualizados correctamente',
      jugadoresActualizados: resultadosPorJugador.size,
    };
  }

  /**
   * Actualiza el ranking de un jugador específico
   */
  private async actualizarRankingJugador(resultado: ResultadoTorneo) {
    // Calcular puntos
    let puntosTorneo = 0;

    if (resultado.esCampeon) {
      puntosTorneo = PUNTOS_POR_PUESTO.CAMPEON;
    } else if (resultado.esFinalista) {
      puntosTorneo = PUNTOS_POR_PUESTO.FINALISTA;
    } else if (resultado.esSemifinalista) {
      puntosTorneo = PUNTOS_POR_PUESTO.SEMIFINALISTA;
    } else if (resultado.puesto <= 8) {
      puntosTorneo = PUNTOS_POR_PUESTO.CUARTOS;
    } else if (resultado.puesto <= 16) {
      puntosTorneo = PUNTOS_POR_PUESTO.OCTAVOS;
    } else {
      puntosTorneo = PUNTOS_POR_PUESTO.PARTICIPACION;
    }

    // Puntos por partidos ganados
    puntosTorneo += resultado.partidosGanados * PUNTOS_POR_PARTIDO_GANADO;

    const temporada = new Date().getFullYear().toString();

    // Actualizar ranking GLOBAL
    await this.upsertRanking({
      jugadorId: resultado.jugadorId,
      tipoRanking: TipoRanking.GLOBAL,
      puntos: puntosTorneo,
      resultado,
      temporada,
    });

    // Actualizar ranking por CATEGORÍA
    await this.upsertRanking({
      jugadorId: resultado.jugadorId,
      tipoRanking: TipoRanking.CATEGORIA,
      alcance: resultado.categoryId,
      referenciaAlcance: resultado.categoryId,
      puntos: puntosTorneo,
      resultado,
      temporada,
    });
  }

  /**
   * Crea o actualiza un registro de ranking
   */
  private async upsertRanking(data: {
    jugadorId: string;
    tipoRanking: TipoRanking;
    alcance?: string;
    referenciaAlcance?: string;
    puntos: number;
    resultado: ResultadoTorneo;
    temporada: string;
  }) {
    const existing = await this.prisma.ranking.findFirst({
      where: {
        jugadorId: data.jugadorId,
        tipoRanking: data.tipoRanking,
        alcance: data.alcance || null,
        temporada: data.temporada,
      },
    });

    if (existing) {
      // Actualizar
      await this.prisma.ranking.update({
        where: { id: existing.id },
        data: {
          puntosTotales: existing.puntosTotales + data.puntos,
          torneosJugados: existing.torneosJugados + 1,
          partidosGanados: existing.partidosGanados + data.resultado.partidosGanados,
          partidosPerdidos: existing.partidosPerdidos + data.resultado.partidosPerdidos,
          victorias: existing.victorias + (data.resultado.esCampeon ? 1 : 0),
          finales: existing.finales + (data.resultado.esFinalista ? 1 : 0),
          semifinales: existing.semifinales + (data.resultado.esSemifinalista ? 1 : 0),
          mejorPuestoHistorico: existing.mejorPuestoHistorico 
            ? Math.min(existing.mejorPuestoHistorico, data.resultado.puesto)
            : data.resultado.puesto,
        },
      });
    } else {
      // Crear nuevo
      await this.prisma.ranking.create({
        data: {
          jugadorId: data.jugadorId,
          tipoRanking: data.tipoRanking,
          alcance: data.alcance,
          referenciaAlcance: data.referenciaAlcance,
          puntosTotales: data.puntos,
          torneosJugados: 1,
          partidosGanados: data.resultado.partidosGanados,
          partidosPerdidos: data.resultado.partidosPerdidos,
          victorias: data.resultado.esCampeon ? 1 : 0,
          finales: data.resultado.esFinalista ? 1 : 0,
          semifinales: data.resultado.esSemifinalista ? 1 : 0,
          mejorPuestoHistorico: data.resultado.puesto,
          temporada: data.temporada,
        },
      });
    }
  }

  /**
   * Obtiene el ranking global
   */
  async getRankingGlobal(temporada?: string) {
    const temp = temporada || new Date().getFullYear().toString();

    return this.prisma.ranking.findMany({
      where: {
        tipoRanking: TipoRanking.GLOBAL,
        temporada: temp,
      },
      orderBy: { puntosTotales: 'desc' },
      include: {
        jugador: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            documento: true,
          },
        },
      },
      take: 100,
    });
  }

  /**
   * Obtiene el ranking por categoría
   */
  async getRankingPorCategoria(categoryId: string, temporada?: string) {
    const temp = temporada || new Date().getFullYear().toString();

    return this.prisma.ranking.findMany({
      where: {
        tipoRanking: TipoRanking.CATEGORIA,
        referenciaAlcance: categoryId,
        temporada: temp,
      },
      orderBy: { puntosTotales: 'desc' },
      include: {
        jugador: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            documento: true,
          },
        },
      },
      take: 100,
    });
  }

  /**
   * Obtiene el ranking de un jugador específico
   */
  async getRankingJugador(jugadorId: string) {
    return this.prisma.ranking.findMany({
      where: { jugadorId },
      orderBy: [
        { temporada: 'desc' },
        { puntosTotales: 'desc' },
      ],
    });
  }

  /**
   * Obtiene estadísticas de un jugador
   */
  async getEstadisticasJugador(jugadorId: string) {
    const rankings = await this.prisma.ranking.findMany({
      where: { jugadorId },
    });

    const global = rankings.find(r => r.tipoRanking === TipoRanking.GLOBAL);

    return {
      puntosTotales: global?.puntosTotales || 0,
      torneosJugados: global?.torneosJugados || 0,
      partidosGanados: global?.partidosGanados || 0,
      partidosPerdidos: global?.partidosPerdidos || 0,
      victorias: global?.victorias || 0,
      finales: global?.finales || 0,
      semifinales: global?.semifinales || 0,
      mejorPuesto: global?.mejorPuestoHistorico || null,
      rankingsPorCategoria: rankings.filter(r => r.tipoRanking === TipoRanking.CATEGORIA),
    };
  }
}
