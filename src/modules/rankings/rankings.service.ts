import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
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
import {
  calcularPuestosDelCuadro,
  encontrarConfigParaPosicion,
  PartidoCuadro,
} from './puntos-cuadro';

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

  async calcularPuntosTorneo(
    tournamentId: string,
    categoryId: string,
    opts: { notificar?: boolean } = {},
  ) {
    const notificar = opts.notificar ?? true;

    // Obtener torneo
    const torneo = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { nombre: true, fechaInicio: true },
    });

    if (!torneo) {
      throw new NotFoundException('Torneo no encontrado');
    }

    // IDEMPOTENTE: borrar puntos previos de este torneo/categoría y recalcular
    // desde cero (antes tiraba error si existían → no se podía recalcular).
    await this.prisma.historialPuntos.deleteMany({ where: { tournamentId, categoryId } });

    // Buscar TODOS los circuitos/rankings aprobados del torneo (un torneo puede
    // sumar en varios rankings del organizador — antes findFirst solo veía uno).
    const torneosCircuitos = await this.prisma.torneoCircuito.findMany({
      where: { torneoId: tournamentId, estado: 'APROBADO' },
      include: { circuito: true },
    });

    // UN SOLO peso por torneo (el historial es único por torneo/categoría):
    // se toma el multiplicador del primer vínculo; autoservicio siempre usa 1.
    const multiplicadorFinal = torneosCircuitos[0]?.multiplicador ?? 1;

    // Obtener partidos finalizados de esta categoría
    const partidos = await this.prisma.match.findMany({
      where: {
        tournamentId,
        categoryId,
        estado: 'FINALIZADO',
        inscripcionGanadoraId: { not: null },
      },
      include: {
        inscripcionGanadora: { select: { jugador1Id: true, jugador2Id: true } },
        inscripcionPerdedora: { select: { jugador1Id: true, jugador2Id: true } },
      },
    });

    // Determinar puestos del cuadro (pieza pura, exhaustiva)
    const partidosCuadro: PartidoCuadro[] = partidos.map((p) => ({
      ronda: p.ronda,
      ganadora: p.inscripcionGanadora
        ? { jugador1Id: p.inscripcionGanadora.jugador1Id, jugador2Id: p.inscripcionGanadora.jugador2Id }
        : null,
      perdedora: p.inscripcionPerdedora
        ? { jugador1Id: p.inscripcionPerdedora.jugador1Id, jugador2Id: p.inscripcionPerdedora.jugador2Id }
        : null,
    }));
    const resultados = calcularPuestosDelCuadro(partidosCuadro);

    // Aplicar puntos según configuración
    const configs = await this.prisma.configuracionPuntos.findMany({
      where: { activo: true },
    });

    const fechaTorneo = (torneo.fechaInicio ?? '').slice(0, 10);
    const puntosCalculados = [];

    for (const resultado of resultados) {
      const config = encontrarConfigParaPosicion(configs, resultado.posicion);
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
              fechaTorneo,
            },
          });
          puntosCalculados.push(historial);

          // Aviso (in-app + push): solo en el cálculo inicial, NO al recalcular
          // (recalcular no debe re-spamear "sumaste puntos").
          if (notificar && puntosFinales > 0) {
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

    // Actualizar rankings: SOLO la tabla de cada circuito donde suma el torneo.
    // Las tablas cross-plataforma (GLOBAL/CATEGORIA) se APAGARON (decisión
    // Héctor 2026-07-02): mezclaban puntos de rankings independientes que no
    // son comparables; el nivel general lo gobierna la Federación (categorías).
    // Un circuito FINALIZADO tiene la tabla CONGELADA: "cerrar temporada"
    // significa que el podio anunciado no cambia aunque un torneo vinculado
    // termine después. Solo se actualizan los circuitos ACTIVOS.
    const temporada = (torneo.fechaInicio ?? '').substring(0, 4);
    for (const tc of torneosCircuitos) {
      if (tc.circuito?.estado !== 'ACTIVO') continue;
      await this.actualizarRankingsCircuito(tc.circuitoId, categoryId, temporada);
    }

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

  // actualizarRankingsCategoria / actualizarRankingsGlobal ELIMINADOS
  // (2026-07-02): las tablas cross-plataforma mezclaban puntos de rankings
  // independientes (no comparables). El nivel general lo gobierna la
  // Federación (categorías); los puntos viven por circuito (LIGA).

  async actualizarRankingsCircuito(circuitoId: string, categoryId: string, temporada: string): Promise<void> {
    const torneosCircuito = await this.prisma.torneoCircuito.findMany({
      where: { circuitoId, estado: 'APROBADO', puntosValidos: true },
      select: { torneoId: true, multiplicador: true },
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

    // Mismo criterio que el cálculo inicial: UN solo peso por torneo (tc.multiplicador).
    const puntosPorJugador = new Map<string, { puntos: number; torneos: number }>();
    for (const h of historiales) {
      const tc = torneosCircuito.find(t => t.torneoId === h.tournamentId);
      if (!tc) continue;
      const puntosCircuito = Math.round(h.puntosBase * (tc.multiplicador || 1));
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

  /**
   * Recalcula TODO el ranking de un circuito desde cero: recomputa los puntos de
   * cada torneo aprobado (idempotente, sin re-notificar) y reconstruye su tabla
   * por categoría. Llamar tras agregar/sacar torneos o cambiar la configuración.
   */
  async recalcularCircuito(circuitoId: string) {
    // Tabla congelada al cerrar temporada: para recalcular hay que reactivar.
    const circuito = await this.prisma.circuito.findUnique({
      where: { id: circuitoId },
      select: { estado: true },
    });
    if (circuito && circuito.estado !== 'ACTIVO') {
      throw new BadRequestException(
        'La temporada de este ranking está cerrada (tabla congelada). Reactivalo para recalcular.',
      );
    }

    const tcs = await this.prisma.torneoCircuito.findMany({
      where: { circuitoId, estado: 'APROBADO', puntosValidos: true },
      select: { torneo: { select: { id: true, fechaInicio: true } } },
    });

    const categoriasTemporada = new Map<string, string>(); // categoryId -> temporada
    let categorias = 0;
    for (const { torneo } of tcs) {
      const cats = await this.prisma.tournamentCategory.findMany({
        where: { tournamentId: torneo.id, estado: 'FINALIZADA' },
        select: { categoryId: true },
      });
      const temporada = (torneo.fechaInicio ?? '').substring(0, 4);
      for (const c of cats) {
        await this.calcularPuntosTorneo(torneo.id, c.categoryId, { notificar: false });
        categoriasTemporada.set(c.categoryId, temporada);
        categorias++;
      }
    }

    // Reconstruir explícitamente la tabla de ESTE circuito por categoría
    // (robusto incluso si un torneo perteneciera a más de un circuito).
    for (const [categoryId, temporada] of categoriasTemporada) {
      await this.actualizarRankingsCircuito(circuitoId, categoryId, temporada);
    }

    return {
      success: true,
      message: 'Ranking del circuito recalculado',
      data: { circuitoId, torneosRecalculados: tcs.length, categoriasRecalculadas: categorias },
    };
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
