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
  tipo: 'MISMA_PAREJA' | 'CANCHA_OCUPADA' | 'SIN_DISPONIBILIDAD' | 'ADVERTENCIA';
  severidad: 'BLOQUEANTE' | 'ADVERTENCIA';
  partidoId: string;
  mensaje: string;
  sugerencia?: string;
  accion?: 'AGREGAR_DIAS' | 'EXTENDER_HORARIOS' | 'REDUCIR_PARTIDOS_DIA' | 'ACEPTAR_RIESGO';
}

/**
 * Orden de fases para programación
 * Las fases más tempranas van primero
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
 * Fases que deben ir obligatoriamente en los últimos días
 */
const FASES_FINALES: string[] = ['SEMIS', 'FINAL'];

/**
 * Fases que pueden compartir días entre sí pero deben ir después de las fases iniciales
 */
const FASES_INTERMEDIAS: string[] = ['CUARTOS'];

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
    canchasFinales?: string[],
    horaInicioFinales?: string,
  ): Promise<ResultadoProgramacion> {
    // 1. Obtener partidos de las categorías sorteadas
    const partidos = await this.obtenerPartidos(tournamentId, categoriasSorteadas);
    
    // 2. Obtener slots disponibles
    const slots = await this.obtenerSlotsDisponibles(tournamentId);
    
    // 3. Obtener fechaFinales del torneo
    const torneo = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      // @ts-ignore - fechaFinales fue agregado al schema
      select: { fechaFinales: true }
    });
    // @ts-ignore
    const fechaFinales = torneo?.fechaFinales ? torneo.fechaFinales.toISOString().split('T')[0] : undefined;
    
    // 4. Calcular predicción de recursos
    const prediccion = this.calcularPrediccion(partidos, slots);
    
    // 5. Si no hay suficientes recursos, retornar temprano
    if (!prediccion.suficiente) {
      return {
        prediccion,
        distribucion: [],
        conflictos: [{
          tipo: 'SIN_DISPONIBILIDAD',
          severidad: 'BLOQUEANTE',
          partidoId: '',
          mensaje: 'No hay suficientes slots disponibles para programar todos los partidos',
          sugerencia: 'Agrega más días de disponibilidad o más canchas',
          accion: 'AGREGAR_DIAS',
        }],
      };
    }

    // 6. Distribuir partidos con orden cronológico garantizado
    const distribucion = await this.distribuirPartidosPorFases(
      partidos, 
      slots, 
      fechaInicio, 
      fechaFinales,
      canchasFinales,
      horaInicioFinales,
    );
    
    // 7. Validar conflictos
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
   * Distribuye los partidos en los slots disponibles usando lógica "de atrás para adelante"
   * estilo Paraguay: Finales en último día, distribución de fases intermedias hacia atrás
   * 
   * Ejemplo 4 días con bracket 16: ZONA → 16vos+REPECHAJE → 8vos+4tos → SEMIS+FINAL
   * Ejemplo 5 días: ZONA → REPECHAJE → 16vos+8vos → 4tos → SEMIS+FINAL
   */
  private async distribuirPartidosPorFases(
    partidos: PartidoProgramar[],
    slots: SlotDisponible[],
    fechaInicio?: string,
    fechaFinales?: string,
    canchasFinales?: string[],
    horaInicioFinales?: string,
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

    // 2. Separar partidos por fase (solo las que tienen partidos)
    const partidosPorFase: Record<string, PartidoProgramar[]> = {};
    ORDEN_FASES.forEach(fase => {
      const partidosFase = partidos.filter(p => p.fase === fase);
      if (partidosFase.length > 0) {
        partidosPorFase[fase] = partidosFase;
      }
    });

    // 3. Identificar qué fases existen en el torneo
    const fasesExistentes = ORDEN_FASES.filter(f => partidosPorFase[f]?.length > 0);
    const tieneZona = fasesExistentes.includes('ZONA');
    const tieneFinales = FASES_FINALES.some(f => fasesExistentes.includes(f));
    
    // 4. Si hay fechaFinales configurada, usarla como ancla
    let fechaFinalesReal: string | undefined;
    if (fechaFinales && fechasOrdenadas.includes(fechaFinales)) {
      fechaFinalesReal = fechaFinales;
    } else if (tieneFinales) {
      // Si no hay fechaFinales específica, usar el último día
      fechaFinalesReal = fechasOrdenadas[fechasOrdenadas.length - 1];
    }
    
    // 5. Calcular distribución de fases por día respetando fechaFinales
    const distribucionFasesPorDia = this.calcularDistribucionFases(
      fasesExistentes, 
      fechasOrdenadas.length,
      fechasOrdenadas,
      fechaFinalesReal
    );

    // 6. Asignar días a cada grupo de fases
    const asignacionDias: Record<string, string[]> = {};
    
    for (const grupo of distribucionFasesPorDia) {
      for (const fase of grupo.fases) {
        asignacionDias[fase] = grupo.fechas;
      }
    }

    // 6. Distribuir partidos
    const distribucion: DistribucionDia[] = [];
    const slotsAsignados = new Set<string>();
    const asignaciones: PartidoAsignado[] = [];

    for (const fase of fasesExistentes) {
      const fechasFase = asignacionDias[fase] || [];
      
      // Para finales: usar canchas y hora específicas
      const esFaseFinal = FASES_FINALES.includes(fase as any);
      const canchasPermitidas = esFaseFinal && canchasFinales?.length > 0 
        ? canchasFinales 
        : undefined;
      const horaMinima = esFaseFinal && horaInicioFinales 
        ? horaInicioFinales 
        : undefined;
      
      for (const partido of partidosPorFase[fase]) {
        const asignacion = this.encontrarSlotEnRango(
          partido,
          fechasFase,
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
    }

    // 7. Construir distribución final en orden cronológico
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
   * Calcula la distribución de fases por día usando lógica "de atrás para adelante"
   * con fechaFinales como ancla obligatoria
   * 
   * Las fases finales (SEMIS, FINAL) SIEMPRE van en fechaFinales
   * Las demás fases se distribuyen hacia atrás desde esa fecha
   */
  private calcularDistribucionFases(
    fasesExistentes: readonly string[],
    totalDias: number,
    fechasOrdenadas: string[],
    fechaFinales?: string,
  ): { fases: string[]; fechas: string[] }[] {
    // Separar fases en grupos
    const faseZona = fasesExistentes.includes('ZONA') ? ['ZONA'] : [];
    const fasesFinales = FASES_FINALES.filter(f => fasesExistentes.includes(f));
    const fasesMedias = fasesExistentes.filter(f => 
      f !== 'ZONA' && !(FASES_FINALES as readonly string[]).includes(f)
    );

    const distribucion: { fases: string[]; fechas: string[] }[] = [];

    // Encontrar el índice de fechaFinales en fechasOrdenadas
    let indiceFinales = fechaFinales ? fechasOrdenadas.indexOf(fechaFinales) : fechasOrdenadas.length - 1;
    if (indiceFinales === -1) {
      // Si no se encuentra, usar el último día
      indiceFinales = fechasOrdenadas.length - 1;
    }

    // Días disponibles antes de las finales
    const diasAntesFinales = indiceFinales;
    const diasParaMedias = diasAntesFinales;

    // Distribuir fases medias de atrás para adelante (antes de las finales)
    if (fasesMedias.length > 0 && diasParaMedias > 0) {
      const gruposDeDos = Math.floor(fasesMedias.length / 2);
      const sobranFases = fasesMedias.length % 2;
      const totalGruposNecesarios = gruposDeDos + (sobranFases > 0 ? 1 : 0);
      
      // Calcular cuántos días usar para fases medias
      const diasUsar = Math.min(diasParaMedias, totalGruposNecesarios + Math.max(0, fasesMedias.length - diasParaMedias));

      // Crear grupos desde el final (cerca de las finales)
      let indiceFase = fasesMedias.length - 1;
      const gruposMedios: string[][] = [];
      
      // Primero los grupos de 2 (desde el final - más cerca de finales)
      for (let i = 0; i < gruposDeDos && indiceFase >= 1; i++) {
        const fase1 = fasesMedias[indiceFase];
        const fase2 = fasesMedias[indiceFase - 1];
        gruposMedios.unshift([fase2, fase1]);
        indiceFase -= 2;
      }

      // Si sobra 1 fase
      if (sobranFases > 0 && indiceFase >= 0) {
        gruposMedios.unshift([fasesMedias[indiceFase]]);
        indiceFase--;
      }

      // Distribuir grupos en los días antes de las finales
      const diasParaAsignar = Math.min(gruposMedios.length, diasParaMedias);
      for (let i = 0; i < diasParaAsignar; i++) {
        const fechaIndex = diasAntesFinales - diasParaAsignar + i;
        if (fechaIndex >= 0 && fechaIndex < fechasOrdenadas.length) {
          distribucion.push({
            fases: gruposMedios[i],
            fechas: [fechasOrdenadas[fechaIndex]]
          });
        }
      }
    }

    // Día de ZONA (si existe) - siempre al inicio
    if (faseZona.length > 0) {
      // Buscar el primer día disponible antes de las fases medias
      let fechaZona = fechasOrdenadas[0];
      // Si hay espacio, usar el primer día; si no, usar el día más temprano posible
      distribucion.unshift({
        fases: faseZona,
        fechas: [fechaZona]
      });
    }

    // Día de FINALES (obligatoriamente en fechaFinales)
    if (fasesFinales.length > 0) {
      distribucion.push({
        fases: fasesFinales,
        fechas: [fechasOrdenadas[indiceFinales]]
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
    canchasPermitidas?: string[],
    horaMinima?: string,
  ): PartidoAsignado | null {
    for (const fecha of fechas) {
      let slotsDelDia = slotsPorFecha[fecha] || [];
      
      // Filtrar por canchas permitidas (para finales)
      if (canchasPermitidas && canchasPermitidas.length > 0) {
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
   * Valida conflictos y advertencias en la distribución
   * 
   * BLOQUEANTE: Impide aplicar la programación
   * ADVERTENCIA: Informa al usuario pero permite aplicar con confirmación
   */
  private validarConflictos(distribucion: DistribucionDia[]): Conflicto[] {
    const conflictos: Conflicto[] = [];
    
    // Revisar si hay días con muchos partidos (>90% ocupado)
    for (const dia of distribucion) {
      const porcentajeOcupado = (dia.slotsAsignados / dia.slotsDisponibles) * 100;
      
      if (porcentajeOcupado >= 100) {
        // Día 100% saturado - ADVERTENCIA (no bloqueante, pero riesgoso)
        conflictos.push({
          tipo: 'ADVERTENCIA',
          severidad: 'ADVERTENCIA',
          partidoId: '',
          mensaje: `El día ${dia.fecha} está completamente saturado (${dia.slotsAsignados}/${dia.slotsDisponibles} slots)`,
          sugerencia: 'Considera agregar otro día de disponibilidad o extender el horario',
          accion: 'AGREGAR_DIAS',
        });
      } else if (porcentajeOcupado >= 90) {
        // Día casi saturado - ADVERTENCIA
        conflictos.push({
          tipo: 'ADVERTENCIA',
          severidad: 'ADVERTENCIA',
          partidoId: '',
          mensaje: `El día ${dia.fecha} está casi saturado (${dia.slotsAsignados}/${dia.slotsDisponibles} slots, ${Math.round(porcentajeOcupado)}%)`,
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
