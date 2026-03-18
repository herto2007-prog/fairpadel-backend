import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DateService } from '../../common/services/date.service';

export interface SlotDisponible {
  id: string;
  fecha: string; // YYYY-MM-DD
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
  tipo: 'MISMA_PAREJA' | 'CANCHA_OCUPADA' | 'SIN_DISPONIBILIDAD' | 'SIN_FECHA_FINALES' | 'ADVERTENCIA';
  severidad: 'BLOQUEANTE' | 'ADVERTENCIA';
  partidoId: string;
  mensaje: string;
  sugerencia?: string;
  accion?: 'AGREGAR_DIAS' | 'EXTENDER_HORARIOS' | 'CONFIGURAR_FINALES' | 'ACEPTAR_RIESGO';
}

/**
 * Orden de fases para programación cronológica
 * Las fases más tempranas van primero (índice menor)
 */
const ORDEN_FASES: string[] = [
  'ZONA',
  'REPECHAJE',
  'TREINTAYDOSAVOS',
  'DIECISEISAVOS',
  'OCTAVOS',
  'CUARTOS',
  'SEMIS',
  'FINAL',
];

/**
 * Fases que deben ir obligatoriamente en fechaFinales
 */
const FASES_FINALES: string[] = ['SEMIS', 'FINAL'];

@Injectable()
export class ProgramacionService {
  constructor(
    private prisma: PrismaService,
    private dateService: DateService,
  ) {}

  /**
   * Calcula la programación inteligente para un torneo
   * 
   * REGLAS:
   * 1. Solo usa slots pre-configurados en tab Canchas
   * 2. SEMIS y FINAL SIEMPRE van en fechaFinales
   * 3. Distribución cronológica: ZONA → REPECHAJE → ... → SEMIS → FINAL
   * 4. Las categorías se mezclan (slots compartidos entre categorías)
   * 5. No se crean días nuevos, solo se usan los existentes
   */
  async calcularProgramacion(
    tournamentId: string,
    categoriasSorteadas: string[],
    fechaInicio?: string,
    canchasFinales?: string[],
    horaInicioFinales?: string,
  ): Promise<ResultadoProgramacion> {
    // 1. Validar categorías sorteadas
    if (!categoriasSorteadas?.length) {
      return {
        prediccion: {
          totalPartidos: 0,
          horasNecesarias: 0,
          slotsDisponibles: 0,
          deficit: 0,
          suficiente: false,
          sugerencias: ['No hay categorías sorteadas seleccionadas'],
        },
        distribucion: [],
        conflictos: [{
          tipo: 'SIN_DISPONIBILIDAD',
          severidad: 'BLOQUEANTE',
          partidoId: '',
          mensaje: 'No hay categorías sorteadas para programar',
          sugerencia: 'Primero sortea las categorías en el tab Fixture',
          accion: 'AGREGAR_DIAS',
        }],
      };
    }

    // 2. Obtener partidos de las categorías sorteadas
    const partidos = await this.obtenerPartidos(tournamentId, categoriasSorteadas);
    
    if (partidos.length === 0) {
      return {
        prediccion: {
          totalPartidos: 0,
          horasNecesarias: 0,
          slotsDisponibles: 0,
          deficit: 0,
          suficiente: false,
          sugerencias: ['Las categorías seleccionadas no tienen partidos'],
        },
        distribucion: [],
        conflictos: [{
          tipo: 'SIN_DISPONIBILIDAD',
          severidad: 'BLOQUEANTE',
          partidoId: '',
          mensaje: 'No hay partidos para programar en las categorías seleccionadas',
          sugerencia: 'Verifica que las categorías tengan fixture generado',
          accion: 'AGREGAR_DIAS',
        }],
      };
    }

    // 3. Obtener slots disponibles (pre-configurados en Canchas)
    const slots = await this.obtenerSlotsDisponibles(tournamentId);
    
    if (slots.length === 0) {
      return {
        prediccion: {
          totalPartidos: partidos.length,
          horasNecesarias: partidos.length * 1.5,
          slotsDisponibles: 0,
          deficit: partidos.length * 1.5,
          suficiente: false,
          sugerencias: ['Configura los días y horarios en el tab Canchas'],
        },
        distribucion: [],
        conflictos: [{
          tipo: 'SIN_DISPONIBILIDAD',
          severidad: 'BLOQUEANTE',
          partidoId: '',
          mensaje: 'No hay slots disponibles configurados',
          sugerencia: 'Ve al tab Canchas y configura los días/horarios del torneo',
          accion: 'AGREGAR_DIAS',
        }],
      };
    }

    // 4. Obtener fechaFinales del torneo
    const torneo = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { 
        fechaFinales: true,
        canchasFinales: true,
        horaInicioFinales: true,
      }
    });
    
    const fechaFinales = torneo?.fechaFinales ? 
      this.dateService.getDateOnly(torneo.fechaFinales) : undefined;
    
    // Usar canchasFinales del torneo si no se pasaron
    const canchasFinalesFinal = canchasFinales?.length ? canchasFinales : 
      (torneo?.canchasFinales as string[] || []);
    
    const horaInicioFinalesFinal = horaInicioFinales || torneo?.horaInicioFinales;

    // 5. Calcular predicción de recursos
    const prediccion = this.calcularPrediccion(partidos, slots);

    // 6. Validar que fechaFinales existe en slots disponibles (si tiene finales)
    const conflictos: Conflicto[] = [];
    const tieneFinales = partidos.some(p => FASES_FINALES.includes(p.fase));
    
    if (tieneFinales && fechaFinales) {
      const fechasDisponibles = [...new Set(slots.map(s => s.fecha))];
      if (!fechasDisponibles.includes(fechaFinales)) {
        conflictos.push({
          tipo: 'SIN_FECHA_FINALES',
          severidad: 'BLOQUEANTE',
          partidoId: '',
          mensaje: `La fecha de finales (${fechaFinales}) no está configurada en el tab Canchas`,
          sugerencia: `Configura disponibilidad para el ${fechaFinales} en el tab Canchas o cambia la fecha de finales`,
          accion: 'CONFIGURAR_FINALES',
        });
      }
    }

    // 7. Si hay conflictos bloqueantes, retornar temprano
    if (conflictos.some(c => c.severidad === 'BLOQUEANTE')) {
      return {
        prediccion,
        distribucion: [],
        conflictos,
      };
    }

    // 8. Distribuir partidos cronológicamente
    const distribucion = this.distribuirPartidosCronologicamente(
      partidos, 
      slots, 
      fechaInicio, 
      fechaFinales,
      canchasFinalesFinal,
      horaInicioFinalesFinal,
    );

    // 9. Validar conflictos adicionales
    const conflictosAdicionales = this.validarConflictos(distribucion, partidos);

    return {
      prediccion,
      distribucion,
      conflictos: [...conflictos, ...conflictosAdicionales],
    };
  }

  /**
   * Obtiene los partidos de las categorías sorteadas
   */
  private async obtenerPartidos(
    tournamentId: string,
    categoriasSorteadas: string[],
  ): Promise<PartidoProgramar[]> {
    // Obtener fixtureVersions de las categorías sorteadas
    const fixtureVersions = await this.prisma.fixtureVersion.findMany({
      where: {
        tournamentCategory: {
          tournamentId,
          categoryId: { in: categoriasSorteadas },
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

    if (fixtureVersions.length === 0) {
      return [];
    }

    const fixtureVersionIds = fixtureVersions.map(fv => fv.id);
    const fixtureVersionMap = new Map(fixtureVersions.map(fv => [fv.id, fv]));

    // Obtener partidos de esos fixtureVersions
    const partidos = await this.prisma.match.findMany({
      where: {
        tournamentId,
        fixtureVersionId: { in: fixtureVersionIds },
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

    return partidos.map(p => {
      const fv = fixtureVersionMap.get(p.fixtureVersionId);
      return {
        id: p.id,
        fase: p.ronda,
        orden: p.numeroRonda,
        categoriaId: fv?.tournamentCategory.category.id || '',
        categoriaNombre: fv?.tournamentCategory.category.nombre || 'Sin categoría',
        pareja1: p.inscripcion1 || undefined,
        pareja2: p.inscripcion2 || undefined,
        inscripcion1Id: p.inscripcion1Id || undefined,
        inscripcion2Id: p.inscripcion2Id || undefined,
      };
    });
  }

  /**
   * Obtiene los slots disponibles configurados en el tab Canchas
   * Solo retorna slots que realmente existen en la BD
   */
  private async obtenerSlotsDisponibles(tournamentId: string): Promise<SlotDisponible[]> {
    // Obtener disponibilidades del torneo
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

    // Obtener slots LIBRES de esas disponibilidades
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

    // Obtener canchas
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
          fecha: this.dateService.getDateOnly(disp.fecha),
          horaInicio: s.horaInicio,
          horaFin: s.horaFin,
          torneoCanchaId: s.torneoCanchaId,
          sedeNombre: cancha.sedeCancha.sede.nombre,
          canchaNombre: cancha.sedeCancha.nombre,
        };
      })
      .sort((a, b) => {
        // Ordenar por fecha, luego por hora
        if (a.fecha !== b.fecha) return a.fecha.localeCompare(b.fecha);
        return a.horaInicio.localeCompare(b.horaInicio);
      });
  }

  /**
   * Calcula la predicción de recursos necesarios
   */
  private calcularPrediccion(
    partidos: PartidoProgramar[],
    slots: SlotDisponible[],
  ): PrediccionRecursos {
    // Horas necesarias (1.5h por partido promedio)
    const horasNecesarias = partidos.length * 1.5;
    
    // Calcular horas disponibles
    const horasDisponibles = slots.reduce((total, slot) => {
      const inicio = this.parseHora(slot.horaInicio);
      const fin = this.parseHora(slot.horaFin);
      return total + (fin - inicio);
    }, 0);

    const deficit = Math.max(0, horasNecesarias - horasDisponibles);
    const suficiente = deficit <= 0;

    const sugerencias: string[] = [];
    if (!suficiente) {
      const slotsFaltantes = Math.ceil((horasNecesarias - horasDisponibles) / 1.5);
      sugerencias.push(`Necesitas ${slotsFaltantes} slots más (${Math.round(deficit)}h adicionales)`);
      sugerencias.push('Agrega más días o extiende los horarios en el tab Canchas');
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
   * Distribuye los partidos cronológicamente en los slots disponibles
   * 
   * ALGORITMO:
   * 1. Ordenar partidos por fase (ZONA primero, FINAL último)
   * 2. Para cada partido, encontrar el primer slot disponible que:
   *    - Sea en una fecha permitida para esa fase
   *    - No tenga conflicto de pareja (misma pareja en mismo día o <4h)
   * 3. Para SEMIS/FINAL: solo usar fechaFinales
   * 4. Para otras fases: usar cualquier fecha excepto fechaFinales (si tiene finales)
   */
  private distribuirPartidosCronologicamente(
    partidos: PartidoProgramar[],
    slots: SlotDisponible[],
    fechaInicio?: string,
    fechaFinales?: string,
    canchasFinales?: string[],
    horaInicioFinales?: string,
  ): DistribucionDia[] {
    // 1. Agrupar slots por fecha
    const slotsPorFecha = this.agruparSlotsPorFecha(slots);
    let fechasOrdenadas = Object.keys(slotsPorFecha).sort();

    // Filtrar desde fechaInicio si se especifica
    if (fechaInicio) {
      fechasOrdenadas = fechasOrdenadas.filter(f => f >= fechaInicio);
    }

    if (fechasOrdenadas.length === 0) {
      return [];
    }

    // 2. Ordenar partidos por fase (ZONA → REPECHAJE → ... → FINAL)
    const partidosOrdenados = [...partidos].sort((a, b) => {
      const ordenA = ORDEN_FASES.indexOf(a.fase);
      const ordenB = ORDEN_FASES.indexOf(b.fase);
      if (ordenA !== ordenB) return ordenA - ordenB;
      return a.orden - b.orden;
    });

    // 3. Separar fechas: finales vs otras
    const fechaFinalesReal = fechaFinales || fechasOrdenadas[fechasOrdenadas.length - 1];
    const fechasNoFinales = fechasOrdenadas.filter(f => f !== fechaFinalesReal);

    // 4. Asignar partidos
    const asignaciones: PartidoAsignado[] = [];
    const slotsAsignados = new Set<string>();

    for (const partido of partidosOrdenados) {
      const esFaseFinal = FASES_FINALES.includes(partido.fase);
      
      // Determinar fechas permitidas para esta fase
      let fechasPermitidas: string[];
      if (esFaseFinal) {
        // Fases finales SOLO en fechaFinales
        fechasPermitidas = [fechaFinalesReal];
      } else {
        // Otras fases en cualquier fecha EXCEPTO fechaFinales
        fechasPermitidas = fechasNoFinales.length > 0 ? fechasNoFinales : fechasOrdenadas;
      }

      // Determinar restricciones adicionales para finales
      const canchasPermitidas = esFaseFinal ? canchasFinales : undefined;
      const horaMinima = esFaseFinal ? horaInicioFinales : undefined;

      // Encontrar slot
      const asignacion = this.encontrarSlotOptimo(
        partido,
        fechasPermitidas,
        slotsPorFecha,
        slotsAsignados,
        asignaciones,
        canchasPermitidas,
        horaMinima,
      );

      if (asignacion) {
        asignaciones.push(asignacion);
        slotsAsignados.add(`${asignacion.fecha}-${asignacion.torneoCanchaId}-${asignacion.horaInicio}`);
      }
    }

    // 5. Construir distribución final
    return this.construirDistribucion(asignaciones, slotsPorFecha, fechasOrdenadas);
  }

  /**
   * Encuentra el mejor slot disponible para un partido
   * Prioriza: evitar conflictos de pareja > usar primer slot disponible
   */
  private encontrarSlotOptimo(
    partido: PartidoProgramar,
    fechasPermitidas: string[],
    slotsPorFecha: Record<string, SlotDisponible[]>,
    slotsAsignados: Set<string>,
    asignacionesExistentes: PartidoAsignado[],
    canchasPermitidas?: string[],
    horaMinima?: string,
  ): PartidoAsignado | null {
    // Recopilar info de parejas para este partido
    const parejaIds = [partido.inscripcion1Id, partido.inscripcion2Id].filter(Boolean);

    for (const fecha of fechasPermitidas) {
      let slotsDelDia = slotsPorFecha[fecha] || [];

      // Filtrar por canchas permitidas (para finales)
      if (canchasPermitidas?.length) {
        slotsDelDia = slotsDelDia.filter(s => canchasPermitidas.includes(s.torneoCanchaId));
      }

      // Filtrar por hora mínima (para finales)
      if (horaMinima) {
        slotsDelDia = slotsDelDia.filter(s => s.horaInicio >= horaMinima);
      }

      for (const slot of slotsDelDia) {
        const slotKey = `${fecha}-${slot.torneoCanchaId}-${slot.horaInicio}`;

        // Verificar si el slot ya está asignado
        if (slotsAsignados.has(slotKey)) continue;

        // Verificar conflictos de pareja
        if (this.tieneConflictoPareja(parejaIds, fecha, slot.horaInicio, asignacionesExistentes)) {
          continue;
        }

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
          pareja1: partido.pareja1 ? 
            `${partido.pareja1.jugador1.nombre}/${partido.pareja1.jugador2?.nombre || '?'}` : 
            undefined,
          pareja2: partido.pareja2 ? 
            `${partido.pareja2.jugador1.nombre}/${partido.pareja2.jugador2?.nombre || '?'}` : 
            undefined,
        };
      }
    }

    return null;
  }

  /**
   * Verifica si hay conflicto de pareja
   * Conflictos:
   * - Misma pareja ya juega ese día (máx 2 partidos por día)
   * - Misma pareja juega con <4h de descanso
   */
  private tieneConflictoPareja(
    parejaIds: (string | undefined)[],
    fecha: string,
    horaInicio: string,
    asignacionesExistentes: PartidoAsignado[],
  ): boolean {
    const horaSlot = this.parseHora(horaInicio);

    for (const parejaId of parejaIds) {
      if (!parejaId) continue;

      // Partidos de esta pareja en la misma fecha
      const partidosMismaFecha = asignacionesExistentes.filter(a => 
        a.fecha === fecha && (a.pareja1?.includes(parejaId) || a.pareja2?.includes(parejaId))
      );

      // Máximo 2 partidos por día por pareja
      if (partidosMismaFecha.length >= 2) {
        return true;
      }

      // Verificar 4h de descanso
      const conflictoHorario = partidosMismaFecha.some(p => {
        const horaPartido = this.parseHora(p.horaInicio);
        return Math.abs(horaSlot - horaPartido) < 4;
      });

      if (conflictoHorario) {
        return true;
      }
    }

    return false;
  }

  /**
   * Construye la distribución final agrupada por día
   */
  private construirDistribucion(
    asignaciones: PartidoAsignado[],
    slotsPorFecha: Record<string, SlotDisponible[]>,
    fechasOrdenadas: string[],
  ): DistribucionDia[] {
    const asignacionesPorFecha = this.agruparAsignacionesPorFecha(asignaciones);
    const distribucion: DistribucionDia[] = [];

    for (const fecha of fechasOrdenadas) {
      const partidosDelDia = asignacionesPorFecha[fecha];
      if (!partidosDelDia?.length) continue;

      const diaSlots = slotsPorFecha[fecha] || [];
      const horasInicio = diaSlots.map(s => s.horaInicio).sort();
      const horasFin = diaSlots.map(s => s.horaFin).sort();

      distribucion.push({
        fecha,
        diaSemana: this.getDiaSemana(fecha),
        horarioInicio: horasInicio[0] || '18:00',
        horarioFin: horasFin[horasFin.length - 1] || '23:00',
        slotsDisponibles: diaSlots.length,
        slotsAsignados: partidosDelDia.length,
        partidos: partidosDelDia.sort((a, b) => a.horaInicio.localeCompare(b.horaInicio)),
      });
    }

    return distribucion;
  }

  /**
   * Valida conflictos y advertencias en la distribución
   */
  private validarConflictos(
    distribucion: DistribucionDia[],
    partidosOriginales?: PartidoProgramar[],
  ): Conflicto[] {
    const conflictos: Conflicto[] = [];
    const totalAsignados = distribucion.reduce((sum, d) => sum + d.partidos.length, 0);
    const totalEsperados = partidosOriginales?.length || 0;

    // Verificar si faltan partidos por asignar
    if (totalEsperados > 0 && totalAsignados < totalEsperados) {
      conflictos.push({
        tipo: 'SIN_DISPONIBILIDAD',
        severidad: 'BLOQUEANTE',
        partidoId: '',
        mensaje: `Solo se pudieron asignar ${totalAsignados} de ${totalEsperados} partidos`,
        sugerencia: 'Agrega más días o extiende los horarios en el tab Canchas',
        accion: 'AGREGAR_DIAS',
      });
    }

    // Revisar días saturados
    for (const dia of distribucion) {
      const porcentajeOcupado = (dia.slotsAsignados / dia.slotsDisponibles) * 100;
      
      if (porcentajeOcupado >= 100) {
        conflictos.push({
          tipo: 'ADVERTENCIA',
          severidad: 'ADVERTENCIA',
          partidoId: '',
          mensaje: `El día ${dia.fecha} está completamente saturado (${dia.slotsAsignados}/${dia.slotsDisponibles} slots)`,
          sugerencia: 'Considera agregar otro día de disponibilidad',
          accion: 'AGREGAR_DIAS',
        });
      } else if (porcentajeOcupado >= 90) {
        conflictos.push({
          tipo: 'ADVERTENCIA',
          severidad: 'ADVERTENCIA',
          partidoId: '',
          mensaje: `El día ${dia.fecha} está casi saturado (${Math.round(porcentajeOcupado)}%)`,
          sugerencia: 'El día tiene poco margen para retrasos o cambios',
          accion: 'ACEPTAR_RIESGO',
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
      // Actualizar el partido
      await this.prisma.match.update({
        where: { id: asignacion.partidoId },
        data: {
          fechaProgramada: new Date(asignacion.fecha + 'T03:00:00.000Z'),
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
            fecha: new Date(asignacion.fecha + 'T03:00:00.000Z'),
          },
          horaInicio: asignacion.horaInicio,
        },
        data: { estado: 'OCUPADO' },
      });
    }
  }

  /**
   * Actualiza la programación de un partido específico (modo híbrido)
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
        this.dateService.getDateOnly(partido.fechaProgramada),
        partido.horaProgramada,
      );
    }

    // Actualizar el partido
    await this.prisma.match.update({
      where: { id: partidoId },
      data: {
        fechaProgramada: new Date(fecha + 'T03:00:00.000Z'),
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
        this.dateService.getDateOnly(partido.fechaProgramada),
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

  // ═══════════════════════════════════════════════════════════
  // MÉTODOS AUXILIARES
  // ═══════════════════════════════════════════════════════════

  private agruparSlotsPorFecha(slots: SlotDisponible[]): Record<string, SlotDisponible[]> {
    const agrupado: Record<string, SlotDisponible[]> = {};
    for (const slot of slots) {
      if (!agrupado[slot.fecha]) {
        agrupado[slot.fecha] = [];
      }
      agrupado[slot.fecha].push(slot);
    }
    // Ordenar slots dentro de cada fecha por hora
    for (const fecha of Object.keys(agrupado)) {
      agrupado[fecha].sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
    }
    return agrupado;
  }

  private agruparAsignacionesPorFecha(asignaciones: PartidoAsignado[]): Record<string, PartidoAsignado[]> {
    const agrupado: Record<string, PartidoAsignado[]> = {};
    for (const a of asignaciones) {
      if (!agrupado[a.fecha]) {
        agrupado[a.fecha] = [];
      }
      agrupado[a.fecha].push(a);
    }
    return agrupado;
  }

  private parseHora(hora: string): number {
    const [h, m] = hora.split(':').map(Number);
    return h + m / 60;
  }

  private getDiaSemana(fecha: string): string {
    const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const date = new Date(fecha + 'T12:00:00-03:00'); // Mediodía Paraguay
    return dias[date.getDay()];
  }

  private async liberarSlot(
    torneoCanchaId: string,
    fecha: string,
    horaInicio: string,
  ): Promise<void> {
    await this.prisma.torneoSlot.updateMany({
      where: {
        torneoCanchaId,
        disponibilidad: {
          fecha: new Date(fecha + 'T03:00:00.000Z'),
        },
        horaInicio,
      },
      data: { estado: 'LIBRE' },
    });
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
          fecha: new Date(fecha + 'T03:00:00.000Z'),
        },
        horaInicio,
      },
      data: { estado: 'OCUPADO' },
    });
  }
}
