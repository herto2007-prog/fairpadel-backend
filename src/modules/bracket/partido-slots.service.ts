import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { horaAMinutos } from '../../common/utils/time-helpers';
import { DESCANSO_MIN } from './agenda-config';

/**
 * Gestión de slots (horarios/canchas) de partidos: consultar disponibles,
 * cambiar e intercambiar. Extraído tal cual de CanchasSorteoService
 * (refactor de archivos monstruo); la lógica no cambió.
 */
@Injectable()
export class PartidoSlotsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Obtiene slots disponibles para un partido específico
   * Considera restricciones de descanso por origen y pareja
   */
  async obtenerSlotsDisponibles(tournamentId: string, matchId: string) {
    // Obtener datos del partido
    const partido = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: {
        inscripcion1: true,
        inscripcion2: true,
      },
    });

    if (!partido) {
      throw new NotFoundException('Partido no encontrado');
    }

    // Obtener días configurados
    const diasConfig = await this.prisma.torneoDisponibilidadDia.findMany({
      where: { tournamentId },
      orderBy: { fecha: 'asc' },
    });

    // Obtener slots disponibles (LIBRES)
    const slotsLibres = await this.prisma.torneoSlot.findMany({
      where: {
        disponibilidadId: { in: diasConfig.map(d => d.id) },
        estado: 'LIBRE',
      },
      include: {
        disponibilidad: true,
        torneoCancha: { include: { sedeCancha: true } },
      },
      orderBy: [
        { disponibilidad: { fecha: 'asc' } },
        { horaInicio: 'asc' },
      ],
    });

    // Verificar restricciones de descanso por origen
    const slotsValidos = [];
    for (const slot of slotsLibres) {
      const diaFecha = slot.disponibilidad.fecha;
      let esValido = true;
      let restriccion = '';

      // Verificar orígenes
      for (const origenId of [partido.partidoOrigen1Id, partido.partidoOrigen2Id].filter(Boolean)) {
        const origen = await this.prisma.match.findUnique({
          where: { id: origenId! },
          select: { fechaProgramada: true, horaProgramada: true, horaFinEstimada: true },
        });

        if (origen?.fechaProgramada === diaFecha && origen.horaProgramada) {
          // Misma regla que el asignador/auditor: fin REAL del origen + DESCANSO_MIN.
          const horaFinOrigen = origen.horaFinEstimada
            ? horaAMinutos(origen.horaFinEstimada)
            : horaAMinutos(origen.horaProgramada) + DESCANSO_MIN;
          const horaInicioSlot = horaAMinutos(slot.horaInicio);
          const descansoMin = horaInicioSlot - horaFinOrigen;

          if (descansoMin < DESCANSO_MIN) {
            esValido = false;
            restriccion = `Descanso insuficiente: ${descansoMin}min (mínimo ${DESCANSO_MIN}min)`;
            break;
          }
        }
      }

      // Verificar fase permitida en ese día
      const fasesPermitidas = (slot.disponibilidad.fasesPermitidas as string)?.split(',') || [];
      if (fasesPermitidas.length > 0 && !fasesPermitidas.includes(partido.ronda)) {
        esValido = false;
        restriccion = `Fase ${partido.ronda} no permitida este día`;
      }

      slotsValidos.push({
        ...slot,
        esValido,
        restriccion,
      });
    }

    // Separar en válidos e inválidos
    const validos = slotsValidos.filter(s => s.esValido);
    const invalidos = slotsValidos.filter(s => !s.esValido);

    return {
      success: true,
      data: {
        partido: {
          id: partido.id,
          ronda: partido.ronda,
          fechaActual: partido.fechaProgramada,
          horaActual: partido.horaProgramada,
        },
        slotsValidos: validos,
        slotsInvalidos: invalidos.slice(0, 10), // Solo mostrar primeros 10 inválidos
        totalDisponibles: validos.length,
      },
    };
  }

  /**
   * Cambia el slot de un partido
   */
  async cambiarSlot(tournamentId: string, matchId: string, nuevoSlotId: string) {
    // Obtener partido
    const partido = await this.prisma.match.findUnique({
      where: { id: matchId },
    });

    if (!partido) {
      throw new NotFoundException('Partido no encontrado');
    }

    // Obtener slot actual
    const slotActual = await this.prisma.torneoSlot.findFirst({
      where: { matchId },
    });

    // Obtener nuevo slot
    const nuevoSlot = await this.prisma.torneoSlot.findUnique({
      where: { id: nuevoSlotId },
      include: { disponibilidad: true },
    });

    if (!nuevoSlot) {
      throw new NotFoundException('Slot no encontrado');
    }

    if (nuevoSlot.estado !== 'LIBRE') {
      throw new BadRequestException('El slot seleccionado no está disponible');
    }

    // Transacción: liberar slot actual y ocupar nuevo
    await this.prisma.$transaction(async (tx) => {
      // Liberar slot actual si existe
      if (slotActual) {
        await tx.torneoSlot.update({
          where: { id: slotActual.id },
          data: { estado: 'LIBRE', matchId: null },
        });
      }

      // Ocupar nuevo slot
      await tx.torneoSlot.update({
        where: { id: nuevoSlotId },
        data: { estado: 'OCUPADO', matchId },
      });

      // Actualizar partido
      await tx.match.update({
        where: { id: matchId },
        data: {
          fechaProgramada: nuevoSlot.disponibilidad.fecha,
          horaProgramada: nuevoSlot.horaInicio,
          torneoCanchaId: nuevoSlot.torneoCanchaId,
        },
      });
    });

    return {
      success: true,
      message: 'Slot actualizado correctamente',
      data: {
        partidoId: matchId,
        nuevaFecha: nuevoSlot.disponibilidad.fecha,
        nuevaHora: nuevoSlot.horaInicio,
      },
    };
  }

  /**
   * Intercambia slots entre dos partidos
   */
  async intercambiarSlots(tournamentId: string, matchId1: string, matchId2: string) {
    // Obtener ambos partidos
    const [partido1, partido2] = await Promise.all([
      this.prisma.match.findUnique({ where: { id: matchId1 } }),
      this.prisma.match.findUnique({ where: { id: matchId2 } }),
    ]);

    if (!partido1 || !partido2) {
      throw new NotFoundException('Uno o ambos partidos no encontrados');
    }

    // Obtener slots actuales
    const [slot1, slot2] = await Promise.all([
      this.prisma.torneoSlot.findFirst({ where: { matchId: matchId1 }, include: { disponibilidad: true } }),
      this.prisma.torneoSlot.findFirst({ where: { matchId: matchId2 }, include: { disponibilidad: true } }),
    ]);

    // Si alguno no tiene slot, no se puede intercambiar
    if (!slot1 || !slot2) {
      throw new BadRequestException('Ambos partidos deben tener slots asignados para intercambiar');
    }

    // Transacción. OJO: TorneoSlot.matchId es @unique → hay que LIBERAR un
    // slot antes de reasignar, o el swap viola la unicidad y explota (bug
    // histórico: este endpoint devolvía 500 SIEMPRE por el orden de updates).
    await this.prisma.$transaction(async (tx) => {
      await tx.torneoSlot.update({
        where: { id: slot1.id },
        data: { matchId: null },
      });

      await tx.torneoSlot.update({
        where: { id: slot2.id },
        data: { matchId: matchId1 },
      });

      await tx.torneoSlot.update({
        where: { id: slot1.id },
        data: { matchId: matchId2 },
      });

      // Actualizar fechas en partidos
      await tx.match.update({
        where: { id: matchId1 },
        data: {
          fechaProgramada: slot2.disponibilidad.fecha,
          horaProgramada: slot2.horaInicio,
          torneoCanchaId: slot2.torneoCanchaId,
        },
      });

      await tx.match.update({
        where: { id: matchId2 },
        data: {
          fechaProgramada: slot1.disponibilidad.fecha,
          horaProgramada: slot1.horaInicio,
          torneoCanchaId: slot1.torneoCanchaId,
        },
      });
    });

    return {
      success: true,
      message: 'Slots intercambiados correctamente',
      data: {
        partido1: { id: matchId1, nuevaFecha: slot2.disponibilidad.fecha, nuevaHora: slot2.horaInicio },
        partido2: { id: matchId2, nuevaFecha: slot1.disponibilidad.fecha, nuevaHora: slot1.horaInicio },
      },
    };
  }
}
