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
  logs?: LogAsignacion[];
}

export interface Conflicto {
  tipo: 'MISMA_PAREJA' | 'CANCHA_OCUPADA' | 'SIN_DISPONIBILIDAD' | 'SIN_FECHA_FINALES' | 'ADVERTENCIA' | 'INFO';
  severidad: 'BLOQUEANTE' | 'ADVERTENCIA' | 'INFO';
  partidoId: string;
  mensaje: string;
  sugerencia?: string;
  accion?: 'AGREGAR_DIAS' | 'EXTENDER_HORARIOS' | 'CONFIGURAR_FINALES' | 'ACEPTAR_RIESGO';
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
    horaFinFinales?: string,
  ): Promise<ResultadoProgramacion> {
    console.log('[Programacion] ===== INICIAR CÁLCULO =====');
    console.log('[Programacion] tournamentId:', tournamentId);
    console.log('[Programacion] categoriasSorteadas:', categoriasSorteadas);
    
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
    const todosLosPartidos = await this.obtenerPartidos(tournamentId, categoriasSorteadas);
    
    // FILTRAR: Solo programar partidos con AMBAS parejas definidas
    // Los partidos "Por definir" vs "Por definir" no se pueden jugar todavía
    const partidos = todosLosPartidos.filter(p => {
      const tienePareja1 = p.inscripcion1Id && p.pareja1;
      const tienePareja2 = p.inscripcion2Id && p.pareja2;
      return tienePareja1 && tienePareja2;
    });
    
    const partidosPorDefinir = todosLosPartidos.length - partidos.length;
    if (partidosPorDefinir > 0) {
      console.log(`[Programacion] ${partidosPorDefinir} partidos excluidos (Por definir vs Por definir)`);
    }
    
    if (partidos.length === 0) {
      const mensaje = partidosPorDefinir > 0 
        ? `Hay ${partidosPorDefinir} partidos "Por definir" (pendientes de resultados previos)`
        : 'Las categorías seleccionadas no tienen partidos';
      
      return {
        prediccion: {
          totalPartidos: 0,
          horasNecesarias: 0,
          slotsDisponibles: 0,
          deficit: 0,
          suficiente: false,
          sugerencias: partidosPorDefinir > 0 
            ? [`${partidosPorDefinir} partidos esperan resultados de rondas previas`]
            : ['Las categorías seleccionadas no tienen partidos'],
        },
        distribucion: [],
        conflictos: [{
          tipo: 'SIN_DISPONIBILIDAD',
          severidad: 'BLOQUEANTE',
          partidoId: '',
          mensaje,
          sugerencia: partidosPorDefinir > 0 
            ? 'Juega las rondas previas primero para definir las parejas'
            : 'Verifica que las categorías tengan fixture generado',
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
        // @ts-ignore - campo nuevo pendiente de migración
        horaFinFinales: true,
      }
    });
    
    // FIX: fechaFinales es String YYYY-MM-DD directamente
    const fechaFinales = torneo?.fechaFinales || undefined;
    
    // Usar canchasFinales del torneo si no se pasaron
    const canchasFinalesFinal = canchasFinales?.length ? canchasFinales : 
      (torneo?.canchasFinales as string[] || []);
    
    const horaInicioFinalesFinal = horaInicioFinales || torneo?.horaInicioFinales;
    // @ts-ignore - campo nuevo pendiente de migración
    const horaFinFinalesFinal = horaFinFinales || torneo?.horaFinFinales || '23:00';

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

    // Obtener tournamentCategories para ordenar finales por categoría
    const categoriasUnicas = [...new Set(categoriasSorteadas)];
    const tournamentCategories = await this.prisma.tournamentCategory.findMany({
      where: {
        id: { in: categoriasUnicas },
        tournamentId,
      },
      select: { id: true, categoryId: true },
    });

    // Array para logs de asignación
    const logs: LogAsignacion[] = [];

    // 8. Distribuir partidos cronológicamente
    const distribucion = await this.distribuirPartidosCronologicamente(
      partidos, 
      slots, 
      fechaInicio, 
      fechaFinales,
      canchasFinalesFinal,
      horaInicioFinalesFinal,
      horaFinFinalesFinal,
      tournamentCategories,
      logs,
    );

    // 9. Validar conflictos adicionales
    const conflictosAdicionales = this.validarConflictos(distribucion, partidos);

    // Agregar info sobre partidos por definir como advertencia informativa
    const conflictosFinales = [...conflictos, ...conflictosAdicionales];
    if (partidosPorDefinir > 0) {
      conflictosFinales.push({
        tipo: 'INFO',
        severidad: 'ADVERTENCIA',
        partidoId: '',
        mensaje: `${partidosPorDefinir} partidos "Por definir" no programados (pendientes de resultados)`,
        sugerencia: 'Estos partidos se programarán automáticamente cuando las parejas estén definidas',
      });
    }
    
    const resultado: ResultadoProgramacion = {
      prediccion,
      distribucion,
      conflictos: conflictosFinales,
      logs: logs.length > 0 ? logs : undefined,
    };
    
    console.log('[Programacion] ===== CÁLCULO COMPLETADO =====');
    console.log('[Programacion] Total partidos:', resultado.prediccion.totalPartidos);
    console.log('[Programacion] Distribución días:', resultado.distribucion.length);
    console.log('[Programacion] Logs generados:', logs.length);
    
    return resultado;
  }

  /**
   * Obtiene los partidos de las categorías sorteadas
   */
  private async obtenerPartidos(
    tournamentId: string,
    categoriasSorteadas: string[],
  ): Promise<PartidoProgramar[]> {
    console.log('[Programacion] Buscando partidos para tournamentId:', tournamentId);
    console.log('[Programacion] categoriasSorteadas:', categoriasSorteadas);

    // Eliminar duplicados
    const categoriasUnicas = [...new Set(categoriasSorteadas)];
    console.log('[Programacion] categoriasUnicas (TournamentCategory IDs):', categoriasUnicas);

    // PASO 1: Obtener los categoryId reales de los TournamentCategory
    const tournamentCategories = await this.prisma.tournamentCategory.findMany({
      where: {
        id: { in: categoriasUnicas },
        tournamentId,
      },
      select: { id: true, categoryId: true },
    });

    console.log('[Programacion] tournamentCategories encontradas:', tournamentCategories);

    const categoryIdsReales = tournamentCategories.map(tc => tc.categoryId);
    console.log('[Programacion] categoryIdsReales:', categoryIdsReales);

    if (categoryIdsReales.length === 0) {
      return [];
    }

    // PASO 2: Obtener fixtureVersions por los categoryId reales
    const fixtureVersions = await this.prisma.fixtureVersion.findMany({
      where: {
        tournamentId,
        categoryId: { in: categoryIdsReales },
      },
    });

    console.log('[Programacion] fixtureVersions encontrados:', fixtureVersions.length);
    
    // DEBUG: Ver todos los fixtureVersions del torneo
    const todosLosFixtureVersions = await this.prisma.fixtureVersion.findMany({
      where: { tournamentId },
      select: { id: true, categoryId: true, version: true },
    });
    console.log('[Programacion] TODOS los fixtureVersions del torneo:', todosLosFixtureVersions);
    if (fixtureVersions.length > 0) {
      console.log('[Programacion] IDs de fixtureVersions:', fixtureVersions.map(fv => fv.id));
    }

    if (fixtureVersions.length === 0) {
      return [];
    }

    const fixtureVersionIds = fixtureVersions.map(fv => fv.id);
    
    // Map de categoryId para obtener nombres
    // Crear map de categoryId -> nombre
    const categoryIdToNombre = new Map<string, string>();
    for (const tc of tournamentCategories) {
      const categoria = await this.prisma.category.findUnique({
        where: { id: tc.categoryId },
        select: { nombre: true },
      });
      if (categoria) {
        categoryIdToNombre.set(tc.categoryId, categoria.nombre);
      }
    }
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

    console.log('[Programacion] Partidos encontrados:', partidos.length);

    return partidos.map(p => {
      const fv = fixtureVersionMap.get(p.fixtureVersionId);
      const categoryId = fv?.categoryId || '';
      return {
        id: p.id,
        fase: p.ronda,
        orden: p.numeroRonda,
        categoriaId: categoryId,
        categoriaNombre: categoryIdToNombre.get(categoryId) || 'Sin categoría',
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
  private async distribuirPartidosCronologicamente(
    partidos: PartidoProgramar[],
    slots: SlotDisponible[],
    fechaInicio?: string,
    fechaFinales?: string,
    canchasFinales?: string[],
    horaInicioFinales?: string,
    horaFinFinales?: string,
    tournamentCategories?: { id: string; categoryId: string }[],
    logs?: LogAsignacion[],
  ): Promise<DistribucionDia[]> {
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

    // 2. Separar fechas: finales vs otras
    const fechaFinalesReal = fechaFinales || fechasOrdenadas[fechasOrdenadas.length - 1];
    const fechasNoFinales = fechasOrdenadas.filter(f => f !== fechaFinalesReal);

    // 3. Obtener orden de categorías para ordenar finales (8ª → 1ª)
    const ordenCategorias = await this.obtenerOrdenCategorias(tournamentCategories);

    // 4. Separar partidos por fases (lógica simple y clara)
    // FASES INICIALES: ZONA + REPECHAJE → primeros días (distribución balanceada)
    // FASES INTERMEDIAS: TREINTAYDOSAVOS + DIECISEISAVOS + OCTAVOS + CUARTOS → penúltimo día
    // FASES FINALES: SEMIS + FINAL → último día (fechaFinales)
    
    const partidosFinales = partidos.filter(p => FASES_FINALES.includes(p.fase));
    const partidosPreFinales = partidos.filter(p => 
      ['CUARTOS', 'OCTAVOS', 'DIECISEISAVOS', 'TREINTAYDOSAVOS'].includes(p.fase)
    );
    const partidosIniciales = partidos.filter(p => 
      ['ZONA', 'REPECHAJE'].includes(p.fase)
    );

    // 5. Asignar fechas
    // - Primeros días (todos excepto los últimos 2): ZONA + REPECHAJE
    // - Penúltimo día: OCTAVOS + CUARTOS (y 16avos/32avos si existen)
    // - Último día: SEMIS + FINAL
    
    const totalDiasNoFinales = fechasNoFinales.length;
    
    // Si tenemos 3+ días: ZONA ocupa todos menos los últimos 2
    // Si tenemos 2 días: ZONA ocupa el primero, OCTAVOS/CUARTOS el segundo
    // Si tenemos 1 día: todo va junto (caso edge)
    
    let fechasZona: string[] = [];
    let fechaIntermedia: string | null = null;
    
    if (totalDiasNoFinales >= 3) {
      // Caso ideal: Jueves/Viernes = ZONA, Sábado = OCTAVOS/CUARTOS, Domingo = FINALES
      fechasZona = fechasNoFinales.slice(0, totalDiasNoFinales - 1); // Todos menos el penúltimo
      fechaIntermedia = fechasNoFinales[totalDiasNoFinales - 1]; // Penúltimo día
    } else if (totalDiasNoFinales === 2) {
      // Caso justo: Primer día = ZONA, Segundo día = OCTAVOS/CUARTOS
      fechasZona = [fechasNoFinales[0]];
      fechaIntermedia = fechasNoFinales[1];
    } else if (totalDiasNoFinales === 1) {
      // Caso mínimo: Todo junto
      fechasZona = [fechasNoFinales[0]];
      fechaIntermedia = fechasNoFinales[0];
    }

    if (logs) {
      logs.push({
        tipo: 'INFO' as any,
        partidoId: '',
        categoriaNombre: '',
        fase: '',
        fecha: '',
        hora: '',
        mensaje: `Estrategia: ZONA/REPECHAJE=${fechasZona.length}d, OCTAVOS-CUARTOS=1d (${fechaIntermedia}), FINALES=1d (${fechaFinalesReal})`,
      });
    }

    // 6. Ordenar partidos
    const ordenarPorFase = (a: PartidoProgramar, b: PartidoProgramar) => {
      const ordenA = ORDEN_FASES.indexOf(a.fase);
      const ordenB = ORDEN_FASES.indexOf(b.fase);
      if (ordenA !== ordenB) return ordenA - ordenB;
      return a.orden - b.orden;
    };

    const partidosInicialesOrdenados = [...partidosIniciales].sort(ordenarPorFase);
    const partidosPreFinalesOrdenados = [...partidosPreFinales].sort(ordenarPorFase);

    // Ordenar finales: SEMIS primero, luego FINAL, categorías bajas primero
    const partidosFinalesOrdenados = [...partidosFinales].sort((a, b) => {
      const ordenFaseA = ORDEN_FASES.indexOf(a.fase);
      const ordenFaseB = ORDEN_FASES.indexOf(b.fase);
      if (ordenFaseA !== ordenFaseB) return ordenFaseA - ordenFaseB;
      const ordenCatA = ordenCategorias.get(a.categoriaId) || 999;
      const ordenCatB = ordenCategorias.get(b.categoriaId) || 999;
      return ordenCatA - ordenCatB;
    });

    // 7. Asignar partidos
    const asignaciones: PartidoAsignado[] = [];
    const slotsAsignados = new Set<string>();

    // 7.1 ZONA + REPECHAJE en primeros días (con distribución balanceada)
    if (partidosInicialesOrdenados.length > 0 && fechasZona.length > 0) {
      if (logs) {
        logs.push({
          tipo: 'INFO' as any,
          partidoId: '',
          categoriaNombre: '',
          fase: '',
          fecha: fechasZona[0],
          hora: '',
          mensaje: `Fase 1: Asignando ${partidosInicialesOrdenados.length} partidos ZONA/REPECHAJE a ${fechasZona.length} días`,
        });
      }
      this.asignarPartidosBalanceado(
        partidosInicialesOrdenados,
        fechasZona,
        slotsPorFecha,
        slotsAsignados,
        asignaciones,
        logs,
      );
    }

    // 7.2 OCTAVOS + CUARTOS (y 16avos/32avos) en el día intermedio
    if (partidosPreFinalesOrdenados.length > 0 && fechaIntermedia) {
      if (logs) {
        logs.push({
          tipo: 'INFO' as any,
          partidoId: '',
          categoriaNombre: '',
          fase: '',
          fecha: fechaIntermedia,
          hora: '',
          mensaje: `Fase 2: Asignando ${partidosPreFinalesOrdenados.length} partidos OCTAVOS/CUARTOS al día ${fechaIntermedia}`,
        });
      }
      // Para fases de eliminación directa, usamos asignación simple (todos caben en un día)
      for (const partido of partidosPreFinalesOrdenados) {
        const asignacion = this.encontrarSlotOptimo(
          partido,
          [fechaIntermedia],
          slotsPorFecha,
          slotsAsignados,
          asignaciones,
          undefined,
          undefined,
          undefined,
          logs,
        );

        if (asignacion) {
          asignaciones.push(asignacion);
          slotsAsignados.add(`${asignacion.fecha}-${asignacion.torneoCanchaId}-${asignacion.horaInicio}`);
        }
      }
    }

    // 7.4 Finales en fechaFinales
    if (partidosFinalesOrdenados.length > 0) {
      for (const partido of partidosFinalesOrdenados) {
        const asignacion = this.encontrarSlotOptimo(
          partido,
          [fechaFinalesReal],
          slotsPorFecha,
          slotsAsignados,
          asignaciones,
          canchasFinales,
          horaInicioFinales,
          horaFinFinales,
          logs,
        );

        if (asignacion) {
          asignaciones.push(asignacion);
          slotsAsignados.add(`${asignacion.fecha}-${asignacion.torneoCanchaId}-${asignacion.horaInicio}`);
        }
      }
    }

    // 8. Construir distribución final
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
    horaMaxima?: string,
    logs?: LogAsignacion[],
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

      // Filtrar por hora máxima (para finales)
      if (horaMaxima) {
        slotsDelDia = slotsDelDia.filter(s => s.horaInicio <= horaMaxima);
      }

      for (const slot of slotsDelDia) {
        const slotKey = `${fecha}-${slot.torneoCanchaId}-${slot.horaInicio}`;

        // Verificar si el slot ya está asignado
        if (slotsAsignados.has(slotKey)) continue;

        // Verificar conflictos de pareja con mensaje informativo
        const verificacion = this.verificarConflictoPareja(
          partido,
          fecha,
          slot.horaInicio,
          asignacionesExistentes,
        );

        if (verificacion.conflicto) {
          // Log informativo sobre por qué se saltó este slot
          console.log(
            `[Programacion] Slot ${slot.horaInicio} en ${fecha} saltado para partido ${partido.id}: ${verificacion.razon}`
          );
          
          // Agregar al array de logs para el frontend
          if (logs) {
            logs.push({
              tipo: 'SALTADO',
              partidoId: partido.id,
              categoriaNombre: partido.categoriaNombre,
              fase: partido.fase,
              fecha,
              hora: slot.horaInicio,
              mensaje: verificacion.razon || 'Conflicto de horario',
            });
          }
          
          continue;
        }

        // Slot válido encontrado - agregar log
        if (logs) {
          logs.push({
            tipo: 'ASIGNADO',
            partidoId: partido.id,
            categoriaNombre: partido.categoriaNombre,
            fase: partido.fase,
            fecha,
            hora: slot.horaInicio,
            mensaje: `${partido.categoriaNombre} - ${partido.fase} asignado a las ${slot.horaInicio} en ${fecha}`,
          });
        }

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
   * Obtiene el orden de categorías para ordenar finales
   * Categorías bajas primero (8ª → 1ª), dejando lo mejor para el final
   * Retorna Map<categoryId, orden> donde menor orden = va primero
   */
  private async obtenerOrdenCategorias(
    tournamentCategories?: { id: string; categoryId: string }[],
  ): Promise<Map<string, number>> {
    const ordenMap = new Map<string, number>();
    
    if (!tournamentCategories || tournamentCategories.length === 0) {
      return ordenMap;
    }

    // Obtener nombres de categorías
    const categoryIds = tournamentCategories.map(tc => tc.categoryId);
    const categorias = await this.prisma.category.findMany({
      where: { id: { in: categoryIds } },
      select: { id: true, nombre: true },
    });

    // Mapa de palabras clave a orden numérico (menor = más baja = va primero)
    const extractOrder = (nombre: string): number => {
      const lower = nombre.toLowerCase();
      // 8ª (octava) más baja = orden 1 (va primero)
      // 1ª (primera) más alta = orden 8 (va último)
      if (lower.includes('8') || lower.includes('octava')) return 1;
      if (lower.includes('7') || lower.includes('septima')) return 2;
      if (lower.includes('6') || lower.includes('sexta')) return 3;
      if (lower.includes('5') || lower.includes('quinta')) return 4;
      if (lower.includes('4') || lower.includes('cuarta')) return 5;
      if (lower.includes('3') || lower.includes('tercera')) return 6;
      if (lower.includes('2') || lower.includes('segunda')) return 7;
      if (lower.includes('1') || lower.includes('primera')) return 8;
      return 999; // Sin orden definido = al final
    };

    // Asignar orden basado en el nombre de la categoría
    for (const cat of categorias) {
      ordenMap.set(cat.id, extractOrder(cat.nombre));
    }

    return ordenMap;
  }

  /**
   * Asigna partidos de forma balanceada entre días según capacidad
   * Distribuye proporcionalmente para evitar saturar los primeros días
   */
  private asignarPartidosBalanceado(
    partidos: PartidoProgramar[],
    fechas: string[],
    slotsPorFecha: Record<string, SlotDisponible[]>,
    slotsAsignados: Set<string>,
    asignaciones: PartidoAsignado[],
    logs?: LogAsignacion[],
  ): void {
    // DISTRIBUCIÓN BALANCEADA + OPTIMIZACIÓN DE ADELANTAR
    // 
    // 1. Calcular cuántos partidos debería tener cada día proporcionalmente
    // 2. Por cada partido, encontrar el día con más "espacio proporcional disponible"
    // 3. Dentro de ese día, usar la lógica de adelantar para minimizar huecos
    
    // PASO 1: Calcular capacidad y objetivo de cada día
    const capacidadPorDia = new Map<string, number>();
    const asignadosPorDia = new Map<string, number>();
    let capacidadTotal = 0;
    
    for (const fecha of fechas) {
      const slots = slotsPorFecha[fecha] || [];
      const capacidad = slots.length;
      capacidadPorDia.set(fecha, capacidad);
      asignadosPorDia.set(fecha, 0);
      capacidadTotal += capacidad;
    }
    
    if (capacidadTotal === 0) return;
    
    // Calcular objetivo de partidos por día (proporcional)
    const objetivoPorDia = new Map<string, number>();
    for (const fecha of fechas) {
      const capacidad = capacidadPorDia.get(fecha) || 0;
      const proporcion = capacidad / capacidadTotal;
      objetivoPorDia.set(fecha, Math.round(partidos.length * proporcion));
    }
    
    // Ajustar por redondeo
    let totalObjetivo = 0;
    for (const cantidad of objetivoPorDia.values()) {
      totalObjetivo += cantidad;
    }
    if (totalObjetivo !== partidos.length && fechas.length > 0) {
      const ultimaFecha = fechas[fechas.length - 1];
      objetivoPorDia.set(ultimaFecha, (objetivoPorDia.get(ultimaFecha) || 0) + (partidos.length - totalObjetivo));
    }
    
    // PASO 2: Asignar partidos manteniendo el balance
    const partidosPendientes = [...partidos];
    
    while (partidosPendientes.length > 0) {
      // Encontrar el día con más "margen proporcional" (más lejos de su objetivo)
      let mejorFecha: string | null = null;
      let mejorMargen = -Infinity;
      
      for (const fecha of fechas) {
        const asignados = asignadosPorDia.get(fecha) || 0;
        const objetivo = objetivoPorDia.get(fecha) || 0;
        const margen = objetivo - asignados; // Cuántos más puede recibir
        
        // Solo considerar días que aún necesitan partidos y tienen slots libres
        const slotsLibres = (slotsPorFecha[fecha] || []).filter(s => {
          const key = `${fecha}-${s.torneoCanchaId}-${s.horaInicio}`;
          return !slotsAsignados.has(key);
        }).length;
        
        if (margen > mejorMargen && slotsLibres > 0) {
          mejorMargen = margen;
          mejorFecha = fecha;
        }
      }
      
      if (!mejorFecha) break; // No hay más días disponibles
      
      // Intentar asignar un partido al día seleccionado
      const slotsDelDia = slotsPorFecha[mejorFecha] || [];
      let partidoAsignado = false;
      
      for (const slot of slotsDelDia) {
        const slotKey = `${mejorFecha}-${slot.torneoCanchaId}-${slot.horaInicio}`;
        if (slotsAsignados.has(slotKey)) continue;
        
        // Buscar el primer partido pendiente que pueda usar este slot
        for (let i = 0; i < partidosPendientes.length; i++) {
          const partido = partidosPendientes[i];
          
          const verificacion = this.verificarConflictoPareja(
            partido,
            mejorFecha,
            slot.horaInicio,
            asignaciones,
          );
          
          if (!verificacion.conflicto) {
            // Asignar partido
            const asignacion: PartidoAsignado = {
              partidoId: partido.id,
              fecha: mejorFecha,
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
            
            asignaciones.push(asignacion);
            slotsAsignados.add(slotKey);
            asignadosPorDia.set(mejorFecha, (asignadosPorDia.get(mejorFecha) || 0) + 1);
            
            if (logs) {
              logs.push({
                tipo: i > 0 ? 'ADELANTADO' : 'ASIGNADO',
                partidoId: partido.id,
                categoriaNombre: partido.categoriaNombre,
                fase: partido.fase,
                fecha: mejorFecha,
                hora: slot.horaInicio,
                mensaje: i > 0 
                  ? `${partido.categoriaNombre} - ${partido.fase} ADELANTADO a ${mejorFecha} ${slot.horaInicio} (balance: ${asignadosPorDia.get(mejorFecha)}/${objetivoPorDia.get(mejorFecha)})`
                  : `${partido.categoriaNombre} - ${partido.fase} asignado a ${mejorFecha} ${slot.horaInicio} (balance: ${asignadosPorDia.get(mejorFecha)}/${objetivoPorDia.get(mejorFecha)})`,
              });
            }
            
            partidosPendientes.splice(i, 1);
            partidoAsignado = true;
            break;
          }
        }
        
        if (partidoAsignado) break;
      }
      
      // Si no se pudo asignar a este día, marcarlo como lleno para esta iteración
      if (!partidoAsignado) {
        asignadosPorDia.set(mejorFecha, 999999); // Forzar a buscar otro día
      }
    }
    
    // Si quedaron partidos sin asignar (no cabían en los días disponibles)
    if (partidosPendientes.length > 0 && logs) {
      for (const partido of partidosPendientes) {
        logs.push({
          tipo: 'SALTADO',
          partidoId: partido.id,
          categoriaNombre: partido.categoriaNombre,
          fase: partido.fase,
          fecha: '',
          hora: '',
          mensaje: `⚠️ ${partido.categoriaNombre} - ${partido.fase} NO SE PUDO ASIGNAR (sin slots disponibles)`,
        });
      }
    }
  }

  /**
   * Verifica si hay conflicto de pareja
   * Conflictos:
   * - Misma pareja ya juega ese día (máx 2 partidos por día)
   * - Misma pareja juega con <4h de descanso (regla FIP)
   * 
   * Retorna: { conflicto: boolean, razon?: string }
   */
  private verificarConflictoPareja(
    partido: PartidoProgramar,
    fecha: string,
    horaInicio: string,
    asignacionesExistentes: PartidoAsignado[],
  ): { conflicto: boolean; razon?: string } {
    const parejaIds = [partido.inscripcion1Id, partido.inscripcion2Id].filter(Boolean);
    const horaSlot = this.parseHora(horaInicio);
    const horaSlotStr = horaInicio;

    for (const parejaId of parejaIds) {
      if (!parejaId) continue;

      // Partidos de esta pareja en la misma fecha
      const partidosMismaFecha = asignacionesExistentes.filter(a => 
        a.fecha === fecha && (a.pareja1?.includes(parejaId) || a.pareja2?.includes(parejaId))
      );

      // Máximo 2 partidos por día por pareja
      if (partidosMismaFecha.length >= 2) {
        return {
          conflicto: true,
          razon: `Máximo 2 partidos por día (${partidosMismaFecha.length} ya asignados)`,
        };
      }

      // Verificar 4h de descanso (regla FIP)
      for (const p of partidosMismaFecha) {
        const horaPartido = this.parseHora(p.horaInicio);
        const diferenciaHoras = Math.abs(horaSlot - horaPartido);
        
        if (diferenciaHoras < 4) {
          const horaPermitida = this.formatHora(horaPartido + 4);
          return {
            conflicto: true,
            razon: `Descanso reglamentario: jugó a las ${p.horaInicio}, puede jugar desde las ${horaPermitida} (4h de descanso)`,
          };
        }
      }
    }

    return { conflicto: false };
  }

  /**
   * Versión simple para verificar rápidamente (sin mensajes)
   */
  private tieneConflictoPareja(
    parejaIds: (string | undefined)[],
    fecha: string,
    horaInicio: string,
    asignacionesExistentes: PartidoAsignado[],
  ): boolean {
    const resultado = this.verificarConflictoPareja(
      { 
        id: '', 
        fase: '', 
        orden: 0, 
        categoriaId: '', 
        categoriaNombre: '',
        inscripcion1Id: parejaIds[0],
        inscripcion2Id: parejaIds[1],
      } as PartidoProgramar,
      fecha,
      horaInicio,
      asignacionesExistentes,
    );
    return resultado.conflicto;
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
          // FIX: fechaProgramada es String YYYY-MM-DD
          fechaProgramada: asignacion.fecha,
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
            // FIX: fecha es String YYYY-MM-DD
            fecha: asignacion.fecha,
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
        // FIX: fechaProgramada es String YYYY-MM-DD
        partido.fechaProgramada,
        partido.horaProgramada,
      );
    }

    // Actualizar el partido
    await this.prisma.match.update({
      where: { id: partidoId },
      data: {
        // FIX: fechaProgramada es String YYYY-MM-DD
        fechaProgramada: fecha,
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
        // FIX: fechaProgramada es String YYYY-MM-DD
        partido.fechaProgramada,
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
   * Programa automáticamente un partido específico buscando el mejor slot disponible
   * Usado cuando un partido de fase siguiente se completa (tiene ambas parejas)
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

    // Determinar restricciones según la fase
    const esFaseFinal = ['SEMIS', 'FINAL'].includes(partido.ronda);
    const fechaFinales = torneo?.fechaFinales 
      // FIX: fechaFinales es String YYYY-MM-DD
      ? torneo.fechaFinales
      : null;
    
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

      // Verificar conflicto de pareja (4h de descanso)
      const parejaIds = [partido.inscripcion1Id, partido.inscripcion2Id].filter(Boolean);
      const hayConflicto = this.tieneConflictoPareja(
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
        horaFin: this.calcularHoraFin(slot.horaInicio),
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

  private calcularHoraFin(horaInicio: string): string {
    const [h, m] = horaInicio.split(':').map(Number);
    const totalMinutos = h * 60 + m + 70; // 90 min = 1.5h
    const horaFin = Math.floor(totalMinutos / 60);
    const minutosFin = totalMinutos % 60;
    return `${horaFin.toString().padStart(2, '0')}:${minutosFin.toString().padStart(2, '0')}`;
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

  private formatHora(decimal: number): string {
    const h = Math.floor(decimal);
    const m = Math.round((decimal - h) * 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
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
          // FIX: fecha es String YYYY-MM-DD
          fecha: fecha,
        },
        horaInicio,
      },
      data: { estado: 'LIBRE' },
    });
  }

  /**
   * Obtiene todos los partidos programados de un torneo
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
      horaFin: this.calcularHoraFin(p.horaProgramada as string),
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
