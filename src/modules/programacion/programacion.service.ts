import { Injectable, BadRequestException } from '@nestjs/common';
import { MatchStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { DateService } from '../../common/services/date.service';
import { DescansoCalculatorService, SlotInfo } from './descanso-calculator.service';
import {
  parseHora,
  formatHora,
  calcularHoraFin,
  getDiaSemana,
  agruparSlotsPorFecha,
  agruparAsignacionesPorFecha,
  validarConflictos,
  construirDistribucion,
  verificarConflictoPareja,
  tieneConflictoPareja,
  encontrarSlotOptimo,
  asignarPartidosBalanceado,
  calcularPrediccion,
  distribuirPartidosCronologicamente,
  FASES_FINALES,
} from './scheduling-utils';

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

export interface ResumenReprogramacion {
  totalJugables: number; // partidos con ambas parejas definidas
  asignados: number; // los que entraron en una franja
  sinFranja: number; // jugables que no entraron por falta de franjas
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

@Injectable()
export class ProgramacionService {
  constructor(
    private prisma: PrismaService,
    private dateService: DateService,
    private descansoCalculator: DescansoCalculatorService,
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
    incluirOcupadosPorPendientes = false,
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
    const slots = await this.obtenerSlotsDisponibles(tournamentId, incluirOcupadosPorPendientes);
    
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
    const prediccion = calcularPrediccion(partidos, slots);

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
    // El orden de categorías (para las finales) se carga acá (BD) y se pasa al cálculo puro.
    const ordenCategorias = await this.obtenerOrdenCategorias(tournamentCategories);
    const distribucion = distribuirPartidosCronologicamente(
      this.descansoCalculator,
      ordenCategorias,
      partidos,
      slots,
      fechaInicio,
      fechaFinales,
      canchasFinalesFinal,
      horaInicioFinalesFinal,
      horaFinFinalesFinal,
      logs,
    );

    // 9. Validar conflictos adicionales
    const conflictosAdicionales = validarConflictos(distribucion, partidos);

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
    // Excluir FINALIZADO: un partido ya jugado no se (re)programa nunca.
    const partidos = await this.prisma.match.findMany({
      where: {
        tournamentId,
        fixtureVersionId: { in: fixtureVersionIds },
        estado: { not: MatchStatus.FINALIZADO },
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
  private async obtenerSlotsDisponibles(
    tournamentId: string,
    incluirOcupadosPorPendientes = false,
  ): Promise<SlotDisponible[]> {
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
    const slotsLibres = await this.prisma.torneoSlot.findMany({
      where: {
        disponibilidadId: { in: disponibilidadIds },
        estado: 'LIBRE',
      },
      orderBy: [
        { horaInicio: 'asc' },
      ],
    });

    let slots = slotsLibres;

    // REPROGRAMACIÓN GENERAL: tratar también como disponibles las franjas que
    // hoy ocupan partidos PENDIENTES (no finalizados), porque se van a liberar.
    // Las franjas de partidos ya jugados quedan intactas.
    if (incluirOcupadosPorPendientes) {
      const pendientes = await this.prisma.match.findMany({
        where: {
          tournamentId,
          estado: { not: MatchStatus.FINALIZADO },
          torneoCanchaId: { not: null },
          fechaProgramada: { not: null },
          horaProgramada: { not: null },
        },
        select: { torneoCanchaId: true, fechaProgramada: true, horaProgramada: true },
      });

      if (pendientes.length > 0) {
        const tuplasPendientes = new Set(
          pendientes.map(p => `${p.torneoCanchaId}|${p.fechaProgramada}|${p.horaProgramada}`),
        );
        const slotsOcupados = await this.prisma.torneoSlot.findMany({
          where: {
            disponibilidadId: { in: disponibilidadIds },
            estado: 'OCUPADO',
          },
          orderBy: [{ horaInicio: 'asc' }],
        });
        const liberables = slotsOcupados.filter(s => {
          const disp = dispMap.get(s.disponibilidadId);
          if (!disp) return false;
          return tuplasPendientes.has(`${s.torneoCanchaId}|${disp.fecha}|${s.horaInicio}`);
        });
        slots = [...slotsLibres, ...liberables];
      }
    }

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
   * REPROGRAMACIÓN GENERAL — Vista previa (NO toca la BD).
   * Simula reacomodar TODOS los partidos pendientes desde cero, contando como
   * disponibles las franjas que hoy ocupan esos pendientes. Los partidos ya
   * jugados (FINALIZADO) no se tocan.
   */
  async reprogramarGeneralPreview(
    tournamentId: string,
  ): Promise<ResultadoProgramacion & { resumen: ResumenReprogramacion }> {
    const categorias = await this.obtenerCategoriasSorteadas(tournamentId);
    const resultado = await this.calcularProgramacion(
      tournamentId,
      categorias,
      undefined,
      undefined,
      undefined,
      undefined,
      true, // incluir franjas ocupadas por pendientes (se van a liberar)
    );
    return { ...resultado, resumen: this.calcularResumen(resultado) };
  }

  /**
   * REPROGRAMACIÓN GENERAL — Aplicar.
   * 1) Libera las franjas de todos los partidos pendientes y limpia su programación.
   * 2) Recalcula la agenda desde cero (los partidos jugados quedan intactos).
   * 3) Aplica la nueva distribución.
   */
  async reprogramarGeneralAplicar(
    tournamentId: string,
  ): Promise<{ resumen: ResumenReprogramacion; conflictos: Conflicto[] }> {
    // 1. Liberar franjas de los partidos pendientes (no finalizados) y limpiar su programación
    const pendientes = await this.prisma.match.findMany({
      where: {
        tournamentId,
        estado: { not: MatchStatus.FINALIZADO },
        torneoCanchaId: { not: null },
        fechaProgramada: { not: null },
        horaProgramada: { not: null },
      },
    });

    for (const p of pendientes) {
      await this.liberarSlot(p.torneoCanchaId!, p.fechaProgramada!, p.horaProgramada!);
    }

    if (pendientes.length > 0) {
      await this.prisma.match.updateMany({
        where: { id: { in: pendientes.map(p => p.id) } },
        data: { fechaProgramada: null, horaProgramada: null, torneoCanchaId: null },
      });
    }

    // 2. Recalcular desde cero (las franjas liberadas ya figuran como LIBRE)
    const categorias = await this.obtenerCategoriasSorteadas(tournamentId);
    const resultado = await this.calcularProgramacion(tournamentId, categorias);

    // 3. Aplicar la nueva distribución
    const asignaciones = resultado.distribucion.flatMap(d => d.partidos);
    await this.aplicarProgramacion(tournamentId, asignaciones);

    return { resumen: this.calcularResumen(resultado), conflictos: resultado.conflictos };
  }

  /** Cuenta jugables / asignados / sin franja de un resultado de programación. */
  private calcularResumen(resultado: ResultadoProgramacion): ResumenReprogramacion {
    const asignados = resultado.distribucion.reduce((acc, d) => acc + d.partidos.length, 0);
    const totalJugables = resultado.prediccion.totalPartidos;
    return { totalJugables, asignados, sinFranja: Math.max(0, totalJugables - asignados) };
  }

  /** IDs de TournamentCategory que ya tienen fixture sorteado. */
  private async obtenerCategoriasSorteadas(tournamentId: string): Promise<string[]> {
    const cats = await this.prisma.tournamentCategory.findMany({
      where: { tournamentId, fixtureVersionId: { not: null } },
      select: { id: true },
    });
    return cats.map(c => c.id);
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
