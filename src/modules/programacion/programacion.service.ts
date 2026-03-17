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

/**
 * Orden de fases para programación
 * Las fases más tempranas van primero
 */
const ORDEN_FASES = [
  'ZONA',
  'REPECHAJE',
  'TREINTAYDOSAVOS',
  'DIECISEISAVOS',
  'OCTAVOS',
  'CUARTOS',
  'SEMIS',
  'FINAL',
] as const;

/**
 * Fases que deben ir obligatoriamente en los últimos días
 */
const FASES_FINALES = ['SEMIS', 'FINAL'];

/**
 * Fases que pueden compartir días entre sí pero deben ir después de las fases iniciales
 */
const FASES_INTERMEDIAS = ['CUARTOS'];

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

    // 5. Distribuir partidos con orden cronológico garantizado
    const distribucion = await this.distribuirPartidosPorFases(partidos, slots, fechaInicio);
    
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
   * Distribuye los partidos en los slots disponibles respetando:
   * 1. Orden cronológico de días (independiente del orden de creación)
   * 2. Fases iniciales en días primeros
   * 3. Fases finales (SEMIS/FINAL) obligatoriamente en últimos días
   */
  private async distribuirPartidosPorFases(
    partidos: PartidoProgramar[],
    slots: SlotDisponible[],
    fechaInicio?: string,
  ): Promise<DistribucionDia[]> {
    // 1. Agrupar slots por fecha y ordenar cronológicamente
    const slotsPorFecha = this.agruparSlotsPorFecha(slots);
    let fechasOrdenadas = Object.keys(slotsPorFecha).sort();
    
    // Si hay fecha de inicio específica, filtrar desde ahí
    if (fechaInicio) {
      fechasOrdenadas = fechasOrdenadas.filter(f => f >= fechaInicio);
    }

    if (fechasOrdenadas.length === 0) {
      return [];
    }

    // 2. Separar partidos por fase
    const partidosPorFase: Record<string, PartidoProgramar[]> = {};
    ORDEN_FASES.forEach(fase => {
      partidosPorFase[fase] = partidos.filter(p => p.fase === fase);
    });

    // 3. Calcular cuántos días reservar para fases finales
    const partidosFinales = FASES_FINALES.flatMap(f => partidosPorFase[f] || []);
    const partidosIntermedios = FASES_INTERMEDIAS.flatMap(f => partidosPorFase[f] || []);
    const partidosIniciales = ORDEN_FASES
      .filter(f => !FASES_FINALES.includes(f) && !FASES_INTERMEDIAS.includes(f))
      .flatMap(f => partidosPorFase[f] || []);

    // Calcular slots promedio por día
    const slotsPorDiaPromedio = Math.max(1, 
      Math.floor(slots.length / fechasOrdenadas.length)
    );

    // Días necesarios para fases finales (mínimo 1 día, máximo 2)
    const diasParaFinales = Math.min(2, Math.max(1, 
      Math.ceil(partidosFinales.length / slotsPorDiaPromedio)
    ));

    // Días necesarios para fases intermedias
    const diasParaIntermedios = Math.min(1, Math.max(0,
      Math.ceil(partidosIntermedios.length / slotsPorDiaPromedio)
    ));

    // 4. Asignar rangos de días a cada bloque de fases
    const totalDias = fechasOrdenadas.length;
    
    // Índices de días para cada bloque
    const diasFinales = fechasOrdenadas.slice(-diasParaFinales); // Últimos días
    const diasIntermedios = diasParaIntermedios > 0 && totalDias > diasParaFinales
      ? fechasOrdenadas.slice(-diasParaFinales - diasParaIntermedios, -diasParaFinales)
      : [];
    const diasIniciales = fechasOrdenadas.slice(0, Math.max(1, totalDias - diasParaFinales - diasParaIntermedios));

    const distribucion: DistribucionDia[] = [];
    const slotsAsignados = new Set<string>();
    const asignaciones: PartidoAsignado[] = [];

    // 5. Distribuir fases INICIALES en días primeros (en orden cronológico)
    for (const fase of ORDEN_FASES.filter(f => 
      !FASES_FINALES.includes(f) && !FASES_INTERMEDIAS.includes(f)
    )) {
      for (const partido of partidosPorFase[fase] || []) {
        const asignacion = this.encontrarSlotEnRango(
          partido,
          diasIniciales,
          slotsPorFecha,
          slotsAsignados,
          asignaciones,
        );
        
        if (asignacion) {
          asignaciones.push(asignacion);
          slotsAsignados.add(`${asignacion.fecha}-${asignacion.torneoCanchaId}-${asignacion.horaInicio}`);
        }
      }
    }

    // 6. Distribuir fases INTERMEDIAS
    for (const fase of FASES_INTERMEDIAS) {
      for (const partido of partidosPorFase[fase] || []) {
        // Intentar primero en días intermedios, si no hay, en días iniciales
        let asignacion = this.encontrarSlotEnRango(
          partido,
          diasIntermedios.length > 0 ? diasIntermedios : diasIniciales,
          slotsPorFecha,
          slotsAsignados,
          asignaciones,
        );
        
        if (asignacion) {
          asignaciones.push(asignacion);
          slotsAsignados.add(`${asignacion.fecha}-${asignacion.torneoCanchaId}-${asignacion.horaInicio}`);
        }
      }
    }

    // 7. Distribuir fases FINALES obligatoriamente en últimos días
    for (const fase of FASES_FINALES) {
      for (const partido of partidosPorFase[fase] || []) {
        const asignacion = this.encontrarSlotEnRango(
          partido,
          diasFinales,
          slotsPorFecha,
          slotsAsignados,
          asignaciones,
        );
        
        if (asignacion) {
          asignaciones.push(asignacion);
          slotsAsignados.add(`${asignacion.fecha}-${asignacion.torneoCanchaId}-${asignacion.horaInicio}`);
        }
      }
    }

    // 8. Construir distribución final en orden cronológico
    const asignacionesPorFecha = this.agruparAsignacionesPorFecha(asignaciones);
    
    for (const fecha of fechasOrdenadas) {
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
   * Encuentra un slot disponible para un partido en un rango de días específico
   */
  private encontrarSlotEnRango(
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
  private validarConflictos(distribucion: DistribucionDia[]) {
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

  // ═══════════════════════════════════════════════════════════
  // MÉTODOS PARA EDICIÓN INDIVIDUAL (FASE 2)
  // ═══════════════════════════════════════════════════════════

  /**
   * Actualiza la programación de un partido específico
   */
  async actualizarProgramacionPartido(
    partidoId: string,
    fecha: string,
    horaInicio: string,
    torneoCanchaId: string,
  ): Promise<void> {
    // Verificar que el partido existe
    const partido = await this.prisma.match.findUnique({
      where: { id: partidoId },
    });

    if (!partido) {
      throw new BadRequestException('Partido no encontrado');
    }

    // Si el partido ya estaba programado, liberar el slot anterior
    if (partido.torneoCanchaId && partido.fechaProgramada && partido.horaProgramada) {
      await this.liberarSlot(
        partido.torneoCanchaId,
        partido.fechaProgramada.toISOString().split('T')[0],
        partido.horaProgramada,
      );
    }

    // Calcular hora fin (aproximadamente 1.5h después)
    const horaFin = this.calcularHoraFin(horaInicio);

    // Actualizar el partido
    await this.prisma.match.update({
      where: { id: partidoId },
      data: {
        fechaProgramada: new Date(fecha + 'T00:00:00.000Z'),
        horaProgramada: horaInicio,
        torneoCanchaId: torneoCanchaId,
        estado: 'PROGRAMADO',
      },
    });

    // Marcar nuevo slot como ocupado
    await this.ocuparSlot(torneoCanchaId, fecha, horaInicio);
  }

  /**
   * Desprograma un partido (limpia fecha, hora y cancha)
   */
  async desprogramarPartido(partidoId: string): Promise<void> {
    const partido = await this.prisma.match.findUnique({
      where: { id: partidoId },
    });

    if (!partido) {
      throw new BadRequestException('Partido no encontrado');
    }

    // Liberar el slot si estaba programado
    if (partido.torneoCanchaId && partido.fechaProgramada && partido.horaProgramada) {
      await this.liberarSlot(
        partido.torneoCanchaId,
        partido.fechaProgramada.toISOString().split('T')[0],
        partido.horaProgramada,
      );
    }

    // Limpiar la programación del partido
    await this.prisma.match.update({
      where: { id: partidoId },
      data: {
        fechaProgramada: null,
        horaProgramada: null,
        torneoCanchaId: null,
        estado: 'PROGRAMADO',
      },
    });
  }

  /**
   * Obtiene las canchas disponibles para un torneo
   */
  async getCanchasDisponibles(tournamentId: string) {
    const canchas = await this.prisma.torneoCancha.findMany({
      where: { tournamentId },
      include: {
        sedeCancha: {
          include: {
            sede: { select: { nombre: true } },
          },
        },
      },
    });

    return {
      success: true,
      canchas: canchas.map(c => ({
        id: c.id,
        nombre: c.sedeCancha.nombre,
        sede: c.sedeCancha.sede.nombre,
      })),
    };
  }

  /**
   * Libera un slot (lo marca como LIBRE)
   */
  private async liberarSlot(
    torneoCanchaId: string,
    fecha: string,
    horaInicio: string,
  ): Promise<void> {
    await this.prisma.torneoSlot.updateMany({
      where: {
        torneoCanchaId,
        disponibilidad: {
          fecha: new Date(fecha + 'T00:00:00.000Z'),
        },
        horaInicio,
      },
      data: { estado: 'LIBRE' },
    });
  }

  /**
   * Ocupa un slot (lo marca como OCUPADO)
   */
  private async ocuparSlot(
    torneoCanchaId: string,
    fecha: string,
    horaInicio: string,
  ): Promise<void> {
    await this.prisma.torneoSlot.updateMany({
      where: {
        torneoCanchaId,
        disponibilidad: {
          fecha: new Date(fecha + 'T00:00:00.000Z'),
        },
        horaInicio,
      },
      data: { estado: 'OCUPADO' },
    });
  }

  /**
   * Calcula la hora de fin aproximada (1.5h después del inicio)
   */
  private calcularHoraFin(horaInicio: string): string {
    const [h, m] = horaInicio.split(':').map(Number);
    const totalMinutos = h * 60 + m + 90; // 90 minutos = 1.5 horas
    const horaFin = Math.floor(totalMinutos / 60);
    const minutosFin = totalMinutos % 60;
    return `${horaFin.toString().padStart(2, '0')}:${minutosFin.toString().padStart(2, '0')}`;
  }
}
