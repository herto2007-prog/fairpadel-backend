import { Injectable, NotFoundException } from '@nestjs/common';
import { TipoRanking } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { DateService } from '../../common/services/date.service';
import { QueryRankingsDto } from './dto/query-rankings.dto';
import { CreateConfigPuntosDto, UpdateConfigPuntosDto } from './dto/create-config-puntos.dto';
import { CreateReglaAscensoDto, UpdateReglaAscensoDto } from './dto/create-regla-ascenso.dto';
import { PushService } from '../push/push.service';
import {
  detectarCandidatosAscenso,
  ResultadoTorneo,
} from './ascenso-utils';

@Injectable()
export class RankingsService {
  constructor(
    private prisma: PrismaService,
    private dateService: DateService,
    private pushService: PushService,
  ) {}

  // ═══════════════════════════════════════════════════════════
  // CONFIGURACIÓN DE PUNTOS (Admin)
  // ═══════════════════════════════════════════════════════════

  async getConfigPuntos() {
    const configs = await this.prisma.configuracionPuntos.findMany({
      orderBy: { orden: 'asc' },
    });
    return { success: true, data: configs };
  }

  async createConfigPuntos(dto: CreateConfigPuntosDto) {
    const config = await this.prisma.configuracionPuntos.create({
      data: dto,
    });
    return { success: true, data: config };
  }

  async updateConfigPuntos(id: string, dto: UpdateConfigPuntosDto) {
    const config = await this.prisma.configuracionPuntos.update({
      where: { id },
      data: dto,
    });
    return { success: true, data: config };
  }

  // ═══════════════════════════════════════════════════════════
  // REGLAS DE ASCENSO (Admin)
  // ═══════════════════════════════════════════════════════════

  async getReglasAscenso() {
    const reglas = await this.prisma.reglaAscenso.findMany({
      include: {
        categoriaOrigen: true,
        categoriaDestino: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return { success: true, data: reglas };
  }

  async createReglaAscenso(dto: CreateReglaAscensoDto) {
    const regla = await this.prisma.reglaAscenso.create({
      data: {
        ...dto,
        tipoConteo: dto.tipoConteo || 'ALTERNADOS',
        mesesVentana: dto.mesesVentana || 12,
      },
      include: {
        categoriaOrigen: true,
        categoriaDestino: true,
      },
    });
    return { success: true, data: regla };
  }

  async updateReglaAscenso(id: string, dto: UpdateReglaAscensoDto) {
    const regla = await this.prisma.reglaAscenso.update({
      where: { id },
      data: dto,
      include: {
        categoriaOrigen: true,
        categoriaDestino: true,
      },
    });
    return { success: true, data: regla };
  }

  // ═══════════════════════════════════════════════════════════
  // CÁLCULO DE PUNTOS (Cuando finaliza un torneo)
  // ═══════════════════════════════════════════════════════════

  async calcularPuntosTorneo(tournamentId: string, categoryId: string) {
    // Obtener torneo con multiplicador
    const torneo = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { multiplicadorPuntos: true, nombre: true, fechaInicio: true },
    });

    if (!torneo) {
      throw new NotFoundException('Torneo no encontrado');
    }

    // Protección contra duplicados
    const existentes = await this.prisma.historialPuntos.count({
      where: { tournamentId, categoryId },
    });
    if (existentes > 0) {
      throw new Error(`Ya existen ${existentes} registros de historial_puntos para este torneo/categoría. Si deseas recalcular, elimínalos primero.`);
    }

    // Buscar circuito aprobado del torneo
    const torneoCircuito = await this.prisma.torneoCircuito.findFirst({
      where: { torneoId: tournamentId, estado: 'APROBADO' },
      include: { circuito: true },
    });

    // Calcular multiplicador final
    let multiplicadorFinal = torneo.multiplicadorPuntos;
    if (torneoCircuito?.circuito) {
      multiplicadorFinal *= (torneoCircuito.multiplicador || 1) * (torneoCircuito.circuito.multiplicadorGlobal || 1);
    }

    // Obtener partidos finalizados de esta categoría
    const partidos = await this.prisma.match.findMany({
      where: {
        tournamentId,
        categoryId,
        estado: 'FINALIZADO',
        inscripcionGanadoraId: { not: null },
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

    // Determinar posiciones según la fase del bracket
    const resultados = await this.determinarPosiciones(partidos, tournamentId, categoryId);

    // Aplicar puntos según configuración
    const configs = await this.prisma.configuracionPuntos.findMany({
      where: { activo: true },
    });

    const puntosCalculados = [];

    for (const resultado of resultados) {
      const config = this.encontrarConfigParaPosicion(configs, resultado.posicion);
      if (config) {
        const puntosFinales = Math.round(config.puntosBase * multiplicadorFinal);
        
        // Guardar en historial
        for (const jugadorId of resultado.jugadoresIds) {
          const historial = await this.prisma.historialPuntos.create({
            data: {
              jugadorId,
              tournamentId,
              categoryId,
              posicionFinal: resultado.posicion,
              puntosGanados: puntosFinales,
              puntosBase: config.puntosBase,
              multiplicadorAplicado: multiplicadorFinal,
              // FIX: fechaTorneo es String YYYY-MM-DD
              fechaTorneo: new Date().toISOString().split('T')[0],
            },
          });
          puntosCalculados.push(historial);

          // Aviso (in-app + push): sumaste puntos / tu ranking se movió.
          if (puntosFinales > 0) {
            await this.pushService.notificar(jugadorId, {
              tipo: 'RANKING',
              titulo: 'Sumaste puntos 🎾',
              contenido: `Ganaste ${puntosFinales} puntos en ${torneo.nombre} (${resultado.posicion}). ¡Tu ranking se movió!`,
              enlace: '/mijuego',
            });
          }
        }
      }
    }

    // Actualizar rankings
    const temporada = torneo.fechaInicio.substring(0, 4);
    await this.actualizarRankingsCategoria(categoryId, temporada);
    if (torneoCircuito?.circuito) {
      await this.actualizarRankingsCircuito(torneoCircuito.circuito.id, categoryId, temporada);
    }
    await this.actualizarRankingsGlobal(temporada);

    return {
      success: true,
      message: 'Puntos calculados y guardados',
      data: {
        torneo: torneo.nombre,
        multiplicador: multiplicadorFinal,
        puntosAsignados: puntosCalculados.length,
      },
    };
  }

  private async determinarPosiciones(partidos: any[], tournamentId: string, categoryId: string) {
    // Obtener fixture para entender la estructura
    const fixtureVersion = await this.prisma.fixtureVersion.findFirst({
      where: {
        tournamentId,
        categoryId,
        estado: 'PUBLICADO',
      },
    });

    const resultados = [];

    // Encontrar final
    const final = partidos.find(p => p.ronda === 'FINAL');
    if (final) {
      // Campeón
      resultados.push({
        posicion: '1ro',
        jugadoresIds: [
          final.inscripcionGanadora.jugador1Id,
          final.inscripcionGanadora.jugador2Id,
        ].filter(Boolean),
      });
      // Subcampeón
      resultados.push({
        posicion: '2do',
        jugadoresIds: [
          final.inscripcionPerdedora.jugador1Id,
          final.inscripcionPerdedora.jugador2Id,
        ].filter(Boolean),
      });
    }

    // Semifinalistas (3ro-4to)
    const semis = partidos.filter(p => p.ronda === 'SEMIS');
    for (const semi of semis) {
      resultados.push({
        posicion: '3ro-4to',
        jugadoresIds: [
          semi.inscripcionPerdedora.jugador1Id,
          semi.inscripcionPerdedora.jugador2Id,
        ].filter(Boolean),
      });
    }

    // Cuartos (5to-8vo)
    const cuartos = partidos.filter(p => p.ronda === 'CUARTOS');
    for (const cuarto of cuartos) {
      resultados.push({
        posicion: '5to-8vo',
        jugadoresIds: [
          cuarto.inscripcionPerdedora.jugador1Id,
          cuarto.inscripcionPerdedora.jugador2Id,
        ].filter(Boolean),
      });
    }

    // Octavos (9no-16to)
    const octavos = partidos.filter(p => p.ronda === 'OCTAVOS');
    for (const octavo of octavos) {
      resultados.push({
        posicion: '9no-16to',
        jugadoresIds: [
          octavo.inscripcionPerdedora.jugador1Id,
          octavo.inscripcionPerdedora.jugador2Id,
        ].filter(Boolean),
      });
    }

    return resultados;
  }

  private encontrarConfigParaPosicion(configs: any[], posicion: string) {
    // Buscar coincidencia exacta primero
    let config = configs.find(c => c.posicion === posicion);
    
    // Si no hay, buscar rangos
    if (!config) {
      if (posicion.startsWith('3ro') || posicion.startsWith('4to')) {
        config = configs.find(c => c.posicion === '3ro-4to');
      } else if (['5to', '6to', '7mo', '8vo'].some(p => posicion.startsWith(p))) {
        config = configs.find(c => c.posicion === '5to-8vo');
      } else if (['9no', '10mo', '11vo', '12do', '13ro', '14to', '15to', '16to'].some(p => posicion.startsWith(p))) {
        config = configs.find(c => c.posicion === '9no-16to');
      }
    }

    return config;
  }

  async actualizarRankingsCategoria(categoryId: string, temporada: string): Promise<void> {
    const torneoIds = await this.obtenerTorneosEnCircuitosAprobados();
    if (torneoIds.length === 0) return;

    const historiales = await this.prisma.historialPuntos.groupBy({
      by: ['jugadorId'],
      where: {
        categoryId,
        tournamentId: { in: torneoIds },
        fechaTorneo: { startsWith: temporada },
      },
      _sum: { puntosGanados: true },
      _count: { id: true },
    });

    await this.upsertRankings(historiales, 'CATEGORIA', categoryId, temporada);
  }

  async actualizarRankingsGlobal(temporada: string): Promise<void> {
    const torneoIds = await this.obtenerTorneosEnCircuitosAprobados();
    if (torneoIds.length === 0) return;

    const historiales = await this.prisma.historialPuntos.groupBy({
      by: ['jugadorId'],
      where: {
        tournamentId: { in: torneoIds },
        fechaTorneo: { startsWith: temporada },
      },
      _sum: { puntosGanados: true },
      _count: { id: true },
    });

    await this.upsertRankings(historiales, 'GLOBAL', '', temporada);
  }

  async actualizarRankingsCircuito(circuitoId: string, categoryId: string, temporada: string): Promise<void> {
    const torneosCircuito = await this.prisma.torneoCircuito.findMany({
      where: { circuitoId, estado: 'APROBADO', puntosValidos: true },
      include: { torneo: { select: { id: true, multiplicadorPuntos: true } } },
    });
    const torneoIds = torneosCircuito.map(t => t.torneoId);
    if (torneoIds.length === 0) return;

    const historiales = await this.prisma.historialPuntos.findMany({
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
      const tc = torneosCircuito.find(t => t.torneoId === h.tournamentId);
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

    await this.upsertRankings(historialesRecalculados, 'LIGA', circuitoId, temporada);
  }

  private async obtenerTorneosEnCircuitosAprobados(): Promise<string[]> {
    const torneos = await this.prisma.torneoCircuito.findMany({
      where: { estado: 'APROBADO' },
      select: { torneoId: true },
    });
    return [...new Set(torneos.map(t => t.torneoId))];
  }

  private async upsertRankings(
    historiales: any[],
    tipoRanking: TipoRanking,
    alcance: string,
    temporada: string,
  ): Promise<void> {
    if (historiales.length === 0) return;

    const jugadorIds = historiales.map(h => h.jugadorId);
    const jugadores = await this.prisma.user.findMany({
      where: { id: { in: jugadorIds } },
      select: { id: true, genero: true },
    });
    const generoMap = new Map(jugadores.map(j => [j.id, j.genero]));

    const ordenados = historiales.sort((a, b) => (b._sum.puntosGanados || 0) - (a._sum.puntosGanados || 0));

    let posicion = 1;
    for (let i = 0; i < ordenados.length; i++) {
      const { jugadorId, _sum, _count } = ordenados[i];
      const puntosTotales = _sum.puntosGanados || 0;
      const torneosJugados = _count.id;

      if (i > 0 && puntosTotales !== (ordenados[i - 1]._sum.puntosGanados || 0)) {
        posicion = i + 1;
      }

      await this.prisma.ranking.upsert({
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
          ultimaActualizacion: this.dateService.now(),
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
  }

  // ═══════════════════════════════════════════════════════════
  // CONSULTA DE RANKINGS (Público)
  // ═══════════════════════════════════════════════════════════

  async getRankings(query: QueryRankingsDto) {
    const where: any = {};

    if (query.categoriaId) {
      where.alcance = query.categoriaId;
      where.tipoRanking = 'CATEGORIA';
    } else if (query.ciudad) {
      where.alcance = query.ciudad;
      where.tipoRanking = 'CIUDAD';
    } else if (query.circuitoId) {
      where.alcance = query.circuitoId;
      where.tipoRanking = 'LIGA';
    } else {
      where.tipoRanking = 'GLOBAL';
    }

    if (query.genero) {
      where.genero = query.genero;
    }

    where.temporada = query.temporada || new Date().getFullYear().toString();

    const rankings = await this.prisma.ranking.findMany({
      where,
      include: {
        jugador: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            fotoUrl: true,
            categoriaActual: {
              select: { nombre: true },
            },
          },
        },
      },
      orderBy: { posicion: 'asc' },
      take: 100,
    });

    return { success: true, data: rankings };
  }

  async getRankingJugador(jugadorId: string) {
    const rankings = await this.prisma.ranking.findMany({
      where: { jugadorId },
      include: {
        jugador: {
          select: {
            nombre: true,
            apellido: true,
            fotoUrl: true,
          },
        },
      },
      orderBy: { ultimaActualizacion: 'desc' },
    });

    const historial = await this.prisma.historialPuntos.findMany({
      where: { jugadorId },
      include: {
        tournament: { select: { nombre: true, fechaInicio: true } },
        category: { select: { nombre: true } },
      },
      orderBy: { fechaTorneo: 'desc' },
      take: 20,
    });

    return { success: true, data: { rankings, historial } };
  }

  // ═══════════════════════════════════════════════════════════
  // ASCENSOS
  // ═══════════════════════════════════════════════════════════

  async calcularAscensosPendientes() {
    // Obtener todas las reglas activas
    const reglas = await this.prisma.reglaAscenso.findMany({
      where: { activa: true },
      include: {
        categoriaOrigen: true,
        categoriaDestino: true,
      },
    });

    if (reglas.length === 0) {
      return { success: true, message: '0 ascensos detectados', data: [] };
    }

    // CAPA 1 (FairPadel regulador): la detección lee los RESULTADOS REALES de
    // TODOS los torneos finalizados (campeón = ganador de la FINAL; finalista =
    // perdedor de la FINAL), desacoplada por completo de los circuitos. Antes
    // leía historial_puntos, que solo existe para torneos en circuito aprobado,
    // dejando afuera a los campeones de torneos independientes.
    const resultados = await this.obtenerResultadosTorneos();

    const hoy = this.dateService.getDateOnly();
    const candidatos = detectarCandidatosAscenso(
      reglas.map((r) => ({
        id: r.id,
        categoriaOrigenId: r.categoriaOrigenId,
        categoriaDestinoId: r.categoriaDestinoId,
        campeonatosRequeridos: r.campeonatosRequeridos,
        mesesVentana: r.mesesVentana,
        finalistaCalifica: r.finalistaCalifica,
      })),
      resultados,
      hoy,
    );

    // Solo proponer ascenso si el jugador HOY sigue en la categoría origen
    // (evita proponer ascensos obsoletos de una categoría que ya dejó).
    const jugadorIds = [...new Set(candidatos.map((c) => c.jugadorId))];
    const jugadores = await this.prisma.user.findMany({
      where: { id: { in: jugadorIds } },
      select: { id: true, categoriaActualId: true },
    });
    const categoriaActualPorJugador = new Map(
      jugadores.map((j) => [j.id, j.categoriaActualId]),
    );

    const ascensosDetectados = [];

    for (const candidato of candidatos) {
      if (
        categoriaActualPorJugador.get(candidato.jugadorId) !==
        candidato.categoriaOrigenId
      ) {
        continue;
      }

      // Verificar si ya existe un ascenso pendiente/confirmado para este salto
      const existente = await this.prisma.ascensoPendiente.findFirst({
        where: {
          userId: candidato.jugadorId,
          categoriaActualId: candidato.categoriaOrigenId,
          categoriaNuevaId: candidato.categoriaDestinoId,
          estado: { in: ['PENDIENTE', 'CONFIRMADO'] },
        },
      });

      if (!existente) {
        const ascenso = await this.prisma.ascensoPendiente.create({
          data: {
            userId: candidato.jugadorId,
            categoriaActualId: candidato.categoriaOrigenId,
            categoriaNuevaId: candidato.categoriaDestinoId,
            torneosGanadosIds: candidato.torneosGanados,
            // FIX: fechaCalculo es String YYYY-MM-DD
            fechaCalculo: hoy,
            estado: 'PENDIENTE',
          },
          include: {
            user: { select: { nombre: true, apellido: true } },
            categoriaActual: true,
            categoriaNueva: true,
          },
        });
        ascensosDetectados.push(ascenso);
      }
    }

    return {
      success: true,
      message: `${ascensosDetectados.length} ascensos detectados`,
      data: ascensosDetectados,
    };
  }

  /**
   * Junta los resultados reales (campeón / finalista) de TODOS los torneos
   * finalizados, sin importar si pertenecen a un circuito. El campeón es el
   * ganador del partido FINAL; el finalista, el perdedor de la FINAL.
   */
  private async obtenerResultadosTorneos(): Promise<ResultadoTorneo[]> {
    const finales = await this.prisma.match.findMany({
      where: {
        ronda: 'FINAL',
        estado: 'FINALIZADO',
        inscripcionGanadoraId: { not: null },
      },
      select: {
        categoryId: true,
        tournamentId: true,
        inscripcionGanadora: { select: { jugador1Id: true, jugador2Id: true } },
        inscripcionPerdedora: { select: { jugador1Id: true, jugador2Id: true } },
        tournament: { select: { fechaInicio: true } },
      },
    });

    const resultados: ResultadoTorneo[] = [];
    for (const f of finales) {
      const fecha = (f.tournament?.fechaInicio ?? '').slice(0, 10);
      if (!fecha) continue;

      for (const jid of [
        f.inscripcionGanadora?.jugador1Id,
        f.inscripcionGanadora?.jugador2Id,
      ]) {
        if (jid) {
          resultados.push({
            jugadorId: jid,
            categoryId: f.categoryId,
            tournamentId: f.tournamentId,
            fecha,
            posicion: 'CAMPEON',
          });
        }
      }

      for (const jid of [
        f.inscripcionPerdedora?.jugador1Id,
        f.inscripcionPerdedora?.jugador2Id,
      ]) {
        if (jid) {
          resultados.push({
            jugadorId: jid,
            categoryId: f.categoryId,
            tournamentId: f.tournamentId,
            fecha,
            posicion: 'FINALISTA',
          });
        }
      }
    }

    return resultados;
  }

  async getAscensosPendientes() {
    const ascensos = await this.prisma.ascensoPendiente.findMany({
      where: { estado: 'PENDIENTE' },
      include: {
        user: { select: { id: true, nombre: true, apellido: true, fotoUrl: true } },
        categoriaActual: true,
        categoriaNueva: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return { success: true, data: ascensos };
  }

  async procesarAscenso(ascensoId: string, estado: 'CONFIRMADO' | 'RECHAZADO', adminId: string, notas?: string) {
    const ascenso = await this.prisma.ascensoPendiente.update({
      where: { id: ascensoId },
      data: {
        estado,
        revisadoPorId: adminId,
        // FIX: fechaRevision es String YYYY-MM-DD
        fechaRevision: new Date().toISOString().split('T')[0],
        notasRevision: notas,
      },
      include: {
        user: true,
        categoriaNueva: true,
      },
    });

    if (estado === 'CONFIRMADO') {
      // Actualizar categoría del jugador
      await this.prisma.user.update({
        where: { id: ascenso.userId },
        data: { categoriaActualId: ascenso.categoriaNuevaId },
      });

      // Crear historial de categoría
      await this.prisma.historialCategoria.create({
        data: {
          userId: ascenso.userId,
          categoriaAnteriorId: ascenso.categoriaActualId,
          categoriaNuevaId: ascenso.categoriaNuevaId,
          tipo: 'ASCENSO_AUTOMATICO',
          motivo: `Ascenso por cumplir ${ascenso.torneosGanadosIds.length} campeonatos`,
          realizadoPor: adminId,
        },
      });
    }

    return { success: true, data: ascenso };
  }
}
