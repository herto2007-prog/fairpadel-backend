import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CargarResultadoDto } from './dto/cargar-resultado.dto';
import { calcularHoraFin } from './scheduling-utils';

@Injectable()
export class MatchesService {
  constructor(private prisma: PrismaService) {}

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

    // Avanzar ganador al siguiente partido (usa posicionEnSiguiente)
    if (match.partidoSiguienteId) {
      await this.avanzarGanador(match.partidoSiguienteId, ganadorId, match.id);
    }

    // Avanzar perdedor al partido de acomodación R2 (si aplica)
    if (match.partidoPerdedorSiguienteId && match.posicionEnPerdedor) {
      const campoP = match.posicionEnPerdedor === 1 ? 'pareja1Id' : 'pareja2Id';
      await this.prisma.match.update({
        where: { id: match.partidoPerdedorSiguienteId },
        data: { [campoP]: perdedorId },
      });

      // Verificar si el match R2 destino ya tiene ambas parejas → auto-check BYE
      const r2Match = await this.prisma.match.findUnique({
        where: { id: match.partidoPerdedorSiguienteId },
      });
      if (r2Match && r2Match.pareja1Id && r2Match.pareja2Id) {
        // Ambos slots llenos → match R2 listo para jugar (no es BYE)
      } else if (r2Match) {
        // Verificar si hay otro feeder pendiente para el slot vacío
        const otherPos = match.posicionEnPerdedor === 1 ? 2 : 1;
        const otherSlotField = otherPos === 1 ? 'pareja1Id' : 'pareja2Id';
        if (r2Match[otherSlotField]) {
          // Ambos slots llenos ahora → nada que hacer
        } else {
          // Slot vacío — verificar si hay feeders pendientes
          const pendingFeeders = await this.prisma.match.count({
            where: {
              OR: [
                { partidoPerdedorSiguienteId: r2Match.id, posicionEnPerdedor: otherPos },
              ],
              estado: { notIn: ['FINALIZADO', 'WO', 'CANCELADO'] },
            },
          });
          if (pendingFeeders === 0 && r2Match[campoP]) {
            // No hay feeders pendientes y ya tiene 1 pareja → BYE en R2
            await this.autoAdvanceR2Bye(r2Match.id, r2Match[campoP]);
          }
        }
      }
    }

    // TODO: Actualizar ranking
    // TODO: Enviar notificaciones

    return this.findOne(id);
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
    }
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

  async reprogramar(id: string, data: any) {
    const match = await this.findOne(id);

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
}
