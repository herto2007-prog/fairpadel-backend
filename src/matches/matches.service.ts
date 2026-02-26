import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RankingsService } from '../rankings/rankings.service';
import { CategoriasService } from '../categorias/categorias.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { FeedService } from '../feed/feed.service';
import { LogrosService } from '../logros/logros.service';
import { CargarResultadoDto } from './dto/cargar-resultado.dto';
import { FixtureService } from './fixture.service';
import {
  calcularHoraFin,
  generarTimeSlots,
  slotKey,
  slotIsAfterOrEqual,
  parseHoraToMinutes,
  minutesToHora,
  dateKey,
  extractUniqueDays,
} from './scheduling-utils';

@Injectable()
export class MatchesService {
  private readonly logger = new Logger(MatchesService.name);

  constructor(
    private prisma: PrismaService,
    private rankingsService: RankingsService,
    private categoriasService: CategoriasService,
    private notificacionesService: NotificacionesService,
    private feedService: FeedService,
    private logrosService: LogrosService,
    private fixtureService: FixtureService,
  ) {}

  async findOne(id: string) {
    const match = await this.prisma.match.findUnique({
      where: { id },
      include: {
        tournament: true,
        category: true,
        pareja1: {
          include: {
            jugador1: true,
            jugador2: true,
          },
        },
        pareja2: {
          include: {
            jugador1: true,
            jugador2: true,
          },
        },
        parejaGanadora: {
          include: {
            jugador1: true,
            jugador2: true,
          },
        },
        torneoCancha: {
          include: {
            sedeCancha: {
              include: {
                sede: true,
              },
            },
          },
        },
      },
    });

    if (!match) {
      throw new NotFoundException('Partido no encontrado');
    }

    return match;
  }

  async cargarResultado(id: string, dto: CargarResultadoDto) {
    const match = await this.findOne(id);

    if (match.estado === 'FINALIZADO') {
      throw new BadRequestException('Este partido ya tiene resultado cargado');
    }

    const {
      set1Pareja1,
      set1Pareja2,
      set2Pareja1,
      set2Pareja2,
      set3Pareja1,
      set3Pareja2,
      esWalkOver,
      esRetiro,
      esDescalificacion,
      parejaGanadoraId,
      observaciones,
    } = dto;

    let ganadorId: string;
    let perdedorId: string;

    if (esWalkOver) {
      // Walk Over — sin puntaje, solo ganador
      ganadorId = parejaGanadoraId;
      perdedorId = ganadorId === match.pareja1Id ? match.pareja2Id : match.pareja1Id;

      await this.prisma.match.update({
        where: { id },
        data: {
          estado: 'WO',
          parejaGanadoraId: ganadorId,
          parejaPerdedoraId: perdedorId,
          observaciones: observaciones || 'Walk Over',
        },
      });
    } else if (esRetiro) {
      // Retiro por lesión — se requiere parejaGanadoraId, sets parciales opcionales
      if (!parejaGanadoraId) {
        throw new BadRequestException('Debe indicar la pareja ganadora en caso de retiro');
      }
      ganadorId = parejaGanadoraId;
      perdedorId = ganadorId === match.pareja1Id ? match.pareja2Id : match.pareja1Id;

      await this.prisma.match.update({
        where: { id },
        data: {
          set1Pareja1: set1Pareja1 ?? null,
          set1Pareja2: set1Pareja2 ?? null,
          set2Pareja1: set2Pareja1 ?? null,
          set2Pareja2: set2Pareja2 ?? null,
          set3Pareja1: set3Pareja1 ?? null,
          set3Pareja2: set3Pareja2 ?? null,
          estado: 'FINALIZADO',
          parejaGanadoraId: ganadorId,
          parejaPerdedoraId: perdedorId,
          observaciones: observaciones || 'Retiro',
        },
      });
    } else if (esDescalificacion) {
      // Descalificación en pleno match — motivo obligatorio, scores parciales opcionales
      if (!parejaGanadoraId) {
        throw new BadRequestException('Debe indicar la pareja ganadora (no descalificada)');
      }
      if (!observaciones) {
        throw new BadRequestException('Debe indicar el motivo de la descalificación');
      }
      ganadorId = parejaGanadoraId;
      perdedorId = ganadorId === match.pareja1Id ? match.pareja2Id : match.pareja1Id;

      await this.prisma.match.update({
        where: { id },
        data: {
          set1Pareja1: set1Pareja1 ?? null,
          set1Pareja2: set1Pareja2 ?? null,
          set2Pareja1: set2Pareja1 ?? null,
          set2Pareja2: set2Pareja2 ?? null,
          set3Pareja1: set3Pareja1 ?? null,
          set3Pareja2: set3Pareja2 ?? null,
          estado: 'WO',
          parejaGanadoraId: ganadorId,
          parejaPerdedoraId: perdedorId,
          observaciones: `Descalificación: ${observaciones}`,
        },
      });
    } else {
      // Resultado normal — validar marcador según ronda
      const esSemiFinal = ['SEMIFINAL', 'FINAL'].includes(match.ronda);
      this.validarMarcador(
        set1Pareja1,
        set1Pareja2,
        set2Pareja1,
        set2Pareja2,
        set3Pareja1,
        set3Pareja2,
        esSemiFinal,
      );

      let setsGanadosP1 = 0;
      let setsGanadosP2 = 0;

      if (set1Pareja1 > set1Pareja2) setsGanadosP1++;
      else setsGanadosP2++;

      if (set2Pareja1 > set2Pareja2) setsGanadosP1++;
      else setsGanadosP2++;

      if (set3Pareja1 !== null && set3Pareja1 !== undefined &&
          set3Pareja2 !== null && set3Pareja2 !== undefined) {
        if (set3Pareja1 > set3Pareja2) setsGanadosP1++;
        else setsGanadosP2++;
      }

      ganadorId = setsGanadosP1 > setsGanadosP2 ? match.pareja1Id : match.pareja2Id;
      perdedorId = ganadorId === match.pareja1Id ? match.pareja2Id : match.pareja1Id;

      await this.prisma.match.update({
        where: { id },
        data: {
          set1Pareja1,
          set1Pareja2,
          set2Pareja1,
          set2Pareja2,
          set3Pareja1,
          set3Pareja2,
          estado: 'FINALIZADO',
          parejaGanadoraId: ganadorId,
          parejaPerdedoraId: perdedorId,
          observaciones,
        },
      });
    }

    // ── PASO 1: Propagar AMBOS (winner + loser) ANTES de BYE checks ──
    // Orden crítico: si winner y loser van al MISMO bracket match (Caso B),
    // el BYE check debe ejecutarse DESPUÉS de que ambos estén colocados.

    // 1a. Avanzar ganador al siguiente partido (usa posicionEnSiguiente)
    if (match.partidoSiguienteId) {
      await this.avanzarGanador(match.partidoSiguienteId, ganadorId, match.id);
    }

    // 1b. Avanzar perdedor al partido de R2/bracket (usa posicionEnPerdedor)
    if (match.partidoPerdedorSiguienteId && match.posicionEnPerdedor) {
      const campoP = match.posicionEnPerdedor === 1 ? 'pareja1Id' : 'pareja2Id';
      await this.prisma.match.update({
        where: { id: match.partidoPerdedorSiguienteId },
        data: { [campoP]: perdedorId },
      });
    }

    // ── PASO 2: Auto-schedule y BYE checks (DESPUÉS de ambas propagaciones) ──

    // 2a. Auto-schedule + BYE check del winner's next match
    if (match.partidoSiguienteId) {
      try {
        await this.autoScheduleNextMatch(match.partidoSiguienteId, match.tournamentId);
      } catch (e) {
        this.logger.error(`[AutoSchedule] Error scheduling winner's next match: ${e.message}`);
      }
      try {
        await this.checkAndAutoAdvanceBracketBye(match.partidoSiguienteId, match.tournamentId);
      } catch (e) {
        this.logger.error(`[BracketBYE] Error checking bracket BYE: ${e.message}`);
      }
    }

    // 2b. Auto-schedule + BYE check del loser's next match
    if (match.partidoPerdedorSiguienteId && match.posicionEnPerdedor) {
      const campoP = match.posicionEnPerdedor === 1 ? 'pareja1Id' : 'pareja2Id';
      const loserMatch = await this.prisma.match.findUnique({
        where: { id: match.partidoPerdedorSiguienteId },
      });
      if (loserMatch && loserMatch.pareja1Id && loserMatch.pareja2Id) {
        // Ambos slots llenos → auto-schedule
        try {
          await this.autoScheduleNextMatch(loserMatch.id, match.tournamentId);
        } catch (e) {
          this.logger.error(`[AutoSchedule] Error scheduling loser's next match: ${e.message}`);
        }
      } else if (loserMatch) {
        // Verificar si hay otro feeder pendiente para el slot vacío
        const otherPos = match.posicionEnPerdedor === 1 ? 2 : 1;
        const otherSlotField = otherPos === 1 ? 'pareja1Id' : 'pareja2Id';
        if (!loserMatch[otherSlotField]) {
          const pendingFeeders = await this.prisma.match.count({
            where: {
              OR: [
                { partidoPerdedorSiguienteId: loserMatch.id, posicionEnPerdedor: otherPos },
              ],
              estado: { notIn: ['FINALIZADO', 'WO', 'CANCELADO'] },
            },
          });
          if (pendingFeeders === 0 && loserMatch[campoP]) {
            await this.autoAdvanceR2Bye(loserMatch.id, loserMatch[campoP]);
          }
        }
      }
      // BYE check para bracket matches (loser puede ir a bracket en Caso B)
      try {
        await this.checkAndAutoAdvanceBracketBye(match.partidoPerdedorSiguienteId, match.tournamentId);
      } catch (e) {
        this.logger.error(`[BracketBYE] Error checking loser bracket BYE: ${e.message}`);
      }
    }

    // ── Verificar si TODOS los R1 de esta categoría terminaron → armar Zona 2 ──
    if (match.ronda === 'ACOMODACION_1') {
      try {
        const pendingR1 = await this.prisma.match.count({
          where: {
            tournamentId: match.tournamentId,
            categoryId: match.categoryId,
            ronda: 'ACOMODACION_1',
            estado: { notIn: ['FINALIZADO', 'WO', 'CANCELADO'] },
          },
        });
        if (pendingR1 === 0) {
          this.logger.log(`[R1 Complete] Todos los R1 de categoría ${match.categoryId} finalizados → armando Zona 2`);
          await this.fixtureService.armarZona2(match.tournamentId, match.categoryId);
        }
      } catch (e) {
        this.logger.error(`[ArmarZ2] Error armando Zona 2: ${e.message}`);
      }
    }

    // Notificar resultado al ganador (solo resultados reales, no WO automáticos)
    if (!esWalkOver) {
      try {
        await this.notificarResultadoGanador(match, ganadorId);
      } catch (e) {
        this.logger.error(`Error notificando resultado ganador: ${e.message}`);
      }
    }

    // Verificar si el siguiente partido tiene ambas parejas listas → notificar
    if (match.partidoSiguienteId) {
      try {
        await this.verificarYNotificarSiguientePartido(match.partidoSiguienteId, match.tournamentId);
      } catch (e) {
        this.logger.error(`Error notificando siguiente partido: ${e.message}`);
      }
    }

    // Auto-post result to feed for winning pair's players
    try {
      const ganadorPair = await this.prisma.pareja.findUnique({
        where: { id: ganadorId },
        include: {
          jugador1: { select: { id: true, esPremium: true, nombre: true, apellido: true } },
          jugador2: { select: { id: true, esPremium: true, nombre: true, apellido: true } },
        },
      });
      if (ganadorPair) {
        const tournament = await this.prisma.tournament.findUnique({
          where: { id: match.tournamentId },
          select: { nombre: true },
        });
        const rondaLabel = match.ronda || 'Ronda';
        const contenido = `${ganadorPair.jugador1.nombre} ${ganadorPair.jugador1.apellido} y ${ganadorPair.jugador2.nombre} ${ganadorPair.jugador2.apellido} ganaron en ${rondaLabel} - ${tournament?.nombre || ''}`;
        for (const jugador of [ganadorPair.jugador1, ganadorPair.jugador2]) {
          if (jugador.esPremium) {
            await this.feedService.crearPublicacionResultado(
              jugador.id,
              id,
              match.tournamentId,
              match.categoryId,
              contenido,
            );
          }
        }
      }
    } catch (e) {
      this.logger.error(`Error creando publicación feed: ${e.message}`);
    }

    // Actualizar estadísticas de victoria/derrota y racha
    const esFinal = match.ronda === 'FINAL';
    try {
      const [parejaGan, parejaPerd] = await Promise.all([
        this.prisma.pareja.findUnique({
          where: { id: ganadorId },
          select: { jugador1Id: true, jugador2Id: true },
        }),
        this.prisma.pareja.findUnique({
          where: { id: perdedorId },
          select: { jugador1Id: true, jugador2Id: true },
        }),
      ]);

      // Update winners' stats (victory, streak +1, championship if FINAL)
      if (parejaGan) {
        await this.rankingsService.actualizarEstadisticasPartido(parejaGan.jugador1Id, true, esFinal);
        await this.rankingsService.actualizarEstadisticasPartido(parejaGan.jugador2Id, true, esFinal);
      }

      // Update losers' stats (loss, streak reset)
      if (parejaPerd) {
        await this.rankingsService.actualizarEstadisticasPartido(parejaPerd.jugador1Id, false, false);
        await this.rankingsService.actualizarEstadisticasPartido(parejaPerd.jugador2Id, false, false);
      }

      // Verificar logros para todos los jugadores del partido
      const userIds = new Set<string>();
      if (parejaGan) { userIds.add(parejaGan.jugador1Id); userIds.add(parejaGan.jugador2Id); }
      if (parejaPerd) { userIds.add(parejaPerd.jugador1Id); userIds.add(parejaPerd.jugador2Id); }
      for (const uid of userIds) {
        await this.logrosService.verificarLogros(uid);
      }
    } catch (e) {
      this.logger.error(`Error actualizando estadísticas/logros: ${e.message}`);
    }

    // Verificar si la categoría está completa (todos los matches finalizados)
    const categoriaCompleta = await this.verificarCategoriaCompleta(
      match.tournamentId,
      match.categoryId,
    );

    const resultado = await this.findOne(id);
    return { ...resultado, categoriaCompleta };
  }

  /**
   * Editar resultado de un match ya finalizado.
   * Reversa avance del ganador anterior, aplica nuevo resultado, re-avanza.
   */
  async editarResultado(id: string, dto: CargarResultadoDto) {
    const match = await this.findOne(id);

    if (match.estado !== 'FINALIZADO' && match.estado !== 'WO') {
      throw new BadRequestException('Solo se pueden editar partidos ya finalizados');
    }

    // Verificar que la categoría no esté FINALIZADA (ya se asignaron puntos)
    const tc = await this.prisma.tournamentCategory.findFirst({
      where: { tournamentId: match.tournamentId, categoryId: match.categoryId },
    });
    if (tc?.estado === 'FINALIZADA') {
      throw new BadRequestException(
        'No se puede editar: la categoría ya fue finalizada y los puntos asignados.',
      );
    }

    const oldGanadorId = match.parejaGanadoraId;

    // 1. Si ganador anterior avanzó al siguiente partido, reversar
    if (match.partidoSiguienteId && oldGanadorId) {
      const nextMatch = await this.prisma.match.findUnique({
        where: { id: match.partidoSiguienteId },
      });
      if (nextMatch) {
        // Solo reversar si el siguiente partido NO está finalizado
        if (['FINALIZADO', 'WO'].includes(nextMatch.estado)) {
          throw new BadRequestException(
            'No se puede editar: el partido siguiente ya tiene resultado. Edita ese primero.',
          );
        }
        // Limpiar el slot del ganador anterior
        if (nextMatch.pareja1Id === oldGanadorId) {
          await this.prisma.match.update({
            where: { id: nextMatch.id },
            data: { pareja1Id: null },
          });
        } else if (nextMatch.pareja2Id === oldGanadorId) {
          await this.prisma.match.update({
            where: { id: nextMatch.id },
            data: { pareja2Id: null },
          });
        }
      }
    }

    // 2. Resetear el match actual
    await this.prisma.match.update({
      where: { id },
      data: {
        estado: 'PROGRAMADO',
        set1Pareja1: null,
        set1Pareja2: null,
        set2Pareja1: null,
        set2Pareja2: null,
        set3Pareja1: null,
        set3Pareja2: null,
        parejaGanadoraId: null,
        parejaPerdedoraId: null,
        observaciones: null,
      },
    });

    // 3. Cargar el nuevo resultado normalmente
    return this.cargarResultado(id, dto);
  }

  /**
   * Valida marcador según reglas paraguayas de pádel.
   * @param esSemiFinal - true si es SEMIFINAL o FINAL (3 sets completos, sin super tie-break)
   */
  private validarMarcador(
    s1p1: number,
    s1p2: number,
    s2p1: number,
    s2p2: number,
    s3p1?: number,
    s3p2?: number,
    esSemiFinal: boolean = false,
  ) {
    // Validar rango de games para sets 1 y 2 (0-7)
    const gamesSet12 = [s1p1, s1p2, s2p1, s2p2];
    for (const g of gamesSet12) {
      if (g < 0 || g > 7) {
        throw new BadRequestException('Los games deben estar entre 0 y 7');
      }
    }

    const validarSetNormal = (p1: number, p2: number) => {
      if (p1 === 6 && p2 <= 4) return true;
      if (p2 === 6 && p1 <= 4) return true;
      if (p1 === 7 && (p2 === 5 || p2 === 6)) return true;
      if (p2 === 7 && (p1 === 5 || p1 === 6)) return true;
      return false;
    };

    /**
     * Valida super tie-break: al menos uno llega a 10+, diferencia >= 2
     */
    const validarSuperTieBreak = (p1: number, p2: number) => {
      const max = Math.max(p1, p2);
      const diff = Math.abs(p1 - p2);
      if (max < 10) return false;
      if (diff < 2) return false;
      return true;
    };

    if (!validarSetNormal(s1p1, s1p2)) {
      throw new BadRequestException('Marcador inválido en set 1');
    }
    if (!validarSetNormal(s2p1, s2p2)) {
      throw new BadRequestException('Marcador inválido en set 2');
    }

    if (s3p1 !== null && s3p1 !== undefined &&
        s3p2 !== null && s3p2 !== undefined) {
      if (esSemiFinal) {
        // Semi/Final: set 3 es un set normal (0-7)
        if (s3p1 < 0 || s3p1 > 7 || s3p2 < 0 || s3p2 > 7) {
          throw new BadRequestException('Los games del set 3 deben estar entre 0 y 7');
        }
        if (!validarSetNormal(s3p1, s3p2)) {
          throw new BadRequestException('Marcador inválido en set 3');
        }
      } else {
        // Rondas normales: set 3 es super tie-break (a 10, diferencia 2)
        if (s3p1 < 0 || s3p2 < 0) {
          throw new BadRequestException('El marcador del super tie-break no puede ser negativo');
        }
        if (!validarSuperTieBreak(s3p1, s3p2)) {
          throw new BadRequestException(
            'Super tie-break inválido: al menos uno debe llegar a 10 con diferencia de 2',
          );
        }
      }
    }
  }

  // Fix: usa posicionEnSiguiente del match actual en vez de rondaAnterior % 2
  private async avanzarGanador(
    partidoSiguienteId: string,
    ganadorId: string,
    matchId: string,
  ) {
    // Obtener el match actual para leer posicionEnSiguiente
    const currentMatch = await this.prisma.match.findUnique({
      where: { id: matchId },
    });

    if (!currentMatch || !currentMatch.posicionEnSiguiente) {
      return; // No hay info de posición, no se puede avanzar
    }

    const campo = currentMatch.posicionEnSiguiente === 1 ? 'pareja1Id' : 'pareja2Id';

    await this.prisma.match.update({
      where: { id: partidoSiguienteId },
      data: { [campo]: ganadorId },
    });
  }

  /**
   * Auto-avanza un BYE en R2 de acomodación: marca como WO y avanza
   * al bracket principal si hay partidoSiguienteId.
   */
  private async autoAdvanceR2Bye(matchId: string, winnerId: string) {
    const match = await this.prisma.match.update({
      where: { id: matchId },
      data: {
        estado: 'WO',
        parejaGanadoraId: winnerId,
        observaciones: 'BYE - Avance automático (Acomodación)',
      },
    });

    // Avanzar al bracket principal
    if (match.partidoSiguienteId && match.posicionEnSiguiente) {
      const campo = match.posicionEnSiguiente === 1 ? 'pareja1Id' : 'pareja2Id';
      await this.prisma.match.update({
        where: { id: match.partidoSiguienteId },
        data: { [campo]: winnerId },
      });

      // Auto-schedule el siguiente partido si ambas parejas listas
      try {
        await this.autoScheduleNextMatch(match.partidoSiguienteId, match.tournamentId);
      } catch (e) {
        this.logger.error(`[AutoSchedule] Error scheduling post-R2-BYE: ${e.message}`);
      }

      // Verificar si el bracket match destino es ahora un BYE (cascade)
      try {
        await this.checkAndAutoAdvanceBracketBye(match.partidoSiguienteId, match.tournamentId);
      } catch (e) {
        this.logger.error(`[BracketBYE] Error checking bracket BYE post-R2: ${e.message}`);
      }
    }
  }

  // ═══════════════════════════════════════════════════════
  // AUTO-ADVANCE BRACKET BYE — Detección y cascade en bracket
  // ═══════════════════════════════════════════════════════

  /**
   * Verifica si un match del bracket tiene condición de BYE después de recibir
   * una pareja (1 pareja + 1 null sin feeders pendientes).
   * Si es BYE → auto-avanza y verifica recursivamente el siguiente match.
   */
  private async checkAndAutoAdvanceBracketBye(
    matchId: string,
    tournamentId: string,
  ): Promise<void> {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
    });
    if (!match || match.estado !== 'PROGRAMADO') return;

    const hasP1 = match.pareja1Id !== null;
    const hasP2 = match.pareja2Id !== null;

    if (hasP1 && hasP2) return; // Match real, se juega normalmente
    if (!hasP1 && !hasP2) return; // Ambos vacíos, esperando feeders

    // Tiene exactamente 1 pareja — verificar si la otra llega
    const emptyPos = hasP1 ? 2 : 1;
    const winnerId = hasP1 ? match.pareja1Id : match.pareja2Id;

    // Contar feeders activos para la posición vacía
    // (excluir feeders WO sin ganador = phantoms que nunca enviarán pareja)
    const feeders = await this.prisma.match.findMany({
      where: {
        OR: [
          { partidoSiguienteId: matchId, posicionEnSiguiente: emptyPos },
          { partidoPerdedorSiguienteId: matchId, posicionEnPerdedor: emptyPos },
        ],
      },
      select: { estado: true, parejaGanadoraId: true },
    });

    // Feeders pendientes = NO finalizados/WO/cancelados (podrían aún enviar)
    // + WO CON ganador (ya enviaron, pero el slot debería estar lleno)
    const pendingFeeders = feeders.filter(f => {
      if (f.estado === 'WO' && !f.parejaGanadoraId) return false; // phantom → muerto
      if (['FINALIZADO', 'WO', 'CANCELADO'].includes(f.estado)) return false; // ya resuelto
      return true; // PROGRAMADO o EN_JUEGO → aún puede enviar
    });

    if (pendingFeeders.length > 0) return; // Hay feeders pendientes, esperar

    // BYE confirmado → auto-avanzar
    this.logger.log(`[BracketBYE] Match ${matchId} es BYE — avanzando ${winnerId}`);

    await this.prisma.match.update({
      where: { id: matchId },
      data: {
        estado: 'WO',
        parejaGanadoraId: winnerId,
        observaciones: 'BYE - Avance automático (Bracket)',
      },
    });

    // Propagar al siguiente match
    if (match.partidoSiguienteId && match.posicionEnSiguiente) {
      const campo = match.posicionEnSiguiente === 1 ? 'pareja1Id' : 'pareja2Id';
      await this.prisma.match.update({
        where: { id: match.partidoSiguienteId },
        data: { [campo]: winnerId },
      });

      // Auto-schedule si ambas parejas listas
      try {
        await this.autoScheduleNextMatch(match.partidoSiguienteId, tournamentId);
      } catch (e) {
        this.logger.error(`[AutoSchedule] Error scheduling post-bracket-BYE: ${e.message}`);
      }

      // CASCADE: verificar si el siguiente match ahora también es BYE
      await this.checkAndAutoAdvanceBracketBye(match.partidoSiguienteId, tournamentId);
    }
  }

  // ═══════════════════════════════════════════════════════
  // AUTO-SCHEDULE — Asignación dinámica de cancha/horario
  // ═══════════════════════════════════════════════════════

  /**
   * Auto-asigna cancha/horario al partido indicado si tiene ambas parejas
   * y aún no tiene cancha. Respeta 2h30m de descanso mínimo entre partidos
   * para la misma pareja (2h reglamentario + 30min buffer por retrasos).
   * Cross-categoría: revisa slots ocupados de todo el torneo.
   */
  private async autoScheduleNextMatch(matchId: string, tournamentId: string): Promise<void> {
    // 1. Obtener el partido que necesita cancha
    const match = await this.prisma.match.findUnique({ where: { id: matchId } });
    if (!match || !match.pareja1Id || !match.pareja2Id) return;
    if (match.torneoCanchaId) return; // ya tiene cancha asignada

    // 2. Obtener torneoCanchas con horarios
    const torneoCanchas = await this.prisma.torneoCancha.findMany({
      where: { tournamentId },
      include: { horarios: true },
    });
    if (torneoCanchas.length === 0) return;

    // 3. Obtener duración del partido
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { minutosPorPartido: true },
    });
    const minutosPorPartido = tournament?.minutosPorPartido || 60;
    const bufferMinutos = 10;

    // 4. Generar todos los slots disponibles (fecha ASC → hora ASC → cancha)
    const allSlots = generarTimeSlots(torneoCanchas, minutosPorPartido, bufferMinutos);
    if (allSlots.length === 0) return;

    // 5. Obtener slots ocupados (cross-categoría)
    const occupiedMatches = await this.prisma.match.findMany({
      where: {
        tournamentId,
        estado: { notIn: ['WO', 'CANCELADO'] },
        torneoCanchaId: { not: null },
      },
      select: { torneoCanchaId: true, fechaProgramada: true, horaProgramada: true },
    });
    const ocupados = new Set<string>();
    for (const m of occupiedMatches) {
      if (m.torneoCanchaId && m.fechaProgramada && m.horaProgramada) {
        ocupados.add(slotKey(m.torneoCanchaId, m.fechaProgramada, m.horaProgramada));
      }
    }

    // 6. Descanso: al menos 2 partidos del torneo entre partidos de la misma pareja.
    //    Buscamos el último partido finalizado de cada pareja y luego
    //    verificamos que al menos 2 otros partidos del torneo se hayan jugado después.
    //    Implementado como: el slot mínimo es el horaFin del 2do partido posterior
    //    al último match de la pareja, o 60min después si no hay 2 partidos intermedios aún.
    const DESCANSO_FALLBACK_MINUTOS = 60; // fallback mínimo si no hay 2 partidos intermedios
    const DESCANSO_PARTIDOS = 2; // partidos intermedios requeridos
    const parejaIds = [match.pareja1Id, match.pareja2Id];

    // Buscar el partido MÁS TARDÍO finalizado de cualquiera de las 2 parejas
    const lastParejaMatches = await this.prisma.match.findMany({
      where: {
        tournamentId,
        OR: [
          { pareja1Id: { in: parejaIds } },
          { pareja2Id: { in: parejaIds } },
        ],
        estado: { in: ['FINALIZADO', 'WO'] },
        horaFinEstimada: { not: null },
        fechaProgramada: { not: null },
      },
      select: { id: true, fechaProgramada: true, horaFinEstimada: true },
      orderBy: [{ fechaProgramada: 'desc' }, { horaFinEstimada: 'desc' }],
      take: 1,
    });

    let minFecha: Date | null = null;
    let minHora: string | null = null;
    if (lastParejaMatches.length > 0) {
      const lastParejaMatch = lastParejaMatches[0];

      // Contar partidos del torneo finalizados DESPUÉS de este match
      const matchesAfter = await this.prisma.match.findMany({
        where: {
          tournamentId,
          id: { not: lastParejaMatch.id },
          estado: { in: ['FINALIZADO', 'WO'] },
          horaFinEstimada: { not: null },
          fechaProgramada: { not: null },
        },
        select: { fechaProgramada: true, horaFinEstimada: true },
        orderBy: [{ fechaProgramada: 'asc' }, { horaFinEstimada: 'asc' }],
      });

      // Filtrar solo los que terminaron DESPUÉS del último partido de la pareja
      const afterParejaEnd = matchesAfter.filter(m => {
        const mMs = m.fechaProgramada!.getTime();
        const pMs = lastParejaMatch.fechaProgramada!.getTime();
        if (mMs > pMs) return true;
        if (mMs === pMs) return parseHoraToMinutes(m.horaFinEstimada!) > parseHoraToMinutes(lastParejaMatch.horaFinEstimada!);
        return false;
      });

      if (afterParejaEnd.length >= DESCANSO_PARTIDOS) {
        // Ya hay suficientes partidos intermedios — minFecha = fin del Nth partido intermedio
        const nthMatch = afterParejaEnd[DESCANSO_PARTIDOS - 1];
        minFecha = nthMatch.fechaProgramada;
        minHora = nthMatch.horaFinEstimada;
      } else {
        // No hay suficientes partidos intermedios — usar fallback temporal
        minFecha = lastParejaMatch.fechaProgramada;
        const finMinutos = parseHoraToMinutes(lastParejaMatch.horaFinEstimada!) + DESCANSO_FALLBACK_MINUTOS;
        minHora = minutesToHora(finMinutos % (24 * 60));
        if (finMinutos >= 24 * 60) {
          minFecha = new Date(minFecha!.getTime() + 86400000);
        }
      }
    }

    // 7. Semis y finales: SOLO último día disponible
    const isSemiOrFinal = ['SEMIFINAL', 'FINAL'].includes(match.ronda);
    let slotsToSearch = allSlots;
    if (isSemiOrFinal) {
      const uniqueDays = extractUniqueDays(allSlots);
      if (uniqueDays.length > 0) {
        const lastDay = dateKey(uniqueDays[uniqueDays.length - 1]);
        slotsToSearch = allSlots.filter(s => dateKey(s.fecha) === lastDay);
      }
    }

    // 8. Buscar primer slot libre que respete descanso
    for (const slot of slotsToSearch) {
      const key = slotKey(slot.torneoCanchaId, slot.fecha, slot.horaInicio);
      if (ocupados.has(key)) continue;
      if (!slotIsAfterOrEqual(slot.fecha, slot.horaInicio, minFecha, minHora)) continue;

      // 8. Asignar cancha/horario
      const horaFin = calcularHoraFin(slot.horaInicio, minutosPorPartido);
      await this.prisma.match.update({
        where: { id: matchId },
        data: {
          torneoCanchaId: slot.torneoCanchaId,
          fechaProgramada: slot.fecha,
          horaProgramada: slot.horaInicio,
          horaFinEstimada: horaFin,
        },
      });

      this.logger.log(
        `[AutoSchedule] Match ${matchId} (${match.ronda}) → ${slot.horaInicio} ${dateKey(slot.fecha)}`,
      );
      return;
    }

    // Sin slot disponible — queda sin cancha (el organizador lo verá)
    this.logger.warn(`[AutoSchedule] No slot found for match ${matchId} (${match.ronda})`);
  }

  // ═══════════════════════════════════════════════════════
  // REAGENDAR PARTIDOS SIN CANCHA
  // ═══════════════════════════════════════════════════════

  /**
   * Re-asigna canchas/horarios a partidos que quedaron sin slot.
   * El organizador lo llama después de agregar nuevos horarios.
   */
  async reagendarSinCancha(tournamentId: string, categoryId: string): Promise<{ asignados: number; sinSlot: number }> {
    const matchesSinCancha = await this.prisma.match.findMany({
      where: {
        tournamentId,
        categoryId,
        torneoCanchaId: null,
        estado: { notIn: ['WO', 'CANCELADO'] },
      },
      orderBy: { numeroRonda: 'asc' },
    });

    if (matchesSinCancha.length === 0) {
      return { asignados: 0, sinSlot: 0 };
    }

    const torneoCanchas = await this.prisma.torneoCancha.findMany({
      where: { tournamentId },
      include: { horarios: true },
    });

    if (torneoCanchas.length === 0) {
      return { asignados: 0, sinSlot: matchesSinCancha.length };
    }

    return this.fixtureService.asignarCanchasYHorarios(
      this.prisma,
      matchesSinCancha,
      torneoCanchas,
      tournamentId,
      60,
      10,
    );
  }

  // ═══════════════════════════════════════════════════════
  // VALIDACIÓN ANTI-CONFLICTO DE SLOTS
  // ═══════════════════════════════════════════════════════

  /**
   * Valida que un slot (cancha+fecha+hora) esté disponible.
   * Opcionalmente excluye un match (para reprogramar el mismo match).
   */
  private async validarSlotDisponible(
    tournamentId: string,
    canchaId: string,
    fecha: Date | string,
    hora: string,
    excludeMatchId?: string,
  ): Promise<void> {
    const fechaDate = typeof fecha === 'string' ? new Date(fecha) : fecha;

    const conflict = await this.prisma.match.findFirst({
      where: {
        tournamentId,
        torneoCanchaId: canchaId,
        fechaProgramada: fechaDate,
        horaProgramada: hora,
        estado: { notIn: ['WO', 'CANCELADO'] },
        ...(excludeMatchId ? { id: { not: excludeMatchId } } : {}),
      },
    });

    if (conflict) {
      throw new BadRequestException(
        `Ya existe un partido programado en esta cancha a las ${hora} en esa fecha. Elige otro horario o cancha.`,
      );
    }
  }

  // ═══════════════════════════════════════════════════════
  // INTERCAMBIAR HORARIOS/CANCHAS (Swap — Premium only)
  // ═══════════════════════════════════════════════════════

  async swapMatchSchedules(match1Id: string, match2Id: string, userId: string) {
    // Validar que el usuario es premium
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.esPremium) {
      throw new ForbiddenException(
        'Esta función requiere una suscripción Premium',
      );
    }

    // Obtener ambos partidos
    const [match1, match2] = await Promise.all([
      this.prisma.match.findUnique({ where: { id: match1Id } }),
      this.prisma.match.findUnique({ where: { id: match2Id } }),
    ]);

    if (!match1 || !match2) {
      throw new NotFoundException('Uno o ambos partidos no encontrados');
    }

    // Validar mismo torneo
    if (match1.tournamentId !== match2.tournamentId) {
      throw new BadRequestException('Los partidos deben ser del mismo torneo');
    }

    // Validar ninguno finalizado o WO
    if (['FINALIZADO', 'WO'].includes(match1.estado) || ['FINALIZADO', 'WO'].includes(match2.estado)) {
      throw new BadRequestException(
        'No se puede intercambiar horarios de partidos finalizados o WO',
      );
    }

    // Validar que ambos tienen horario asignado
    if (!match1.horaProgramada || !match2.horaProgramada) {
      throw new BadRequestException(
        'Ambos partidos deben tener horario asignado para intercambiar',
      );
    }

    // Swap atómico de horarios y canchas
    await this.prisma.$transaction([
      this.prisma.match.update({
        where: { id: match1Id },
        data: {
          fechaProgramada: match2.fechaProgramada,
          horaProgramada: match2.horaProgramada,
          horaFinEstimada: match2.horaFinEstimada,
          torneoCanchaId: match2.torneoCanchaId,
        },
      }),
      this.prisma.match.update({
        where: { id: match2Id },
        data: {
          fechaProgramada: match1.fechaProgramada,
          horaProgramada: match1.horaProgramada,
          horaFinEstimada: match1.horaFinEstimada,
          torneoCanchaId: match1.torneoCanchaId,
        },
      }),
    ]);

    return { message: 'Horarios intercambiados exitosamente' };
  }

  // ═══════════════════════════════════════════════════════
  // REPROGRAMAR PARTIDO (con validación anti-conflicto)
  // ═══════════════════════════════════════════════════════

  async reprogramar(id: string, data: any, userId?: string) {
    const match = await this.findOne(id);

    // Premium gating: only premium organizers (or admin) can reprogramar
    if (userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { roles: { include: { role: true } } },
      });
      const isAdmin = user.roles.some((ur) => ur.role.nombre === 'admin');
      if (!isAdmin && !user.esPremium) {
        throw new ForbiddenException('Necesitas FairPadel Premium para reprogramar partidos');
      }
    }

    if (match.estado === 'FINALIZADO') {
      throw new BadRequestException('No se puede reprogramar un partido finalizado');
    }

    if (match.estado === 'WO') {
      throw new BadRequestException('No se puede reprogramar un partido WO');
    }

    const canchaId = data.torneoCanchaId || match.torneoCanchaId;
    const fecha = data.fechaProgramada;
    const hora = data.horaProgramada;

    // Validar que el slot no esté ocupado por otro match
    if (canchaId && fecha && hora) {
      await this.validarSlotDisponible(
        match.tournamentId,
        canchaId,
        fecha,
        hora,
        id, // excluir este mismo match
      );
    }

    // Recalcular horaFinEstimada usando minutosPorPartido del torneo
    let horaFinEstimada: string | undefined;
    if (hora) {
      const tournament = await this.prisma.tournament.findUnique({
        where: { id: match.tournamentId },
        select: { minutosPorPartido: true },
      });
      const minutos = tournament?.minutosPorPartido || 60;
      horaFinEstimada = calcularHoraFin(hora, minutos);
    }

    return this.prisma.match.update({
      where: { id },
      data: {
        fechaProgramada: new Date(fecha),
        horaProgramada: hora,
        torneoCanchaId: canchaId,
        ...(horaFinEstimada ? { horaFinEstimada } : {}),
      },
    });
  }

  async obtenerPartidosPendientes(tournamentId: string) {
    return this.prisma.match.findMany({
      where: {
        tournamentId,
        estado: { in: ['PROGRAMADO', 'EN_JUEGO'] },
      },
      include: {
        category: true,
        pareja1: {
          include: {
            jugador1: true,
            jugador2: true,
          },
        },
        pareja2: {
          include: {
            jugador1: true,
            jugador2: true,
          },
        },
        torneoCancha: {
          include: {
            sedeCancha: {
              include: {
                sede: true,
              },
            },
          },
        },
      },
      orderBy: [
        { fechaProgramada: 'asc' },
        { horaProgramada: 'asc' },
      ],
    });
  }

  // ═══════════════════════════════════════════════════════
  // VERIFICACIÓN Y FINALIZACIÓN DE CATEGORÍA
  // ═══════════════════════════════════════════════════════

  /**
   * Verifica si todos los matches con parejas asignadas de una categoría están finalizados.
   */
  private async verificarCategoriaCompleta(
    tournamentId: string,
    categoryId: string,
  ): Promise<boolean> {
    const pendientes = await this.prisma.match.count({
      where: {
        tournamentId,
        categoryId,
        estado: { notIn: ['FINALIZADO', 'WO', 'CANCELADO'] },
        pareja1Id: { not: null },
      },
    });
    return pendientes === 0;
  }

  /**
   * Obtener standings de una categoría (preview sin finalizar).
   * Retorna posiciones con parejas y puntos que recibirían.
   */
  async obtenerStandings(tournamentId: string, categoryId: string) {
    const matches = await this.prisma.match.findMany({
      where: { tournamentId, categoryId },
      include: {
        parejaGanadora: {
          include: { jugador1: true, jugador2: true },
        },
        parejaPerdedora: {
          include: { jugador1: true, jugador2: true },
        },
      },
    });

    return await this.calcularStandings(matches);
  }

  /**
   * Calcula standings a partir de los matches de una categoría.
   * Lee puntos base desde ConfiguracionPuntos (DB) con fallbacks hardcodeados.
   */
  private async calcularStandings(matches: any[]) {
    // Leer tabla de puntos desde la DB
    const configs = await this.prisma.configuracionPuntos.findMany();
    const configMap = new Map(configs.map((c) => [c.posicion, c.puntosBase]));

    const puntosPorRonda: Record<string, { posicion: string; puntos: number }> = {
      CAMPEON: { posicion: 'Campeon', puntos: configMap.get('CAMPEON') ?? 100 },
      FINALISTA: { posicion: 'Finalista', puntos: configMap.get('FINALISTA') ?? 60 },
      SEMIFINALISTA: { posicion: 'Semifinalista', puntos: configMap.get('SEMIFINALISTA') ?? 35 },
      CUARTOS: { posicion: 'Cuartos de Final', puntos: configMap.get('CUARTOS') ?? 15 },
      OCTAVOS: { posicion: 'Octavos de Final', puntos: configMap.get('OCTAVOS') ?? 8 },
      PRIMERA_RONDA: { posicion: 'Primera Ronda', puntos: configMap.get('PRIMERA_RONDA') ?? 3 },
    };

    const standings: Array<{
      pareja: any;
      posicion: string;
      puntos: number;
      orden: number;
    }> = [];

    // Buscar match de FINAL
    const finalMatch = matches.find((m) => m.ronda === 'FINAL');
    if (finalMatch?.parejaGanadora) {
      standings.push({
        pareja: finalMatch.parejaGanadora,
        posicion: puntosPorRonda.CAMPEON.posicion,
        puntos: puntosPorRonda.CAMPEON.puntos,
        orden: 1,
      });
    }
    if (finalMatch?.parejaPerdedora) {
      standings.push({
        pareja: finalMatch.parejaPerdedora,
        posicion: puntosPorRonda.FINALISTA.posicion,
        puntos: puntosPorRonda.FINALISTA.puntos,
        orden: 2,
      });
    }

    // Buscar perdedores de SEMIFINAL
    const semiMatches = matches.filter((m) => m.ronda === 'SEMIFINAL');
    for (const semi of semiMatches) {
      if (semi.parejaPerdedora) {
        standings.push({
          pareja: semi.parejaPerdedora,
          posicion: puntosPorRonda.SEMIFINALISTA.posicion,
          puntos: puntosPorRonda.SEMIFINALISTA.puntos,
          orden: 3,
        });
      }
    }

    // Buscar perdedores de CUARTOS
    const cuartosMatches = matches.filter((m) => m.ronda === 'CUARTOS');
    for (const cuarto of cuartosMatches) {
      if (cuarto.parejaPerdedora) {
        standings.push({
          pareja: cuarto.parejaPerdedora,
          posicion: puntosPorRonda.CUARTOS.posicion,
          puntos: puntosPorRonda.CUARTOS.puntos,
          orden: 4,
        });
      }
    }

    // Buscar perdedores de OCTAVOS
    const octavosMatches = matches.filter((m) => m.ronda === 'OCTAVOS' || m.ronda === 'DIECISEISAVOS');
    for (const oct of octavosMatches) {
      if (oct.parejaPerdedora) {
        standings.push({
          pareja: oct.parejaPerdedora,
          posicion: puntosPorRonda.OCTAVOS.posicion,
          puntos: puntosPorRonda.OCTAVOS.puntos,
          orden: 5,
        });
      }
    }

    // Perdedores en rondas de acomodación (eliminados en R2)
    const acomodacion2Matches = matches.filter((m) => m.ronda === 'ACOMODACION_2');
    for (const a2 of acomodacion2Matches) {
      if (a2.parejaPerdedora) {
        // Verificar que no esté ya en standings (puede ser WO/BYE)
        const yaIncluida = standings.some(
          (s) => s.pareja?.id === a2.parejaPerdedora?.id,
        );
        if (!yaIncluida) {
          standings.push({
            pareja: a2.parejaPerdedora,
            posicion: puntosPorRonda.PRIMERA_RONDA.posicion,
            puntos: puntosPorRonda.PRIMERA_RONDA.puntos,
            orden: 6,
          });
        }
      }
    }

    // Ordenar por puntos (desc) y luego por orden
    standings.sort((a, b) => b.puntos - a.puntos || a.orden - b.orden);

    return { standings, puntosPorRonda };
  }

  /**
   * Finalizar una categoría: asignar puntos, actualizar rankings, cambiar estado.
   */
  async finalizarCategoria(tournamentId: string, categoryId: string) {
    // 1. Verificar que todos los matches estén completos
    const completa = await this.verificarCategoriaCompleta(tournamentId, categoryId);
    if (!completa) {
      throw new BadRequestException(
        'No se puede finalizar: hay partidos pendientes en esta categoría',
      );
    }

    // 2. Verificar estado actual de la categoría
    const tc = await this.prisma.tournamentCategory.findFirst({
      where: { tournamentId, categoryId },
    });
    if (!tc) {
      throw new NotFoundException('Categoría no encontrada en este torneo');
    }
    if (tc.estado === 'FINALIZADA') {
      throw new BadRequestException('Esta categoría ya fue finalizada');
    }

    // 3. Obtener standings
    const { standings } = await this.obtenerStandings(tournamentId, categoryId);

    // 4. Obtener multiplicador del circuito (si el torneo pertenece a uno)
    const torneo = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { circuitoId: true, circuito: { select: { multiplicador: true } } },
    });
    const multiplicador = torneo?.circuito?.multiplicador ?? 1.0;

    // 5. Registrar puntos en rankings para cada jugador
    for (const entry of standings) {
      if (!entry.pareja) continue;
      const puntosConMultiplicador = Math.round(entry.puntos * multiplicador);
      const jugadores = [entry.pareja.jugador1, entry.pareja.jugador2].filter(Boolean);
      for (const jugador of jugadores) {
        // Registrar en historial de puntos (con multiplicador aplicado)
        await this.prisma.historialPuntos.create({
          data: {
            jugadorId: jugador.id,
            tournamentId,
            categoryId,
            posicionFinal: entry.posicion,
            puntosGanados: puntosConMultiplicador,
            fechaTorneo: new Date(),
          },
        });

        // Actualizar ranking global
        await this.rankingsService.actualizarRankingJugador(jugador.id, puntosConMultiplicador);
      }
    }

    // 5. Recalcular posiciones globales
    await this.rankingsService.recalcularPosiciones();

    // 5.5. Verificar y ejecutar promociones de categoría
    let promociones = [];
    try {
      promociones = await this.categoriasService.verificarYEjecutarPromociones(
        standings,
        categoryId,
        tournamentId,
      );
    } catch (e) {
      console.error('Error al verificar promociones:', e);
      // No bloquear finalización si falla la lógica de promociones
    }

    // 6. Transicionar estado de la categoría → FINALIZADA
    await this.prisma.tournamentCategory.update({
      where: { id: tc.id },
      data: { estado: 'FINALIZADA' },
    });

    return {
      message: 'Categoría finalizada exitosamente',
      standings,
      promociones,
    };
  }

  // ═══════════════════════════════════════════════════════
  // NOTIFICATION HELPERS
  // ═══════════════════════════════════════════════════════

  /**
   * Notifica a la pareja ganadora que avanzaron.
   */
  private async notificarResultadoGanador(match: any, ganadorId: string) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: match.tournamentId },
    });
    if (!tournament) return;

    const parejaGanadora = await this.prisma.pareja.findUnique({
      where: { id: ganadorId },
      include: { jugador1: true, jugador2: true },
    });
    if (!parejaGanadora) return;

    // Construir resultado legible
    const sets: string[] = [];
    if (match.set1Pareja1 != null && match.set1Pareja2 != null) {
      sets.push(`${match.set1Pareja1}-${match.set1Pareja2}`);
    }
    if (match.set2Pareja1 != null && match.set2Pareja2 != null) {
      sets.push(`${match.set2Pareja1}-${match.set2Pareja2}`);
    }
    if (match.set3Pareja1 != null && match.set3Pareja2 != null) {
      sets.push(`${match.set3Pareja1}-${match.set3Pareja2}`);
    }
    const resultado = sets.join(', ') || 'Retiro';

    // Determinar siguiente ronda
    let siguienteRonda: string | undefined;
    if (match.partidoSiguienteId) {
      const nextMatch = await this.prisma.match.findUnique({
        where: { id: match.partidoSiguienteId },
      });
      if (nextMatch) {
        siguienteRonda = nextMatch.ronda;
      }
    }

    const data = {
      torneoNombre: tournament.nombre,
      tournamentId: match.tournamentId,
      ronda: match.ronda,
      resultado,
      siguienteRonda,
    };

    // Notificar ambos jugadores de la pareja ganadora
    for (const jugador of [parejaGanadora.jugador1, parejaGanadora.jugador2].filter(Boolean)) {
      try {
        await this.notificacionesService.notificarResultadoGanador(jugador.id, data);
      } catch (e) {
        this.logger.error(`Error notificando resultado a ${jugador.id}: ${e.message}`);
      }
    }
  }

  /**
   * Verifica si un match tiene ambas parejas y horario, y notifica a los 4 jugadores.
   */
  private async verificarYNotificarSiguientePartido(matchId: string, tournamentId: string) {
    const nextMatch = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: {
        pareja1: { include: { jugador1: true, jugador2: true } },
        pareja2: { include: { jugador1: true, jugador2: true } },
        torneoCancha: {
          include: {
            sedeCancha: { include: { sede: true } },
          },
        },
      },
    });

    if (!nextMatch || !nextMatch.pareja1Id || !nextMatch.pareja2Id) return;

    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
    });
    if (!tournament) return;

    const fecha = nextMatch.fechaProgramada
      ? new Date(nextMatch.fechaProgramada).toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit' })
      : 'Por definir';
    const hora = nextMatch.horaProgramada || 'Por definir';
    const cancha = nextMatch.torneoCancha?.sedeCancha?.nombre || 'Por definir';
    const sede = nextMatch.torneoCancha?.sedeCancha?.sede?.nombre || '';

    const p1j1 = nextMatch.pareja1?.jugador1;
    const p1j2 = nextMatch.pareja1?.jugador2;
    const p2j1 = nextMatch.pareja2?.jugador1;
    const p2j2 = nextMatch.pareja2?.jugador2;

    const nombresP1 = [p1j1?.nombre, p1j2?.nombre].filter(Boolean).join(' / ');
    const nombresP2 = [p2j1?.nombre, p2j2?.nombre].filter(Boolean).join(' / ');

    const data = {
      torneoNombre: tournament.nombre,
      tournamentId,
      ronda: nextMatch.ronda,
      fecha,
      hora,
      cancha,
      sede,
    };

    // Notificar pareja1 (oponentes = pareja2)
    for (const jugador of [p1j1, p1j2].filter(Boolean)) {
      try {
        await this.notificacionesService.notificarSiguientePartidoListo(
          jugador.id,
          { ...data, oponentes: nombresP2 || 'Rival' },
        );
      } catch (e) {
        this.logger.error(`Error notificando siguiente partido a ${jugador.id}: ${e.message}`);
      }
    }

    // Notificar pareja2 (oponentes = pareja1)
    for (const jugador of [p2j1, p2j2].filter(Boolean)) {
      try {
        await this.notificacionesService.notificarSiguientePartidoListo(
          jugador.id,
          { ...data, oponentes: nombresP1 || 'Rival' },
        );
      } catch (e) {
        this.logger.error(`Error notificando siguiente partido a ${jugador.id}: ${e.message}`);
      }
    }
  }
}
