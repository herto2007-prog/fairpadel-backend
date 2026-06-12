import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AmericanoComunService } from './americano-comun.service';
import { ConfigAmericano } from './americano.service';

interface StatsPartido {
  ganoA: boolean;
  setsGanadosA: number;
  setsGanadosB: number;
  gamesTotalA: number;
  gamesTotalB: number;
  puntosA?: number;
  puntosB?: number;
}

@Injectable()
export class AmericanoResultadosService {
  constructor(
    private prisma: PrismaService,
    private comun: AmericanoComunService,
  ) {}

  async getClasificacionTorneo(torneoId: string, grupoId?: string) {
    const torneo = await this.prisma.tournament.findUnique({
      where: { id: torneoId },
      include: {
        americanosRonda: {
          where: grupoId ? { grupoId } : undefined,
          include: {
            puntajes: {
              include: {
                jugador: { select: { id: true, nombre: true, apellido: true, fotoUrl: true } },
              },
            },
            grupo: true,
          },
        },
      },
    });

    if (!torneo) {
      throw new NotFoundException('Torneo no encontrado');
    }

    if (grupoId) {
      // Clasificación de un grupo específico
      const rondasDelGrupo = torneo.americanosRonda.filter(r => r.grupoId === grupoId);
      const ultimaRonda = rondasDelGrupo.sort((a, b) => b.numero - a.numero)[0];
      if (!ultimaRonda) return [];

      return ultimaRonda.puntajes.map((p) => ({
        jugadorId: p.jugador.id,
        nombre: p.jugador.nombre,
        apellido: p.jugador.apellido,
        fotoUrl: p.jugador.fotoUrl,
        puntosTotal: p.puntos,
        partidosJugados: p.partidosJugados,
        partidosGanados: p.partidosGanados,
        partidosPerdidos: p.partidosPerdidos,
        setsGanados: p.setsGanados,
        setsPerdidos: p.setsPerdidos,
        gamesGanados: p.gamesGanados,
        gamesPerdidos: p.gamesPerdidos,
        diferenciaGames: p.diferenciaGames,
      })).sort((a, b) => {
        if (b.puntosTotal !== a.puntosTotal) return b.puntosTotal - a.puntosTotal;
        if (b.diferenciaGames !== a.diferenciaGames) return b.diferenciaGames - a.diferenciaGames;
        return b.gamesGanados - a.gamesGanados;
      });
    }

    // Clasificación de todos los grupos (devolver agrupado)
    const clasificacionesPorGrupo = new Map<string, { grupoId: string; grupoNombre: string; puntajes: any[] }>();

    for (const ronda of torneo.americanosRonda) {
      if (!ronda.grupoId || !ronda.grupo) continue;
      const key = ronda.grupoId;
      if (!clasificacionesPorGrupo.has(key)) {
        clasificacionesPorGrupo.set(key, { grupoId: key, grupoNombre: ronda.grupo.nombre, puntajes: [] });
      }
      // Solo nos quedamos con la última ronda de cada grupo (mayor numero)
      const actual = clasificacionesPorGrupo.get(key)!;
      if (!actual.puntajes.length || ronda.numero > torneo.americanosRonda.find(r => r.grupoId === key && r.puntajes.length > 0)?.numero!) {
        actual.puntajes = ronda.puntajes.map((p) => ({
          jugadorId: p.jugador.id,
          nombre: p.jugador.nombre,
          apellido: p.jugador.apellido,
          fotoUrl: p.jugador.fotoUrl,
          puntosTotal: p.puntos,
          partidosJugados: p.partidosJugados,
          partidosGanados: p.partidosGanados,
          partidosPerdidos: p.partidosPerdidos,
          setsGanados: p.setsGanados,
          setsPerdidos: p.setsPerdidos,
          gamesGanados: p.gamesGanados,
          gamesPerdidos: p.gamesPerdidos,
          diferenciaGames: p.diferenciaGames,
        })).sort((a: any, b: any) => {
          if (b.puntosTotal !== a.puntosTotal) return b.puntosTotal - a.puntosTotal;
          if (b.diferenciaGames !== a.diferenciaGames) return b.diferenciaGames - a.diferenciaGames;
          return b.gamesGanados - a.gamesGanados;
        });
      }
    }

    // Elegir la ronda con mayor numero por grupo
    const resultado: { grupoId: string; grupoNombre: string; clasificacion: any[] }[] = [];
    for (const [grupoIdKey, data] of clasificacionesPorGrupo) {
      resultado.push({
        grupoId: grupoIdKey,
        grupoNombre: data.grupoNombre,
        clasificacion: data.puntajes,
      });
    }

    // Si hay un solo grupo, devolver plano para compatibilidad con frontend legacy
    if (resultado.length === 1) {
      return resultado[0].clasificacion;
    }

    return resultado;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // RESULTADOS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Stats normalizados de un partido, independientemente del formato.
   */
  private calcularStatsSets(sets: { gamesEquipoA: number; gamesEquipoB: number }[]) {
    let setsGanadosA = 0;
    let setsGanadosB = 0;
    let gamesTotalA = 0;
    let gamesTotalB = 0;

    for (const set of sets) {
      gamesTotalA += set.gamesEquipoA;
      gamesTotalB += set.gamesEquipoB;
      if (set.gamesEquipoA > set.gamesEquipoB) {
        setsGanadosA++;
      } else if (set.gamesEquipoB > set.gamesEquipoA) {
        setsGanadosB++;
      }
    }

    return { setsGanadosA, setsGanadosB, gamesTotalA, gamesTotalB, ganoA: setsGanadosA > setsGanadosB };
  }

  private calcularPuntosSegunSistema(
    stats: { ganoA: boolean; gamesTotalA: number; gamesTotalB: number; setsGanadosA: number; setsGanadosB: number; puntosA?: number; puntosB?: number },
    esEquipoA: boolean,
    sistemaPuntos: string,
  ): number {
    switch (sistemaPuntos) {
      case 'games':
        return esEquipoA ? stats.gamesTotalA : stats.gamesTotalB;
      case 'sets':
        return esEquipoA ? stats.setsGanadosA : stats.setsGanadosB;
      case 'partido':
        return esEquipoA ? (stats.ganoA ? 1 : 0) : (stats.ganoA ? 0 : 1);
      case 'diferencia':
        return esEquipoA
          ? stats.gamesTotalA - stats.gamesTotalB
          : stats.gamesTotalB - stats.gamesTotalA;
      case 'puntosFijos':
        return esEquipoA ? (stats.puntosA ?? 0) : (stats.puntosB ?? 0);
      default:
        // Fallback a games para backward compatibility
        return esEquipoA ? stats.gamesTotalA : stats.gamesTotalB;
    }
  }

  async registrarResultado(
    torneoId: string,
    rondaId: string,
    parejaAId: string,
    parejaBId: string,
    sets: { gamesEquipoA: number; gamesEquipoB: number }[] | undefined,
    puntosA: number | undefined,
    puntosB: number | undefined,
    organizadorId: string,
  ) {
    await this.comun.validarRateLimit(torneoId);

    const torneo = await this.prisma.tournament.findUnique({
      where: { id: torneoId },
    });

    if (!torneo) {
      throw new NotFoundException('Torneo no encontrado');
    }

    await this.comun.verificarPermiso(torneoId, organizadorId);

    const config = (torneo.configAmericano ?? {}) as unknown as ConfigAmericano;
    const modoJuego = config.modoJuego;
    const sistemaPuntos = modoJuego?.sistemaPuntos ?? 'games';
    const formatoPartido = modoJuego?.formatoPartido ?? 'mejorDe3Sets';
    const valorObjetivo = modoJuego?.valorObjetivo ?? 0;

    const ronda = await this.prisma.americanoRonda.findUnique({
      where: { id: rondaId },
      include: {
        parejas: {
          include: {
            jugador1: true,
            jugador2: true,
          },
        },
      },
    });

    if (!ronda || ronda.torneoId !== torneoId) {
      throw new NotFoundException('Ronda no encontrada');
    }

    const parejaA = ronda.parejas.find(p => p.id === parejaAId);
    const parejaB = ronda.parejas.find(p => p.id === parejaBId);

    if (!parejaA || !parejaB) {
      throw new BadRequestException('Parejas no encontradas en esta ronda');
    }

    // Validar entrada según formato de partido
    let statsNuevos: StatsPartido;
    let setsAGuardar: any;

    if (formatoPartido === 'puntosFijos') {
      if (puntosA === undefined || puntosB === undefined) {
        throw new BadRequestException('Se requieren puntosA y puntosB para el formato puntos fijos');
      }
      if (puntosA + puntosB !== valorObjetivo) {
        throw new BadRequestException(`La suma de puntos debe ser exactamente ${valorObjetivo}`);
      }
      if (puntosA < 0 || puntosB < 0) {
        throw new BadRequestException('Los puntos no pueden ser negativos');
      }
      statsNuevos = {
        ganoA: puntosA > puntosB,
        setsGanadosA: 0,
        setsGanadosB: 0,
        gamesTotalA: puntosA,
        gamesTotalB: puntosB,
        puntosA,
        puntosB,
      };
      setsAGuardar = { puntosA, puntosB };
    } else {
      // Formatos tradicionales con sets
      if (!sets || sets.length < 1) {
        throw new BadRequestException('Se requiere al menos un set');
      }
      statsNuevos = this.calcularStatsSets(sets);
      setsAGuardar = sets;
    }

    // Buscar y actualizar el partido correspondiente
    const partido = await this.prisma.americanoPartido.findFirst({
      where: {
        rondaId,
        OR: [
          { parejaAId, parejaBId },
          { parejaAId: parejaBId, parejaBId: parejaAId },
        ],
      },
    });

    if (!partido) {
      throw new BadRequestException('No se encontró el partido entre estas parejas en esta ronda');
    }

    const esEdicion = partido.estado === 'FINALIZADO';

    // Si es nuevo registro (no edición), validar que ronda esté EN_JUEGO
    if (!esEdicion && ronda.estado !== 'EN_JUEGO') {
      throw new BadRequestException('La ronda no está en juego');
    }

    // Determinar sistema y stats previos para edición
    let sistemaPuntosOriginal: string | null = null;
    let statsPrevios: StatsPartido | null = null;

    if (esEdicion) {
      // Sistema persistido en el partido (crítico para revertir correctamente)
      sistemaPuntosOriginal = partido.sistemaPuntos ?? null;

      if (!sistemaPuntosOriginal) {
        // Backward compatibility: datos antiguos no tienen sistemaPuntos guardado.
        // Inferimos del formato de los sets almacenados.
        if (partido.sets && Array.isArray(partido.sets)) {
          sistemaPuntosOriginal = 'games';
          statsPrevios = this.calcularStatsSets(partido.sets as { gamesEquipoA: number; gamesEquipoB: number }[]);
        } else if (partido.sets && typeof partido.sets === 'object' && 'puntosA' in (partido.sets as any)) {
          sistemaPuntosOriginal = 'puntosFijos';
          const prev = partido.sets as { puntosA: number; puntosB: number };
          statsPrevios = {
            ganoA: prev.puntosA > prev.puntosB,
            setsGanadosA: 0,
            setsGanadosB: 0,
            gamesTotalA: prev.puntosA,
            gamesTotalB: prev.puntosB,
            puntosA: prev.puntosA,
            puntosB: prev.puntosB,
          };
        }
      } else {
        // Tenemos sistemaPuntos guardado: recalcular stats desde los sets almacenados
        if (partido.sets && Array.isArray(partido.sets)) {
          statsPrevios = this.calcularStatsSets(partido.sets as { gamesEquipoA: number; gamesEquipoB: number }[]);
        } else if (partido.sets && typeof partido.sets === 'object' && 'puntosA' in (partido.sets as any)) {
          const prev = partido.sets as { puntosA: number; puntosB: number };
          statsPrevios = {
            ganoA: prev.puntosA > prev.puntosB,
            setsGanadosA: 0,
            setsGanadosB: 0,
            gamesTotalA: prev.puntosA,
            gamesTotalB: prev.puntosB,
            puntosA: prev.puntosA,
            puntosB: prev.puntosB,
          };
        }
      }
    }

    const jugadoresA = [parejaA.jugador1Id, parejaA.jugador2Id];
    const jugadoresB = [parejaB.jugador1Id, parejaB.jugador2Id];

    await this.prisma.$transaction(async (tx) => {
      await tx.americanoPartido.update({
        where: { id: partido.id },
        data: {
          estado: 'FINALIZADO',
          sets: setsAGuardar as any,
          sistemaPuntos,
          formatoPartido,
        },
      });

      for (const jugadorId of [...jugadoresA, ...jugadoresB]) {
        const puntaje = await tx.americanoPuntaje.findUnique({
          where: {
            rondaId_jugadorId: {
              rondaId,
              jugadorId,
            },
          },
        });

        if (!puntaje) continue;

        const esEquipoA = jugadoresA.includes(jugadorId);

        // Si es edición, revertir valores anteriores
        if (statsPrevios && sistemaPuntosOriginal) {
          const ganoPrev = esEquipoA ? statsPrevios.ganoA : !statsPrevios.ganoA;
          const gamesGanadosPrev = esEquipoA ? statsPrevios.gamesTotalA : statsPrevios.gamesTotalB;
          const gamesPerdidosPrev = esEquipoA ? statsPrevios.gamesTotalB : statsPrevios.gamesTotalA;
          const setsGPrev = esEquipoA ? statsPrevios.setsGanadosA : statsPrevios.setsGanadosB;
          const setsPPrev = esEquipoA ? statsPrevios.setsGanadosB : statsPrevios.setsGanadosA;

          // Revertir PUNTOS usando el sistema original
          const puntosRevertidos = this.calcularPuntosSegunSistema(
            statsPrevios,
            esEquipoA,
            sistemaPuntosOriginal,
          );
          puntaje.puntos -= puntosRevertidos;

          // Revertir estadísticas secundarias (siempre iguales sin importar el sistema)
          puntaje.partidosJugados -= 1;
          puntaje.partidosGanados -= ganoPrev ? 1 : 0;
          puntaje.partidosPerdidos -= !ganoPrev ? 1 : 0;
          puntaje.setsGanados -= setsGPrev;
          puntaje.setsPerdidos -= setsPPrev;
          puntaje.gamesGanados -= gamesGanadosPrev;
          puntaje.gamesPerdidos -= gamesPerdidosPrev;
          puntaje.diferenciaGames -= (gamesGanadosPrev - gamesPerdidosPrev);
        }

        // Aplicar nuevos valores
        const gano = esEquipoA ? statsNuevos.ganoA : !statsNuevos.ganoA;
        const gamesGanadosPartido = esEquipoA ? statsNuevos.gamesTotalA : statsNuevos.gamesTotalB;
        const gamesPerdidosPartido = esEquipoA ? statsNuevos.gamesTotalB : statsNuevos.gamesTotalA;
        const setsG = esEquipoA ? statsNuevos.setsGanadosA : statsNuevos.setsGanadosB;
        const setsP = esEquipoA ? statsNuevos.setsGanadosB : statsNuevos.setsGanadosA;

        // Calcular puntos según sistema ACTUAL
        const puntosNuevos = this.calcularPuntosSegunSistema(statsNuevos, esEquipoA, sistemaPuntos);

        await tx.americanoPuntaje.update({
          where: { id: puntaje.id },
          data: {
            puntos: puntaje.puntos + puntosNuevos,
            partidosJugados: puntaje.partidosJugados + 1,
            partidosGanados: gano ? puntaje.partidosGanados + 1 : puntaje.partidosGanados,
            partidosPerdidos: !gano ? puntaje.partidosPerdidos + 1 : puntaje.partidosPerdidos,
            setsGanados: puntaje.setsGanados + setsG,
            setsPerdidos: puntaje.setsPerdidos + setsP,
            gamesGanados: puntaje.gamesGanados + gamesGanadosPartido,
            gamesPerdidos: puntaje.gamesPerdidos + gamesPerdidosPartido,
            diferenciaGames: puntaje.diferenciaGames + (gamesGanadosPartido - gamesPerdidosPartido),
          },
        });
      }
    });

    return {
      message: esEdicion ? 'Resultado actualizado' : 'Resultado registrado',
      ganador: statsNuevos.ganoA ? 'Equipo A' : 'Equipo B',
      setsGanadosA: statsNuevos.setsGanadosA,
      setsGanadosB: statsNuevos.setsGanadosB,
      gamesTotalA: statsNuevos.gamesTotalA,
      gamesTotalB: statsNuevos.gamesTotalB,
    };
  }
}
