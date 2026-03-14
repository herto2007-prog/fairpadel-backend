import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface SlotDisponible {
  id: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  torneoCanchaId: string;
  sedeNombre: string;
  canchaNombre: string;
}

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

export interface DistribucionDia {
  fecha: string;
  diaSemana: string;
  horarioInicio: string;
  horarioFin: string;
  slotsDisponibles: number;
  slotsAsignados: number;
  partidos: PartidoAsignado[];
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

export interface PrediccionRecursos {
  totalPartidos: number;
  horasNecesarias: number;
  slotsDisponibles: number;
  deficit: number;
  suficiente: boolean;
  sugerencias: string[];
}

export interface ResultadoProgramacion {
  prediccion: PrediccionRecursos;
  distribucion: DistribucionDia[];
  conflictos: Conflicto[];
}

export interface Conflicto {
  tipo: 'MISMA_PAREJA' | 'CANCHA_OCUPADA' | 'SIN_DISPONIBILIDAD';
  partidoId: string;
  mensaje: string;
}

@Injectable()
export class ProgramacionService {
  constructor(private prisma: PrismaService) {}

  /**
   * Calcula la programación inteligente para un torneo
   */
  async calcularProgramacion(
    tournamentId: string,
    categoriasSorteadas: string[],
    fechaInicio?: string,
  ): Promise<ResultadoProgramacion> {
    // 1. Obtener partidos de las categorías sorteadas
    const partidos = await this.obtenerPartidos(tournamentId, categoriasSorteadas);
    
    // 2. Obtener slots disponibles
    const slots = await this.obtenerSlotsDisponibles(tournamentId);
    
    // 3. Calcular predicción de recursos
    const prediccion = this.calcularPrediccion(partidos, slots);
    
    // 4. Si no hay suficientes recursos, retornar temprano
    if (!prediccion.suficiente) {
      return {
        prediccion,
        distribucion: [],
        conflictos: [{
          tipo: 'SIN_DISPONIBILIDAD',
          partidoId: '',
          mensaje: 'No hay suficientes slots disponibles para programar todos los partidos',
        }],
      };
    }

    // 5. Distribuir partidos
    const distribucion = await this.distribuirPartidos(partidos, slots, fechaInicio);
    
    // 6. Validar conflictos
    const conflictos = this.validarConflictos(distribucion);

    return {
      prediccion,
      distribucion,
      conflictos,
    };
  }

  /**
   * Obtiene los partidos de las categorías sorteadas
   */
  private async obtenerPartidos(
    tournamentId: string,
    categoriasSorteadas: string[],
  ): Promise<PartidoProgramar[]> {
    const partidos = await this.prisma.match.findMany({
      where: {
        tournamentId,
        fixtureVersionId: { not: null },
      },
      include: {
        inscripcion1: {
          select: {
            id: true,
            jugador1: { select: { nombre: true } },
            jugador2: { select: { nombre: true } },
          },
        },
        inscripcion2: {
          select: {
            id: true,
            jugador1: { select: { nombre: true } },
            jugador2: { select: { nombre: true } },
          },
        },
      },
      orderBy: [
        { ronda: 'asc' },
        { numeroRonda: 'asc' },
      ],
    });

    // Filtrar solo las categorías sorteadas
    const fixtureVersions = await this.prisma.fixtureVersion.findMany({
      where: {
        tournamentCategory: {
          id: { in: categoriasSorteadas },
        },
      },
      include: {
        tournamentCategory: {
          include: {
            category: {
              select: { id: true, nombre: true },
            },
          },
        },
      },
    });

    const fixtureVersionMap = new Map(fixtureVersions.map(fv => [fv.id, fv]));

    return partidos
      .filter(p => fixtureVersionMap.has(p.fixtureVersionId))
      .map(p => {
        const fv = fixtureVersionMap.get(p.fixtureVersionId);
        return {
          id: p.id,
          fase: p.ronda,
          orden: p.numeroRonda,
          categoriaId: fv.tournamentCategory.category.id,
          categoriaNombre: fv.tournamentCategory.category.nombre,
          pareja1: p.inscripcion1 || undefined,
          pareja2: p.inscripcion2 || undefined,
          inscripcion1Id: p.inscripcion1Id || undefined,
          inscripcion2Id: p.inscripcion2Id || undefined,
        };
      });
  }

  /**
   * Obtiene los slots disponibles configurados
   */
  private async obtenerSlotsDisponibles(tournamentId: string): Promise<SlotDisponible[]> {
    // Obtener disponibilidades del torneo
    const disponibilidades = await this.prisma.torneoDisponibilidadDia.findMany({
      where: {
        tournamentId,
        activo: true,
      },
    });
    const disponibilidadIds = disponibilidades.map(d => d.id);
    const dispMap = new Map(disponibilidades.map(d => [d.id, d]));

    // Obtener slots de esas disponibilidades
    const slots = await this.prisma.torneoSlot.findMany({
      where: {
        disponibilidadId: { in: disponibilidadIds },
        estado: 'LIBRE',
      },
      orderBy: [
        { horaInicio: 'asc' },
      ],
    });

    // Obtener canchas
    const canchas = await this.prisma.torneoCancha.findMany({
      where: {
        id: { in: slots.map(s => s.torneoCanchaId).filter(Boolean) },
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
          fecha: disp.fecha.toISOString().split('T')[0], // Convertir Date a string YYYY-MM-DD
          horaInicio: s.horaInicio,
          horaFin: s.horaFin,
          torneoCanchaId: s.torneoCanchaId,
          sedeNombre: cancha.sedeCancha.sede.nombre,
          canchaNombre: cancha.sedeCancha.nombre,
        };
      });
  }

  /**
   * Calcula la predicción de recursos necesarios
   */
  private calcularPrediccion(
    partidos: PartidoProgramar[],
    slots: SlotDisponible[],
  ): PrediccionRecursos {
    // Contar partidos por fase
    const porFase = this.contarPorFase(partidos);
    
    // Horas necesarias (1.5h por partido promedio)
    const horasNecesarias = partidos.length * 1.5;
    
    // Calcular horas disponibles
    const horasDisponibles = slots.reduce((total, slot) => {
      const inicio = this.parseHora(slot.horaInicio);
      const fin = this.parseHora(slot.horaFin);
      return total + (fin - inicio);
    }, 0);

    const deficit = Math.max(0, horasNecesarias - horasDisponibles);
    const suficiente = deficit === 0;

    const sugerencias: string[] = [];
    if (!suficiente) {
      const diasNecesarios = Math.ceil(horasNecesarias / (horasDisponibles / 4)); // Asumiendo 4 días
      const canchasAdicionales = Math.ceil(deficit / (8 * 1.5)); // 8 horas por día
      
      sugerencias.push(`Extender ${diasNecesarios} día(s) más`);
      sugerencias.push(`Agregar ${canchasAdicionales} cancha(s) adicional(es)`);
      
      if (porFase.ZONA > 0 && porFase.OCTAVOS === 0) {
        sugerencias.push('Considerar usar bracket de 8 en lugar de 16 para reducir partidos');
      }
    }

    return {
      totalPartidos: partidos.length,
      horasNecesarias,
      slotsDisponibles: horasDisponibles,
      deficit,
      suficiente,
      sugerencias,
    };
  }

  /**
   * Cuenta partidos por fase
   */
  private contarPorFase(partidos: PartidoProgramar[]) {
    const porFase: Record<string, number> = {};
    partidos.forEach(p => {
      porFase[p.fase] = (porFase[p.fase] || 0) + 1;
    });
    return porFase;
  }

  /**
   * Distribuye los partidos en los slots disponibles
   */
  private async distribuirPartidos(
    partidos: PartidoProgramar[],
    slots: SlotDisponible[],
    fechaInicio?: string,
  ): Promise<DistribucionDia[]> {
    // Agrupar slots por fecha
    const slotsPorFecha = this.agruparSlotsPorFecha(slots);
    
    // Ordenar fechas
    const fechasOrdenadas = Object.keys(slotsPorFecha).sort();
    
    // Si hay fecha de inicio específica, filtrar desde ahí
    let fechasUsar = fechasOrdenadas;
    if (fechaInicio) {
      fechasUsar = fechasOrdenadas.filter(f => f >= fechaInicio);
    }

    // Separar partidos por fase
    const partidosZona = partidos.filter(p => p.fase === 'ZONA');
    const partidosRonda = partidos.filter(p => p.fase === 'REPECHAJE');
    const partidosOctavos = partidos.filter(p => p.fase === 'OCTAVOS');
    const partidosCuartos = partidos.filter(p => p.fase === 'CUARTOS');
    const partidosSemis = partidos.filter(p => p.fase === 'SEMIS');
    const partidosFinal = partidos.filter(p => p.fase === 'FINAL');

    const distribucion: DistribucionDia[] = [];
    const slotsAsignados = new Set<string>();
    const asignaciones: PartidoAsignado[] = [];

    // Distribuir ZONA (primera prioridad)
    let fechaIndex = 0;
    for (const partido of partidosZona) {
      const asignacion = this.encontrarSlot(
        partido,
        fechasUsar,
        slotsPorFecha,
        slotsAsignados,
        asignaciones,
      );
      
      if (asignacion) {
        asignaciones.push(asignacion);
        slotsAsignados.add(`${asignacion.fecha}-${asignacion.torneoCanchaId}-${asignacion.horaInicio}`);
      }
    }

    // Distribuir RONDA DE AJUSTE
    for (const partido of partidosRonda) {
      const asignacion = this.encontrarSlot(
        partido,
        fechasUsar,
        slotsPorFecha,
        slotsAsignados,
        asignaciones,
      );
      
      if (asignacion) {
        asignaciones.push(asignacion);
        slotsAsignados.add(`${asignacion.fecha}-${asignacion.torneoCanchaId}-${asignacion.horaInicio}`);
      }
    }

    // Distribuir OCTAVOS
    for (const partido of partidosOctavos) {
      const asignacion = this.encontrarSlot(
        partido,
        fechasUsar,
        slotsPorFecha,
        slotsAsignados,
        asignaciones,
      );
      
      if (asignacion) {
        asignaciones.push(asignacion);
        slotsAsignados.add(`${asignacion.fecha}-${asignacion.torneoCanchaId}-${asignacion.horaInicio}`);
      }
    }

    // Distribuir CUARTOS
    for (const partido of partidosCuartos) {
      const asignacion = this.encontrarSlot(
        partido,
        fechasUsar,
        slotsPorFecha,
        slotsAsignados,
        asignaciones,
      );
      
      if (asignacion) {
        asignaciones.push(asignacion);
        slotsAsignados.add(`${asignacion.fecha}-${asignacion.torneoCanchaId}-${asignacion.horaInicio}`);
      }
    }

    // Distribuir SEMIS
    for (const partido of partidosSemis) {
      const asignacion = this.encontrarSlot(
        partido,
        fechasUsar,
        slotsPorFecha,
        slotsAsignados,
        asignaciones,
      );
      
      if (asignacion) {
        asignaciones.push(asignacion);
        slotsAsignados.add(`${asignacion.fecha}-${asignacion.torneoCanchaId}-${asignacion.horaInicio}`);
      }
    }

    // Distribuir FINAL
    for (const partido of partidosFinal) {
      const asignacion = this.encontrarSlot(
        partido,
        fechasUsar,
        slotsPorFecha,
        slotsAsignados,
        asignaciones,
      );
      
      if (asignacion) {
        asignaciones.push(asignacion);
        slotsAsignados.add(`${asignacion.fecha}-${asignacion.torneoCanchaId}-${asignacion.horaInicio}`);
      }
    }

    // Agrupar por fecha para la respuesta
    const asignacionesPorFecha = this.agruparAsignacionesPorFecha(asignaciones);
    
    for (const fecha of fechasUsar) {
      const partidosDelDia = asignacionesPorFecha[fecha] || [];
      if (partidosDelDia.length === 0) continue;

      const diaSlots = slotsPorFecha[fecha] || [];
      
      distribucion.push({
        fecha,
        diaSemana: this.getDiaSemana(fecha),
        horarioInicio: diaSlots[0]?.horaInicio || '18:00',
        horarioFin: diaSlots[diaSlots.length - 1]?.horaFin || '00:00',
        slotsDisponibles: diaSlots.length,
        slotsAsignados: partidosDelDia.length,
        partidos: partidosDelDia,
      });
    }

    return distribucion;
  }

  /**
   * Agrupa slots por fecha
   */
  private agruparSlotsPorFecha(slots: SlotDisponible[]): Record<string, SlotDisponible[]> {
    const agrupado: Record<string, SlotDisponible[]> = {};
    slots.forEach(slot => {
      if (!agrupado[slot.fecha]) {
        agrupado[slot.fecha] = [];
      }
      agrupado[slot.fecha].push(slot);
    });
    return agrupado;
  }

  /**
   * Agrupa asignaciones por fecha
   */
  private agruparAsignacionesPorFecha(asignaciones: PartidoAsignado[]): Record<string, PartidoAsignado[]> {
    const agrupado: Record<string, PartidoAsignado[]> = {};
    asignaciones.forEach(a => {
      if (!agrupado[a.fecha]) {
        agrupado[a.fecha] = [];
      }
      agrupado[a.fecha].push(a);
    });
    return agrupado;
  }

  /**
   * Encuentra un slot disponible para un partido
   */
  private encontrarSlot(
    partido: PartidoProgramar,
    fechas: string[],
    slotsPorFecha: Record<string, SlotDisponible[]>,
    slotsAsignados: Set<string>,
    asignacionesExistentes: PartidoAsignado[],
  ): PartidoAsignado | null {
    for (const fecha of fechas) {
      const slotsDelDia = slotsPorFecha[fecha] || [];
      
      for (const slot of slotsDelDia) {
        const slotKey = `${fecha}-${slot.torneoCanchaId}-${slot.horaInicio}`;
        
        // Verificar si el slot ya está asignado
        if (slotsAsignados.has(slotKey)) continue;
        
        // Verificar si alguna de las parejas ya juega ese día
        const parejaIds = [partido.inscripcion1Id, partido.inscripcion2Id].filter(Boolean);
        const partidosMismaPareja = asignacionesExistentes.filter(a => 
          a.fecha === fecha && (
            parejaIds.includes(a.pareja1 || '') || 
            parejaIds.includes(a.pareja2 || '')
          )
        );
        
        // Máximo 2 partidos por pareja por día
        if (partidosMismaPareja.length >= 2) continue;
        
        // Verificar 4h de descanso entre partidos
        const horaSlot = this.parseHora(slot.horaInicio);
        const conflictoHorario = partidosMismaPareja.some(p => {
          const horaPartido = this.parseHora(p.horaInicio);
          return Math.abs(horaSlot - horaPartido) < 4;
        });
        
        if (conflictoHorario) continue;
        
        // Slot válido encontrado
        return {
          partidoId: partido.id,
          fecha,
          horaInicio: slot.horaInicio,
          horaFin: slot.horaFin,
          torneoCanchaId: slot.torneoCanchaId,
          sedeNombre: slot.sedeNombre,
          canchaNombre: slot.canchaNombre,
          fase: partido.fase,
          categoriaNombre: partido.categoriaNombre,
          pareja1: partido.pareja1 ? `${partido.pareja1.jugador1.nombre}/${partido.pareja1.jugador2?.nombre || '?'}` : undefined,
          pareja2: partido.pareja2 ? `${partido.pareja2.jugador1.nombre}/${partido.pareja2.jugador2?.nombre || '?'}` : undefined,
        };
      }
    }
    
    return null;
  }

  /**
   * Valida conflictos en la distribución
   */
  private validarConflictos(distribucion: DistribucionDia[]): Conflicto[] {
    const conflictos: Conflicto[] = [];
    
    // Revisar si hay días con muchos partidos
    for (const dia of distribucion) {
      if (dia.slotsAsignados > dia.slotsDisponibles * 0.9) {
        conflictos.push({
          tipo: 'SIN_DISPONIBILIDAD',
          partidoId: '',
          mensaje: `El día ${dia.fecha} está casi saturado (${dia.slotsAsignados}/${dia.slotsDisponibles} slots)`,
        });
      }
    }
    
    return conflictos;
  }

  /**
   * Aplica la programación a los partidos
   */
  async aplicarProgramacion(
    tournamentId: string,
    asignaciones: PartidoAsignado[],
  ): Promise<void> {
    for (const asignacion of asignaciones) {
      await this.prisma.match.update({
        where: { id: asignacion.partidoId },
        data: {
          fechaProgramada: new Date(asignacion.fecha + 'T00:00:00.000Z'),
          horaProgramada: asignacion.horaInicio,
          torneoCanchaId: asignacion.torneoCanchaId,
          estado: 'PROGRAMADO',
        },
      });

      // Marcar slot como ocupado
      await this.prisma.torneoSlot.updateMany({
        where: {
          torneoCanchaId: asignacion.torneoCanchaId,
          disponibilidad: {
            fecha: asignacion.fecha,
          },
          horaInicio: asignacion.horaInicio,
        },
        data: { estado: 'OCUPADO' },
      });
    }
  }

  /**
   * Parsea hora en formato "HH:mm" a número decimal
   */
  private parseHora(hora: string): number {
    const [h, m] = hora.split(':').map(Number);
    return h + m / 60;
  }

  /**
   * Obtiene el nombre del día de la semana
   */
  private getDiaSemana(fecha: string): string {
    const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const date = new Date(fecha);
    return dias[date.getDay()];
  }
}
