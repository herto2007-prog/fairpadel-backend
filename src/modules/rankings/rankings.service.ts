import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DateService } from '../../common/services/date.service';
import { QueryRankingsDto } from './dto/query-rankings.dto';
import { CreateConfigPuntosDto, UpdateConfigPuntosDto } from './dto/create-config-puntos.dto';
import { CreateReglaAscensoDto, UpdateReglaAscensoDto } from './dto/create-regla-ascenso.dto';

@Injectable()
export class RankingsService {
  constructor(
    private prisma: PrismaService,
    private dateService: DateService,
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
      select: { multiplicadorPuntos: true, nombre: true },
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
        const puntosFinales = Math.round(config.puntosBase * torneo.multiplicadorPuntos);
        
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
              multiplicadorAplicado: torneo.multiplicadorPuntos,
              // FIX: fechaTorneo es String YYYY-MM-DD
              fechaTorneo: new Date().toISOString().split('T')[0],
            },
          });
          puntosCalculados.push(historial);
        }
      }
    }

    // Actualizar rankings
    await this.actualizarRankings(categoryId);

    return {
      success: true,
      message: 'Puntos calculados y guardados',
      data: {
        torneo: torneo.nombre,
        multiplicador: torneo.multiplicadorPuntos,
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

  private async actualizarRankings(categoryId: string) {
    // Obtener todos los jugadores con historial en esta categoría
    const historiales = await this.prisma.historialPuntos.groupBy({
      by: ['jugadorId'],
      where: { categoryId },
      _sum: { puntosGanados: true },
      _count: { id: true },
    });

    // Ordenar por puntos descendente
    const ordenados = historiales.sort((a, b) => (b._sum.puntosGanados || 0) - (a._sum.puntosGanados || 0));

    // Asignar posiciones con ranking empatado (1224)
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
            tipoRanking: 'CATEGORIA',
            alcance: categoryId,
            temporada: new Date().getFullYear().toString(),
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
          tipoRanking: 'CATEGORIA',
          alcance: categoryId,
          genero: 'MASCULINO', // Se actualizará con el género real
          puntosTotales,
          posicion,
          torneosJugados,
          temporada: new Date().getFullYear().toString(),
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

    const ascensosDetectados = [];

    for (const regla of reglas) {
      // Buscar jugadores que cumplen la regla
      const jugadoresCandidatos = await this.buscarCandidatosAscenso(regla);
      
      for (const candidato of jugadoresCandidatos) {
        // Verificar si ya existe un ascenso pendiente
        const existente = await this.prisma.ascensoPendiente.findFirst({
          where: {
            userId: candidato.jugadorId,
            categoriaActualId: regla.categoriaOrigenId,
            categoriaNuevaId: regla.categoriaDestinoId,
            estado: { in: ['PENDIENTE', 'CONFIRMADO'] },
          },
        });

        if (!existente) {
          const ascenso = await this.prisma.ascensoPendiente.create({
            data: {
              userId: candidato.jugadorId,
              categoriaActualId: regla.categoriaOrigenId,
              categoriaNuevaId: regla.categoriaDestinoId,
              torneosGanadosIds: candidato.torneosGanados,
              // FIX: fechaCalculo es String YYYY-MM-DD
              fechaCalculo: new Date().toISOString().split('T')[0],
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
    }

    return {
      success: true,
      message: `${ascensosDetectados.length} ascensos detectados`,
      data: ascensosDetectados,
    };
  }

  private async buscarCandidatosAscenso(regla: any) {
    // FIX: fechaTorneo es String YYYY-MM-DD
    const fechaDesdeDate = new Date();
    fechaDesdeDate.setMonth(fechaDesdeDate.getMonth() - regla.mesesVentana);
    const fechaDesde = fechaDesdeDate.toISOString().split('T')[0];

    // Buscar jugadores que ganaron campeonatos en la categoría origen
    const campeones = await this.prisma.historialPuntos.groupBy({
      by: ['jugadorId'],
      where: {
        categoryId: regla.categoriaOrigenId,
        posicionFinal: '1ro',
        fechaTorneo: { gte: fechaDesde },
      },
      _count: { id: true },
    });

    const candidatos = [];

    for (const campeon of campeones) {
      if (campeon._count.id >= regla.campeonatosRequeridos) {
        // Obtener IDs de torneos ganados
        const torneos = await this.prisma.historialPuntos.findMany({
          where: {
            jugadorId: campeon.jugadorId,
            categoryId: regla.categoriaOrigenId,
            posicionFinal: '1ro',
            fechaTorneo: { gte: fechaDesde },
          },
          select: { tournamentId: true },
          take: regla.campeonatosRequeridos,
        });

        candidatos.push({
          jugadorId: campeon.jugadorId,
          torneosGanados: torneos.map(t => t.tournamentId),
        });
      }
    }

    return candidatos;
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
