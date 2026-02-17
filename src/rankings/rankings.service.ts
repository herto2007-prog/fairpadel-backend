import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RankingsService {
  constructor(private prisma: PrismaService) {}

  async obtenerRankings(tipo?: string, alcance?: string, genero?: string) {
    const where: any = {};

    if (tipo) {
      where.tipoRanking = tipo;
    }
    if (alcance) {
      where.alcance = alcance;
    }
    if (genero) {
      where.genero = genero;
    }

    const rankings = await this.prisma.ranking.findMany({
      where,
      include: {
        jugador: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            documento: true,
            genero: true,
            ciudad: true,
            fotoUrl: true,
            esPremium: true,
          },
        },
      },
      orderBy: {
        posicion: 'asc',
      },
    });

    return rankings;
  }

  async obtenerRankingGlobal(genero?: string) {
    return this.obtenerRankings('GLOBAL', undefined, genero);
  }

  async obtenerRankingPorPais(pais: string, genero?: string) {
    return this.obtenerRankings('PAIS', pais, genero);
  }

  async obtenerRankingPorCiudad(ciudad: string, genero?: string) {
    return this.obtenerRankings('CIUDAD', ciudad, genero);
  }

  async obtenerRankingPorCategoria(categoria: string, genero?: string) {
    return this.obtenerRankings('CATEGORIA', categoria, genero);
  }

  async obtenerTop10(genero?: string) {
    const where: any = { tipoRanking: 'GLOBAL' };
    if (genero) {
      where.genero = genero;
    }

    const top10 = await this.prisma.ranking.findMany({
      where,
      take: 10,
      include: {
        jugador: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            documento: true,
            genero: true,
            ciudad: true,
            fotoUrl: true,
            esPremium: true,
          },
        },
      },
      orderBy: {
        posicion: 'asc',
      },
    });

    return top10;
  }

  async obtenerRankingJugador(jugadorId: string) {
    const rankings = await this.prisma.ranking.findMany({
      where: { jugadorId },
      include: {
        jugador: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            documento: true,
            genero: true,
            ciudad: true,
            fotoUrl: true,
            esPremium: true,
          },
        },
      },
    });

    return rankings;
  }

  async obtenerHistorialPuntos(jugadorId: string) {
    const historial = await this.prisma.historialPuntos.findMany({
      where: { jugadorId },
      include: {
        tournament: {
          select: {
            id: true,
            nombre: true,
            ciudad: true,
            fechaInicio: true,
          },
        },
        category: {
          select: {
            id: true,
            nombre: true,
          },
        },
      },
      orderBy: {
        fechaTorneo: 'desc',
      },
    });

    return historial;
  }

  async actualizarRankings(tournamentId: string) {
    // Este método se llamará cuando un torneo finaliza
    // Calculará y actualizará los rankings de todos los jugadores

    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        partidos: {
          where: { ronda: { in: ['FINAL', 'SEMIFINAL', 'CUARTOS', 'OCTAVOS'] } },
          include: {
            category: true,
            parejaGanadora: {
              include: {
                jugador1: true,
                jugador2: true,
              },
            },
            parejaPerdedora: {
              include: {
                jugador1: true,
                jugador2: true,
              },
            },
          },
        },
      },
    });

    if (!tournament) {
      return;
    }

    // Tabla de puntos
    const puntosPorPosicion = {
      CAMPEON: 100,
      FINALISTA: 60,
      SEMIFINALISTA: 35,
      CUARTOS: 15,
      OCTAVOS: 8,
      PRIMERA_RONDA: 3,
    };

    // Procesar cada partido para asignar puntos
    for (const partido of tournament.partidos) {
      if (!partido.parejaGanadora || !partido.parejaPerdedora) {
        continue;
      }

      let puntos = 0;
      let posicion = '';

      if (partido.ronda === 'FINAL') {
        puntos = puntosPorPosicion.CAMPEON;
        posicion = 'CAMPEON';
        await this.registrarPuntos(
          partido.parejaGanadora,
          tournamentId,
          partido.categoryId,
          puntos,
          posicion,
        );

        puntos = puntosPorPosicion.FINALISTA;
        posicion = 'FINALISTA';
        await this.registrarPuntos(
          partido.parejaPerdedora,
          tournamentId,
          partido.categoryId,
          puntos,
          posicion,
        );
      } else if (partido.ronda === 'SEMIFINAL') {
        puntos = puntosPorPosicion.SEMIFINALISTA;
        posicion = 'SEMIFINALISTA';
        await this.registrarPuntos(
          partido.parejaPerdedora,
          tournamentId,
          partido.categoryId,
          puntos,
          posicion,
        );
      } else if (partido.ronda === 'CUARTOS') {
        puntos = puntosPorPosicion.CUARTOS;
        posicion = 'CUARTOS';
        await this.registrarPuntos(
          partido.parejaPerdedora,
          tournamentId,
          partido.categoryId,
          puntos,
          posicion,
        );
      }
    }

    // Recalcular posiciones en todos los rankings
    await this.recalcularPosiciones();

    return { message: 'Rankings actualizados' };
  }

  private async registrarPuntos(
    pareja: any,
    tournamentId: string,
    categoryId: string,
    puntos: number,
    posicion: string,
  ) {
    const jugadores = [pareja.jugador1, pareja.jugador2].filter(Boolean);

    for (const jugador of jugadores) {
      // Registrar en historial
      await this.prisma.historialPuntos.create({
        data: {
          jugadorId: jugador.id,
          tournamentId,
          categoryId,
          posicionFinal: posicion,
          puntosGanados: puntos,
          fechaTorneo: new Date(),
        },
      });

      // Actualizar o crear ranking global
      await this.actualizarRankingJugador(jugador.id, puntos);
    }
  }

  async actualizarRankingJugador(jugadorId: string, puntosNuevos: number) {
    const jugador = await this.prisma.user.findUnique({
      where: { id: jugadorId },
    });

    if (!jugador) {
      return;
    }

    // Buscar ranking global existente
    let ranking = await this.prisma.ranking.findFirst({
      where: {
        jugadorId,
        tipoRanking: 'GLOBAL',
        alcance: 'GLOBAL',
      },
    });

    if (ranking) {
      // Actualizar puntos
      await this.prisma.ranking.update({
        where: { id: ranking.id },
        data: {
          puntosTotales: ranking.puntosTotales + puntosNuevos,
          torneosJugados: ranking.torneosJugados + 1,
          ultimaActualizacion: new Date(),
        },
      });
    } else {
      // Crear ranking
      await this.prisma.ranking.create({
        data: {
          jugadorId,
          tipoRanking: 'GLOBAL',
          alcance: 'GLOBAL',
          genero: jugador.genero,
          puntosTotales: puntosNuevos,
          posicion: 999999, // Se recalculará
          torneosJugados: 1,
        },
      });
    }
  }

  async recalcularPosiciones() {
    // Recalcular posiciones globales
    const rankingsGlobales = await this.prisma.ranking.findMany({
      where: { tipoRanking: 'GLOBAL' },
      orderBy: { puntosTotales: 'desc' },
    });

    let posicion = 1;
    for (const ranking of rankingsGlobales) {
      await this.prisma.ranking.update({
        where: { id: ranking.id },
        data: {
          posicionAnterior: ranking.posicion,
          posicion,
        },
      });
      posicion++;
    }
  }
  async recalcularRankings() {
    // Este método se puede llamar desde el admin
    // para recalcular todos los rankings manualmente
    console.log('Recalculando rankings globales...');
    // Implementación futura si es necesario
    return { message: 'Rankings recalculados' };
  }

  /**
   * Update win/loss stats and streak for a player after a match result.
   * Called from MatchesService after cargarResultado().
   */
  async actualizarEstadisticasPartido(
    jugadorId: string,
    esVictoria: boolean,
    esCampeonato: boolean,
  ) {
    const jugador = await this.prisma.user.findUnique({
      where: { id: jugadorId },
      select: { id: true, genero: true },
    });

    if (!jugador) return;

    // Find or create GLOBAL ranking
    let ranking = await this.prisma.ranking.findFirst({
      where: {
        jugadorId,
        tipoRanking: 'GLOBAL',
        alcance: 'GLOBAL',
      },
    });

    if (!ranking) {
      ranking = await this.prisma.ranking.create({
        data: {
          jugadorId,
          tipoRanking: 'GLOBAL',
          alcance: 'GLOBAL',
          genero: jugador.genero,
          puntosTotales: 0,
          posicion: 999999,
          torneosJugados: 0,
        },
      });
    }

    const updateData: any = {
      ultimaActualizacion: new Date(),
    };

    if (esVictoria) {
      updateData.victorias = { increment: 1 };
      updateData.rachaActual = ranking.rachaActual >= 0 ? ranking.rachaActual + 1 : 1;
    } else {
      updateData.derrotas = { increment: 1 };
      updateData.rachaActual = 0;
    }

    if (esCampeonato && esVictoria) {
      updateData.campeonatos = { increment: 1 };
    }

    // Update win percentage
    const newVictorias = (ranking.victorias || 0) + (esVictoria ? 1 : 0);
    const newDerrotas = (ranking.derrotas || 0) + (esVictoria ? 0 : 1);
    const totalPartidos = newVictorias + newDerrotas;
    if (totalPartidos > 0) {
      updateData.porcentajeVictorias = Number(
        ((newVictorias / totalPartidos) * 100).toFixed(2),
      );
    }

    // Update best position if current is better
    if (ranking.posicion < (ranking.mejorPosicion || 999999)) {
      updateData.mejorPosicion = ranking.posicion;
    }

    await this.prisma.ranking.update({
      where: { id: ranking.id },
      data: updateData,
    });
  }
}