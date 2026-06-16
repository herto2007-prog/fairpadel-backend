import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DateService } from '../../common/services/date.service';
import { DescansoCalculatorService } from './descanso-calculator.service';
import { calcularHoraFin, tieneConflictoPareja } from './scheduling-utils';

export interface SlotDisponible {
  id: string;
  fecha: string; // YYYY-MM-DD
  horaInicio: string;
  horaFin: string;
  torneoCanchaId: string;
  sedeNombre: string;
  canchaNombre: string;
}

// NOTA: estas interfaces las consume scheduling-utils.ts (tipos del motor de
// cálculo). El cálculo masivo (calcular/aplicar) se retiró: hoy la programación
// la hace el motor predictivo (AsignacionSlotsService) + programarPartidoAutomatico.
export interface PartidoProgramar {
  id: string;
  fase: string;
  orden: number;
  categoriaId: string;
  categoriaNombre: string;
  pareja1?: { id: string; jugador1: { nombre: string }; jugador2?: { nombre: string } };
  pareja2?: { id: string; jugador1: { nombre: string }; jugador2?: { nombre: string } };
  inscripcion1Id?: string;
  inscripcion2Id?: string;
}

export interface PartidoAsignado {
  partidoId: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  torneoCanchaId: string;
  sedeNombre: string;
  canchaNombre: string;
  fase: string;
  categoriaNombre: string;
  pareja1?: string;
  pareja2?: string;
}

export interface DistribucionDia {
  fecha: string;
  diaSemana: string;
  horarioInicio: string;
  horarioFin: string;
  slotsDisponibles: number;
  slotsAsignados: number;
  partidos: PartidoAsignado[];
}

export interface PrediccionRecursos {
  totalPartidos: number;
  horasNecesarias: number;
  slotsDisponibles: number;
  deficit: number;
  suficiente: boolean;
  sugerencias: string[];
}

export interface LogAsignacion {
  tipo: 'SALTADO' | 'ASIGNADO' | 'ADELANTADO';
  partidoId: string;
  categoriaNombre: string;
  fase: string;
  fecha: string;
  hora: string;
  mensaje: string;
}

export interface Conflicto {
  tipo: 'MISMA_PAREJA' | 'CANCHA_OCUPADA' | 'SIN_DISPONIBILIDAD' | 'SIN_FECHA_FINALES' | 'ADVERTENCIA' | 'INFO';
  severidad: 'BLOQUEANTE' | 'ADVERTENCIA' | 'INFO';
  partidoId: string;
  mensaje: string;
  sugerencia?: string;
  accion?: 'AGREGAR_DIAS' | 'EXTENDER_HORARIOS' | 'CONFIGURAR_FINALES' | 'ACEPTAR_RIESGO';
}

@Injectable()
export class ProgramacionService {
  constructor(
    private prisma: PrismaService,
    private dateService: DateService,
    private descansoCalculator: DescansoCalculatorService,
  ) {}

  /**
   * Obtiene los slots disponibles (LIBRES) configurados en el tab Canchas.
   */
  private async obtenerSlotsDisponibles(tournamentId: string): Promise<SlotDisponible[]> {
    const disponibilidades = await this.prisma.torneoDisponibilidadDia.findMany({
      where: {
        tournamentId,
        activo: true,
      },
    });

    if (disponibilidades.length === 0) {
      return [];
    }

    const disponibilidadIds = disponibilidades.map(d => d.id);
    const dispMap = new Map(disponibilidades.map(d => [d.id, d]));

    const slots = await this.prisma.torneoSlot.findMany({
      where: {
        disponibilidadId: { in: disponibilidadIds },
        estado: 'LIBRE',
      },
      orderBy: [
        { horaInicio: 'asc' },
      ],
    });

    if (slots.length === 0) {
      return [];
    }

    const canchaIds = [...new Set(slots.map(s => s.torneoCanchaId).filter(Boolean))];
    const canchas = await this.prisma.torneoCancha.findMany({
      where: {
        id: { in: canchaIds },
      },
      include: {
        sedeCancha: {
          include: {
            sede: { select: { nombre: true } },
          },
        },
      },
    });
    const canchaMap = new Map(canchas.map(c => [c.id, c]));

    return slots
      .filter(s => dispMap.has(s.disponibilidadId) && canchaMap.has(s.torneoCanchaId))
      .map(s => {
        const disp = dispMap.get(s.disponibilidadId);
        const cancha = canchaMap.get(s.torneoCanchaId);
        return {
          id: s.id,
          // FIX: fecha es String YYYY-MM-DD
          fecha: disp.fecha,
          horaInicio: s.horaInicio,
          horaFin: s.horaFin,
          torneoCanchaId: s.torneoCanchaId,
          sedeNombre: cancha.sedeCancha.sede.nombre,
          canchaNombre: cancha.sedeCancha.nombre,
        };
      })
      .sort((a, b) => {
        if (a.fecha !== b.fecha) return a.fecha.localeCompare(b.fecha);
        return a.horaInicio.localeCompare(b.horaInicio);
      });
  }

  /**
   * Programa automáticamente un partido específico buscando el mejor slot disponible.
   * Se usa cuando un partido de fase siguiente queda con ambas parejas definidas
   * (lo llaman resultados.service y clasificacion.service al cargar un resultado).
   */
  async programarPartidoAutomatico(
    tournamentId: string,
    matchId: string,
  ): Promise<{ success: boolean; asignacion?: PartidoAsignado; message?: string }> {
    // Obtener el partido básico
    const partido = await this.prisma.match.findUnique({
      where: { id: matchId },
    });

    if (!partido) {
      return { success: false, message: 'Partido no encontrado' };
    }

    // Solo programar si tiene ambas parejas definidas
    if (!partido.inscripcion1Id || !partido.inscripcion2Id) {
      return { success: false, message: 'Partido no tiene ambas parejas definidas' };
    }

    // Si ya está programado, no hacer nada
    if (partido.torneoCanchaId && partido.fechaProgramada && partido.horaProgramada) {
      return { success: false, message: 'Partido ya está programado' };
    }

    // Obtener torneo para configuración de finales
    const torneo = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: {
        fechaFinales: true,
        horaInicioFinales: true,
        horaFinFinales: true,
        canchasFinales: true,
      },
    });

    // Obtener slots disponibles para este torneo
    const slots = await this.obtenerSlotsDisponibles(tournamentId);
    if (slots.length === 0) {
      return { success: false, message: 'No hay slots disponibles' };
    }

    // Determinar restricciones según la fase.
    // Día de finales = el del torneo si está, si no el ÚLTIMO día configurado
    // (mismo criterio que el motor predictivo asignarSlots).
    const esFaseFinal = ['SEMIS', 'FINAL'].includes(partido.ronda);
    const ultimaFecha = [...new Set(slots.map(s => s.fecha))].sort().pop() || null;
    const fechaFinales = torneo?.fechaFinales || ultimaFecha;

    // Filtrar slots según la fase
    let slotsCandidatos = slots;

    if (esFaseFinal && fechaFinales) {
      // Finales solo en fechaFinales
      slotsCandidatos = slots.filter(s => s.fecha === fechaFinales);

      // Aplicar restricciones de horario si existen
      if (torneo?.horaInicioFinales) {
        slotsCandidatos = slotsCandidatos.filter(s => s.horaInicio >= torneo.horaInicioFinales!);
      }
      if (torneo?.horaFinFinales) {
        slotsCandidatos = slotsCandidatos.filter(s => s.horaInicio <= torneo.horaFinFinales!);
      }

      // Filtrar por canchas designadas si existen
      const canchasFinales = torneo?.canchasFinales as string[];
      if (canchasFinales?.length > 0) {
        slotsCandidatos = slotsCandidatos.filter(s => canchasFinales.includes(s.torneoCanchaId));
      }
    } else {
      // Fases no-finales: evitar fechaFinales si está definida
      if (fechaFinales) {
        slotsCandidatos = slots.filter(s => s.fecha !== fechaFinales);
      }
    }

    if (slotsCandidatos.length === 0) {
      return { success: false, message: 'No hay slots disponibles para esta fase' };
    }

    // Obtener partidos ya programados para verificar conflictos
    const partidosProgramados = await this.obtenerPartidosProgramados(tournamentId);

    // Buscar el mejor slot (el primero disponible sin conflicto de pareja)
    for (const slot of slotsCandidatos) {
      // Verificar si el slot está ocupado
      const slotOcupado = partidosProgramados.some(p =>
        p.fecha === slot.fecha &&
        p.horaInicio === slot.horaInicio &&
        p.torneoCanchaId === slot.torneoCanchaId,
      );

      if (slotOcupado) continue;

      // Verificar conflicto de pareja (2h de descanso)
      const parejaIds = [partido.inscripcion1Id, partido.inscripcion2Id].filter(Boolean);
      const hayConflicto = tieneConflictoPareja(this.descansoCalculator,
        parejaIds,
        slot.fecha,
        slot.horaInicio,
        partidosProgramados,
      );

      if (hayConflicto) continue;

      // ¡Slot ideal encontrado! Asignarlo
      await this.prisma.match.update({
        where: { id: matchId },
        data: {
          torneoCanchaId: slot.torneoCanchaId,
          fechaProgramada: slot.fecha,
          horaProgramada: slot.horaInicio,
        },
      });

      // Marcar slot como ocupado
      await this.ocuparSlot(slot.torneoCanchaId, slot.fecha, slot.horaInicio);

      const asignacion: PartidoAsignado = {
        partidoId: matchId,
        fecha: slot.fecha,
        horaInicio: slot.horaInicio,
        horaFin: calcularHoraFin(slot.horaInicio),
        torneoCanchaId: slot.torneoCanchaId,
        sedeNombre: slot.sedeNombre,
        canchaNombre: slot.canchaNombre,
        fase: partido.ronda,
        categoriaNombre: 'Categoría', // Simplificado
        pareja1: partido.inscripcion1Id || undefined,
        pareja2: partido.inscripcion2Id || undefined,
      };

      return { success: true, asignacion, message: 'Partido programado automáticamente' };
    }

    return { success: false, message: 'No se encontró slot disponible sin conflictos' };
  }

  /**
   * Obtiene todos los partidos ya programados de un torneo (para detectar choques).
   */
  private async obtenerPartidosProgramados(tournamentId: string): Promise<PartidoAsignado[]> {
    const partidos = await this.prisma.match.findMany({
      where: {
        fixtureVersion: {
          tournamentId,
        },
        torneoCanchaId: { not: null },
        fechaProgramada: { not: null },
        horaProgramada: { not: null },
      },
    });

    return partidos.map(p => ({
      partidoId: p.id,
      // FIX: fechaProgramada es String YYYY-MM-DD
      fecha: p.fechaProgramada as string,
      horaInicio: p.horaProgramada as string,
      horaFin: calcularHoraFin(p.horaProgramada as string),
      torneoCanchaId: p.torneoCanchaId as string,
      sedeNombre: '',
      canchaNombre: '',
      fase: p.ronda,
      categoriaNombre: '',
      pareja1: p.inscripcion1Id || undefined,
      pareja2: p.inscripcion2Id || undefined,
    }));
  }

  private async ocuparSlot(
    torneoCanchaId: string,
    fecha: string,
    horaInicio: string,
  ): Promise<void> {
    await this.prisma.torneoSlot.updateMany({
      where: {
        torneoCanchaId,
        disponibilidad: {
          // FIX: fecha es String YYYY-MM-DD
          fecha: fecha,
        },
        horaInicio,
      },
      data: { estado: 'OCUPADO' },
    });
  }
}
