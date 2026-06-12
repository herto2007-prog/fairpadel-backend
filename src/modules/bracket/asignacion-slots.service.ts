import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DescansoCalculatorService } from '../programacion/descanso-calculator.service';
import { horaAMinutos, minutosAHora } from '../../common/utils/time-helpers';
import { FaseBracket } from './dto/generate-bracket.dto';
import { obtenerFasesParaDia } from './fases-dia.util';

interface SlotReserva {
  fecha: string;
  horaInicio: string;
  horaFin: string;
  torneoCanchaId: string;
  categoriaId: string;
  fase: FaseBracket;
  ordenPartido: number;
  matchId?: string;
}

@Injectable()
export class AsignacionSlotsService {
  constructor(
    private prisma: PrismaService,
    private descansoCalculator: DescansoCalculatorService,
  ) {}

  /**
   * PARTE 3: Asigna slots a partidos
   * 
   * Algoritmo:
   * 1. Ordenar categorias: primero las que tienen repechaje (mas inscriptos primero),
   *    luego las que no tienen repechaje (mas inscriptos primero)
   * 2. Para cada dia, asignar TODAS las fases N antes que cualquier fase N+1
   *    (ZONA completa → REPECHAJE completo → OCTAVOS completos...)
   * 3. Descanso de 2h solo si es mismo dia (dia diferente = siempre valido)
   * 4. BYE ignorados (no reciben slots)
   */
  /**
   * NUEVO ALGORITMO: Asigna slots a partidos con lógica optimizada
   * 
   * FLUJO:
   * Día 1 (Jueves): ZONA - Prioridad a categorías CON ajuste
   * Día 2 (Viernes): ZONA pendiente → AJUSTES → 8VOS (solo si no hay conflicto con ajustes)
   * Día 3 (Sábado): Resto 8VOS → 4TOS
   * Día 4 (Domingo): SEMIS → FINAL
   * 
   * Los partidos sin cancha van a Auditoría con fecha/hora ideal
   */
  async asignarSlots(
    tournamentId: string,
    categoriasData: Array<{ categoria: any; nombre: string; inscripciones: any[] }>,
    diasConfig: any[],
  ): Promise<{ totalPartidosAsignados: number; distribucionPorDia: Record<string, number> }> {
    const distribucionPorDia: Record<string, number> = {};
    const ultimoPartidoPorPareja = new Map<string, { fecha: string; horaFin: string }>();
    const partidosAsignados = new Set<string>();
    
    // Track parejas en ajustes por categoría (para controlar 8vos en Viernes)
    const parejasEnAjustesPorCategoria = new Map<string, Set<string>>();
    
    // Pre-calcular qué categorías tienen ajuste y tamaño de bracket
    const categoriasConAjuste = new Set<string>();
    const categoriasSinAjuste = new Set<string>();
    // NUEVO: Mapa de tamaño de bracket por categoría (8, 16, 32, 64)
    const tamanoBracketPorCategoria = new Map<string, number>();
    
    for (const catData of categoriasData) {
      const catId = catData.categoria.id;
      const config = (catData as any).bracketConfig;
      const tieneAjuste = (config?.partidosRepechaje || 0) > 0;
      if (tieneAjuste) {
        categoriasConAjuste.add(catId);
      } else {
        categoriasSinAjuste.add(catId);
      }
      // Guardar tamaño del bracket (default 16 si no está definido)
      tamanoBracketPorCategoria.set(catId, config?.tamanoBracket || 16);
    }

    // 1. PROCESAR CADA DÍA CON LÓGICA ESPECÍFICA
    for (let diaIndex = 0; diaIndex < diasConfig.length; diaIndex++) {
      const dia = diasConfig[diaIndex];

      const slotsDelDia = await this.prisma.torneoSlot.findMany({
        where: { disponibilidadId: dia.id, estado: 'LIBRE' },
        orderBy: { horaInicio: 'asc' },
      });

      if (slotsDelDia.length === 0) continue;

      const slotsUsados = new Set<number>();
      // FIX: Usar objeto contenedor para que persista entre métodos
      const ultimaHoraFinDelDia = { value: null as string | null };
      
      // Identificar día de semana para lógica específica
      const [year, month, dayNum] = dia.fecha.split('-').map(Number);
      const date = new Date(Date.UTC(year, month - 1, dayNum, 12, 0, 0));
      const diaSemana = date.getUTCDay();
      
      // Obtener fases permitidas desde configuración del día
      const fasesPermitidas = (dia.fasesPermitidas as string)?.split(',') as FaseBracket[] || 
        obtenerFasesParaDia(dia.fecha);
      
      // Helper para verificar si una fase está permitida
      const fasePermitida = (fase: FaseBracket): boolean => {
        return fasesPermitidas.includes(fase);
      };
      
      // ==========================================
      // DÍA 1 (JUEVES): ZONA - Prioridad a categorías con ajuste
      // ==========================================
      if (diaSemana === 4) { // Jueves
        if (fasePermitida(FaseBracket.ZONA)) {
          // Primero: ZONA de categorías CON ajuste (para maximizar descanso antes de ajustes del Viernes)
          for (const catData of categoriasData) {
            const catId = catData.categoria.id;
            if (!categoriasConAjuste.has(catId)) continue; // Solo con ajuste
            
            await this.asignarPartidosDeFase(
              catData, FaseBracket.ZONA, dia, slotsDelDia, slotsUsados,
              ultimoPartidoPorPareja, ultimaHoraFinDelDia, partidosAsignados, distribucionPorDia
            );
          }
          
          // Luego: ZONA de categorías SIN ajuste
          for (const catData of categoriasData) {
            const catId = catData.categoria.id;
            if (!categoriasSinAjuste.has(catId)) continue; // Solo sin ajuste
            
            await this.asignarPartidosDeFase(
              catData, FaseBracket.ZONA, dia, slotsDelDia, slotsUsados,
              ultimoPartidoPorPareja, ultimaHoraFinDelDia, partidosAsignados, distribucionPorDia
            );
          }
        }
      }
      
      // ==========================================
      // DÍA 2 (VIERNES): ZONA pendiente → AJUSTES → Bracket (en orden cronológico)
      // ==========================================
      else if (diaSemana === 5) { // Viernes
        // console.log(`[asignarSlots] ===== VIERNES ${dia.fecha} =====`);
        // console.log(`[asignarSlots] Fases permitidas: ${fasesPermitidas.join(', ')}`);
        
        // 1. Primero: ZONA pendiente de cualquier categoría (si está permitida)
        if (fasePermitida(FaseBracket.ZONA)) {
          // console.log(`[asignarSlots] --- Fase ZONA ---`);
          for (const catData of categoriasData) {
            await this.asignarPartidosDeFase(
              catData, FaseBracket.ZONA, dia, slotsDelDia, slotsUsados,
              ultimoPartidoPorPareja, ultimaHoraFinDelDia, partidosAsignados, distribucionPorDia
            );
          }
        }
        
        // 2. Segundo: AJUSTES - y registrar parejas que juegan ajustes (si está permitida)
        if (fasePermitida(FaseBracket.REPECHAJE)) {
          // console.log(`[asignarSlots] --- Fase REPECHAJE ---`);
          for (const catData of categoriasData) {
            const catId = catData.categoria.id;
            if (!categoriasConAjuste.has(catId)) continue;
            
            const parejasAjuste = await this.asignarPartidosDeFaseYRegistrarParejas(
              catData, FaseBracket.REPECHAJE, dia, slotsDelDia, slotsUsados,
              ultimoPartidoPorPareja, ultimaHoraFinDelDia, partidosAsignados, distribucionPorDia
            );
            
            if (parejasAjuste.size > 0) {
              parejasEnAjustesPorCategoria.set(catId, parejasAjuste);
            }
          }
        }
        
        // 3. Tercero: Bracket en ORDEN CRONOLÓGICO según tamaño del bracket
        // Solo procesar fases que estén explícitamente permitidas
        
        // 3a. 32avos (solo bracket de 64)
        if (fasePermitida(FaseBracket.TREINTAYDOSAVOS)) {
          // console.log(`[asignarSlots] --- Fase TREINTAYDOSAVOS ---`);
          for (const catData of categoriasData) {
            const catId = catData.categoria.id;
            const tamano = tamanoBracketPorCategoria.get(catId) || 16;
            if (tamano < 64) continue;
            
            await this.asignarPartidosDeFase(
              catData, FaseBracket.TREINTAYDOSAVOS, dia, slotsDelDia, slotsUsados,
              ultimoPartidoPorPareja, ultimaHoraFinDelDia, partidosAsignados, distribucionPorDia
            );
          }
        }
        
        // 3b. 16avos (bracket de 64 y 32)
        if (fasePermitida(FaseBracket.DIECISEISAVOS)) {
          // console.log(`[asignarSlots] --- Fase DIECISEISAVOS ---`);
          for (const catData of categoriasData) {
            const catId = catData.categoria.id;
            const tamano = tamanoBracketPorCategoria.get(catId) || 16;
            if (tamano < 32) continue;
            
            await this.asignarPartidosDeFase(
              catData, FaseBracket.DIECISEISAVOS, dia, slotsDelDia, slotsUsados,
              ultimoPartidoPorPareja, ultimaHoraFinDelDia, partidosAsignados, distribucionPorDia
            );
          }
        }
        
        // 3c. 8vos (bracket de 64, 32 y 16) - con filtro de parejas en ajustes
        if (fasePermitida(FaseBracket.OCTAVOS)) {
          // console.log(`[asignarSlots] --- Fase OCTAVOS ---`);
          for (const catData of categoriasData) {
            const catId = catData.categoria.id;
            const tamano = tamanoBracketPorCategoria.get(catId) || 16;
            if (tamano < 16) continue;
            
            const parejasEnAjustes = parejasEnAjustesPorCategoria.get(catId) || new Set<string>();
            
            await this.asignarPartidosDeFaseConFiltro(
              catData, FaseBracket.OCTAVOS, dia, slotsDelDia, slotsUsados,
              ultimoPartidoPorPareja, ultimaHoraFinDelDia, partidosAsignados, distribucionPorDia,
              parejasEnAjustes
            );
          }
        }
        
        // 3d. 4tos (todos los brackets: 64, 32, 16, 8)
        if (fasePermitida(FaseBracket.CUARTOS)) {
          // console.log(`[asignarSlots] --- Fase CUARTOS ---`);
          for (const catData of categoriasData) {
            const catId = catData.categoria.id;
            const tamano = tamanoBracketPorCategoria.get(catId) || 16;
            if (tamano < 8) continue;
            
            await this.asignarPartidosDeFase(
              catData, FaseBracket.CUARTOS, dia, slotsDelDia, slotsUsados,
              ultimoPartidoPorPareja, ultimaHoraFinDelDia, partidosAsignados, distribucionPorDia
            );
          }
        }
      }
      
      // ==========================================
      // DÍA 3 (SÁBADO): Bracket pendiente en orden cronológico
      // ==========================================
      else if (diaSemana === 6) { // Sábado
        // console.log(`[asignarSlots] ===== SABADO ${dia.fecha} =====`);
        // console.log(`[asignarSlots] Fases permitidas: ${fasesPermitidas.join(', ')}`);
        
        // Procesar en ORDEN CRONOLÓGICO según tamaño del bracket
        // Solo procesar fases que estén explícitamente permitidas
        
        // 1. 32avos pendientes (solo bracket de 64)
        if (fasePermitida(FaseBracket.TREINTAYDOSAVOS)) {
          // console.log(`[asignarSlots] --- Fase TREINTAYDOSAVOS ---`);
          for (const catData of categoriasData) {
            const catId = catData.categoria.id;
            const tamano = tamanoBracketPorCategoria.get(catId) || 16;
            if (tamano < 64) continue;
            
            await this.asignarPartidosDeFase(
              catData, FaseBracket.TREINTAYDOSAVOS, dia, slotsDelDia, slotsUsados,
              ultimoPartidoPorPareja, ultimaHoraFinDelDia, partidosAsignados, distribucionPorDia
            );
          }
        }
        
        // 2. 16avos pendientes (bracket de 64 y 32)
        if (fasePermitida(FaseBracket.DIECISEISAVOS)) {
          // console.log(`[asignarSlots] --- Fase DIECISEISAVOS ---`);
          for (const catData of categoriasData) {
            const catId = catData.categoria.id;
            const tamano = tamanoBracketPorCategoria.get(catId) || 16;
            if (tamano < 32) continue;
            
            await this.asignarPartidosDeFase(
              catData, FaseBracket.DIECISEISAVOS, dia, slotsDelDia, slotsUsados,
              ultimoPartidoPorPareja, ultimaHoraFinDelDia, partidosAsignados, distribucionPorDia
            );
          }
        }
        
        // 3. 8vos pendientes (bracket de 64, 32 y 16)
        if (fasePermitida(FaseBracket.OCTAVOS)) {
          // console.log(`[asignarSlots] --- Fase OCTAVOS ---`);
          for (const catData of categoriasData) {
            const catId = catData.categoria.id;
            const tamano = tamanoBracketPorCategoria.get(catId) || 16;
            if (tamano < 16) continue;
            
            await this.asignarPartidosDeFase(
              catData, FaseBracket.OCTAVOS, dia, slotsDelDia, slotsUsados,
              ultimoPartidoPorPareja, ultimaHoraFinDelDia, partidosAsignados, distribucionPorDia
            );
          }
        }
        
        // 4. 4tos (todos los brackets)
        if (fasePermitida(FaseBracket.CUARTOS)) {
          // console.log(`[asignarSlots] --- Fase CUARTOS ---`);
          for (const catData of categoriasData) {
            const catId = catData.categoria.id;
            const tamano = tamanoBracketPorCategoria.get(catId) || 16;
            if (tamano < 8) continue;
            
            await this.asignarPartidosDeFase(
              catData, FaseBracket.CUARTOS, dia, slotsDelDia, slotsUsados,
              ultimoPartidoPorPareja, ultimaHoraFinDelDia, partidosAsignados, distribucionPorDia
            );
          }
        }
      }
      
      // ==========================================
      // DÍA 4 (DOMINGO): SEMIS → FINAL
      // ==========================================
      else if (diaSemana === 0) { // Domingo
        // console.log(`[asignarSlots] ===== DOMINGO ${dia.fecha} =====`);
        // console.log(`[asignarSlots] Fases permitidas: ${fasesPermitidas.join(', ')}`);
        
        // SEMIS (con descanso desde CUARTOS - calculado automáticamente por origen)
        if (fasePermitida(FaseBracket.SEMIS)) {
          // console.log(`[asignarSlots] --- Fase SEMIS ---`);
          for (const catData of categoriasData) {
            await this.asignarPartidosDeFase(
              catData, FaseBracket.SEMIS, dia, slotsDelDia, slotsUsados,
              ultimoPartidoPorPareja, ultimaHoraFinDelDia, partidosAsignados, distribucionPorDia
            );
          }
        }
        
        // FINAL (con descanso desde SEMIS - calculado automáticamente por origen)
        if (fasePermitida(FaseBracket.FINAL)) {
          // console.log(`[asignarSlots] --- Fase FINAL ---`);
          for (const catData of categoriasData) {
            await this.asignarPartidosDeFase(
              catData, FaseBracket.FINAL, dia, slotsDelDia, slotsUsados,
              ultimoPartidoPorPareja, ultimaHoraFinDelDia, partidosAsignados, distribucionPorDia
            );
          }
        }
      }
      
      // ==========================================
      // OTROS DÍAS: Lógica por defecto (por fases permitidas)
      // ==========================================
      else {
        const fasesPermitidas = (dia.fasesPermitidas as string)?.split(',') as FaseBracket[] || 
          obtenerFasesParaDia(dia.fecha);
        for (const fase of fasesPermitidas) {
          for (const catData of categoriasData) {
            await this.asignarPartidosDeFase(
              catData, fase, dia, slotsDelDia, slotsUsados,
              ultimoPartidoPorPareja, ultimaHoraFinDelDia, partidosAsignados, distribucionPorDia
            );
          }
        }
      }
    }

    // AUDITORÍA: Partidos sin cancha (fechaProgramada null) van a Auditoría
    const partidosSinCancha = await this.prisma.match.findMany({
      where: {
        fixtureVersionId: { in: categoriasData.map(c => c.categoria.fixtureVersionId).filter(Boolean) },
        fechaProgramada: null,
        esBye: false,
      },
      select: {
        id: true,
        ronda: true,
      },
    });

    if (partidosSinCancha.length > 0 && diasConfig.length > 0) {
      const ultimoDia = diasConfig[diasConfig.length - 1];
      for (const partido of partidosSinCancha) {
        await this.prisma.match.update({
          where: { id: partido.id },
          data: {
            fechaProgramada: ultimoDia.fecha,
            horaProgramada: '23:00',
            torneoCanchaId: null,
          },
        });
      }
      // console.log(`[AsignarSlots] ${partidosSinCancha.length} partidos sin cancha asignados al último día para Auditoría`);
    }

    return {
      totalPartidosAsignados: partidosAsignados.size,
      distribucionPorDia,
    };
  }

  /**
   * Obtiene partidos pendientes de asignaci├│n
   */
  private async obtenerPartidosPendientes(
    tournamentId: string,
    categoriasData: Array<{ categoria: any; nombre: string; inscripciones: any[] }>,
    fasesPermitidas: FaseBracket[],
    partidosAsignados: Set<string>,
  ): Promise<Map<string, Array<{
    fase: FaseBracket;
    orden: number;
    matchId: string;
    inscripcion1Id?: string;
    inscripcion2Id?: string;
  }>>> {
    const fixtureVersionIds = categoriasData
      .filter(c => c.categoria.fixtureVersionId)
      .map(c => c.categoria.fixtureVersionId!);

    if (fixtureVersionIds.length === 0) {
      return new Map();
    }

    const todosLosPartidos = await this.prisma.match.findMany({
      where: {
        fixtureVersionId: { in: fixtureVersionIds },
        ronda: { in: fasesPermitidas },
      },
      select: {
        id: true,
        ronda: true,
        categoryId: true,
        inscripcion1Id: true,
        inscripcion2Id: true,
        posicionEnSiguiente: true,
      },
    });

    const partidosConSlotAsignado = await this.prisma.torneoSlot.findMany({
      where: {
        disponibilidad: { tournamentId },
        estado: { in: ['OCUPADO', 'RESERVADO'] },
        matchId: { not: null },
      },
      select: { matchId: true },
    });
    const matchIdsAsignados = new Set(partidosConSlotAsignado.map(s => s.matchId));

    const partidosPorCategoria = new Map<string, any[]>();

    for (const catData of categoriasData) {
      if (!catData.categoria.fixtureVersionId) continue;

      const partidosPendientes = todosLosPartidos
        .filter(p => 
          p.categoryId === catData.categoria.categoryId &&
          !matchIdsAsignados.has(p.id) &&
          !partidosAsignados.has(p.id)
        )
        .map(p => ({
          fase: p.ronda as FaseBracket,
          orden: p.posicionEnSiguiente || 1,
          matchId: p.id,
          inscripcion1Id: p.inscripcion1Id || undefined,
          inscripcion2Id: p.inscripcion2Id || undefined,
        }));

      if (partidosPendientes.length > 0) {
        partidosPorCategoria.set(catData.categoria.id, partidosPendientes);
      }
    }

    return partidosPorCategoria;
  }

  /**
   * Ordena partidos con Round-Robin incluyendo IDs de parejas
   */
  private ordenarRoundRobinConParejas(
    partidosPorCategoria: Map<string, Array<{
      fase: FaseBracket;
      orden: number;
      matchId: string;
      inscripcion1Id?: string;
      inscripcion2Id?: string;
    }>>,
    ordenCategorias: string[],
  ): Array<{
    categoriaId: string;
    fase: FaseBracket;
    orden: number;
    matchId: string;
    inscripcion1Id?: string;
    inscripcion2Id?: string;
  }> {
    const resultado: Array<{
      categoriaId: string;
      fase: FaseBracket;
      orden: number;
      matchId: string;
      inscripcion1Id?: string;
      inscripcion2Id?: string;
    }> = [];

    let maxLength = 0;
    for (const catId of ordenCategorias) {
      const partidos = partidosPorCategoria.get(catId) || [];
      maxLength = Math.max(maxLength, partidos.length);
    }

    for (let i = 0; i < maxLength; i++) {
      for (const catId of ordenCategorias) {
        const partidos = partidosPorCategoria.get(catId) || [];
        if (i < partidos.length) {
          resultado.push({
            categoriaId: catId,
            ...partidos[i],
          });
        }
      }
    }

    return resultado;
  }

  /**
   * Helper: Asigna partidos de una fase específica
   * El descanso se calcula automáticamente por pareja o por origen
   */
  private async asignarPartidosDeFase(
    catData: any,
    fase: FaseBracket,
    dia: any,
    slotsDelDia: any[],
    slotsUsados: Set<number>,
    ultimoPartidoPorPareja: Map<string, { fecha: string; horaFin: string }>,
    ultimaHoraFinDelDia: { value: string | null },
    partidosAsignados: Set<string>,
    distribucionPorDia: Record<string, number>,
  ): Promise<void> {
    // Track partidos que no se pudieron asignar en esta iteración para no reintentarlos infinitamente
    const partidosNoAsignados = new Set<string>();
    
    // console.log(`[asignarPartidosDeFase] Iniciando fase ${fase} para dia ${dia.fecha}. Slots disponibles: ${slotsDelDia.length - slotsUsados.size}`);
    
    while (true) {
      const partido = await this.prisma.match.findFirst({
        where: {
          fixtureVersionId: catData.categoria.fixtureVersionId,
          ronda: fase,
          esBye: false,
          fechaProgramada: null,
          id: { notIn: Array.from(partidosNoAsignados) },
        },
        select: {
          id: true,
          ronda: true,
          inscripcion1Id: true,
          inscripcion2Id: true,
        },
      });

      if (!partido) {
        // console.log(`[asignarPartidosDeFase] No hay más partidos pendientes en fase ${fase}`);
        break;
      }

      // console.log(`[asignarPartidosDeFase] Encontrado partido ${partido.id} en fase ${fase}`);

      const asignado = await this.intentarAsignarSlot(
        partido, dia, slotsDelDia, slotsUsados,
        ultimoPartidoPorPareja, ultimaHoraFinDelDia,
        partidosAsignados, distribucionPorDia
      );

      if (!asignado) {
        // console.log(`[asignarPartidosDeFase] Partido ${partido.id} NO pudo asignarse, marcando para no reintentar`);
        // Marcar como no asignado para no reintentar en esta fase
        partidosNoAsignados.add(partido.id);
        // Continuar con el siguiente partido, NO hacer break
        continue;
      }
      
      // console.log(`[asignarPartidosDeFase] Partido ${partido.id} ASIGNADO correctamente`);
    }
  }

  /**
   * Helper: Asigna partidos de fase y registra las parejas que jugaron
   */
  private async asignarPartidosDeFaseYRegistrarParejas(
    catData: any,
    fase: FaseBracket,
    dia: any,
    slotsDelDia: any[],
    slotsUsados: Set<number>,
    ultimoPartidoPorPareja: Map<string, { fecha: string; horaFin: string }>,
    ultimaHoraFinDelDia: { value: string | null },
    partidosAsignados: Set<string>,
    distribucionPorDia: Record<string, number>,
  ): Promise<Set<string>> {
    const parejasEnPartidos = new Set<string>();
    const partidosNoAsignados = new Set<string>();
    
    while (true) {
      const partido = await this.prisma.match.findFirst({
        where: {
          fixtureVersionId: catData.categoria.fixtureVersionId,
          ronda: fase,
          esBye: false,
          fechaProgramada: null,
          id: { notIn: Array.from(partidosNoAsignados) },
        },
        select: {
          id: true,
          ronda: true,
          inscripcion1Id: true,
          inscripcion2Id: true,
        },
      });

      if (!partido) break;

      const asignado = await this.intentarAsignarSlot(
        partido, dia, slotsDelDia, slotsUsados,
        ultimoPartidoPorPareja, ultimaHoraFinDelDia,
        partidosAsignados, distribucionPorDia
      );

      if (!asignado) {
        partidosNoAsignados.add(partido.id);
        continue;
      }
      
      // Registrar parejas que jugaron
      if (partido.inscripcion1Id) parejasEnPartidos.add(partido.inscripcion1Id);
      if (partido.inscripcion2Id) parejasEnPartidos.add(partido.inscripcion2Id);
    }
    
    return parejasEnPartidos;
  }

  /**
   * Helper: Asigna partidos de fase filtrando parejas (para 8vos con ajustes)
   * El descanso se calcula automáticamente por pareja o por origen
   */
  private async asignarPartidosDeFaseConFiltro(
    catData: any,
    fase: FaseBracket,
    dia: any,
    slotsDelDia: any[],
    slotsUsados: Set<number>,
    ultimoPartidoPorPareja: Map<string, { fecha: string; horaFin: string }>,
    ultimaHoraFinDelDia: { value: string | null },
    partidosAsignados: Set<string>,
    distribucionPorDia: Record<string, number>,
    parejasExcluidas: Set<string>,
  ): Promise<void> {
    const partidosNoAsignados = new Set<string>();
    
    // console.log(`[asignarPartidosDeFaseConFiltro] Iniciando fase ${fase} para dia ${dia.fecha}. Slots disponibles: ${slotsDelDia.length - slotsUsados.size}`);
    
    while (true) {
      // Buscar partido donde NINGUNA de las parejas esté en parejasExcluidas
      // Y que no haya sido marcado como no asignado previamente
      const partidosCandidatos = await this.prisma.match.findMany({
        where: {
          fixtureVersionId: catData.categoria.fixtureVersionId,
          ronda: fase,
          esBye: false,
          fechaProgramada: null,
        },
        select: {
          id: true,
          ronda: true,
          inscripcion1Id: true,
          inscripcion2Id: true,
        },
        take: 50, // Batch para verificar
      });
      
      // console.log(`[asignarPartidosDeFaseConFiltro] Candidatos encontrados: ${partidosCandidatos.length}`);
      
      // Filtrar manualmente (excluir parejas en ajustes y partidos ya intentados)
      const partidoValido = partidosCandidatos.find(p => {
        if (partidosNoAsignados.has(p.id)) return false;
        const p1Excluida = p.inscripcion1Id && parejasExcluidas.has(p.inscripcion1Id);
        const p2Excluida = p.inscripcion2Id && parejasExcluidas.has(p.inscripcion2Id);
        const valido = !p1Excluida && !p2Excluida;
        // console.log(`[asignarPartidosDeFaseConFiltro] Partido ${p.id}: insc1=${p.inscripcion1Id}, insc2=${p.inscripcion2Id}, valido=${valido}`);
        return valido;
      });
      
      if (!partidoValido) {
        // console.log(`[asignarPartidosDeFaseConFiltro] No hay más partidos válidos para fase ${fase}`);
        break; // No hay más partidos válidos
      }

      // console.log(`[asignarPartidosDeFaseConFiltro] Intentando asignar partido ${partidoValido.id}`);
      
      const asignado = await this.intentarAsignarSlot(
        partidoValido, dia, slotsDelDia, slotsUsados,
        ultimoPartidoPorPareja, ultimaHoraFinDelDia,
        partidosAsignados, distribucionPorDia
      );

      if (!asignado) {
        // console.log(`[asignarPartidosDeFaseConFiltro] Partido ${partidoValido.id} NO pudo asignarse`);
        partidosNoAsignados.add(partidoValido.id);
        continue; // Intentar con el siguiente partido
      }
      
      // console.log(`[asignarPartidosDeFaseConFiltro] Partido ${partidoValido.id} ASIGNADO correctamente`);
    }
  }

  /**
   * Verifica que los partidos origen (padre) ya tengan fecha asignada.
   * Calcula hora mínima de descanso SOLO si origen y destino son mismo día.
   * Si son días diferentes, no hay restricción de hora (puede ser primer slot del día).
   */
  private async verificarOrigenAsignado(
    matchId: string,
    diaFecha: string
  ): Promise<{ puedeAsignar: boolean; horaMinima?: string }> {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      select: {
        partidoOrigen1Id: true,
        partidoOrigen2Id: true,
      },
    });

    if (!match) {
      // console.log(`[verificarOrigenAsignado] Match ${matchId} no encontrado`);
      return { puedeAsignar: true };
    }

    // console.log(`[verificarOrigenAsignado] Match ${matchId}: origen1=${match.partidoOrigen1Id}, origen2=${match.partidoOrigen2Id}, diaFecha=${diaFecha}`);

    let horaMaximaFinMinutos = 0;
    let todosLosOrigenesAsignados = true;
    let algunoMismoDia = false;

    // Verificar origen 1
    if (match.partidoOrigen1Id) {
      const origen1 = await this.prisma.match.findUnique({
        where: { id: match.partidoOrigen1Id },
        select: { fechaProgramada: true, horaProgramada: true, esBye: true },
      });

      // console.log(`[verificarOrigenAsignado] Origen1 ${match.partidoOrigen1Id}: fecha=${origen1?.fechaProgramada}, hora=${origen1?.horaProgramada}, esBye=${origen1?.esBye}`);

      if (!origen1?.fechaProgramada) {
        // Si es BYE sin fecha, no bloquea la asignación (no aplica descanso)
        if (origen1?.esBye) {
          // console.log(`[verificarOrigenAsignado] Origen1 es BYE sin fecha - no bloquea`);
        } else {
          // console.log(`[verificarOrigenAsignado] Origen1 NO tiene fecha asignada`);
          todosLosOrigenesAsignados = false;
        }
      } else if (origen1.fechaProgramada === diaFecha && origen1.horaProgramada) {
        // Origen es mismo día - calcular hora fin + 2h descanso
        algunoMismoDia = true;
        const horaFinMinutos = horaAMinutos(origen1.horaProgramada) + 70 + 120; // slot + 2h
        // console.log(`[verificarOrigenAsignado] Origen1 MISMO DIA. Hora fin calculada: ${minutosAHora(horaFinMinutos)} (${horaFinMinutos} min)`);
        if (horaFinMinutos > horaMaximaFinMinutos) {
          horaMaximaFinMinutos = horaFinMinutos;
        }
      } else {
        // console.log(`[verificarOrigenAsignado] Origen1 dia diferente: ${origen1.fechaProgramada} vs ${diaFecha}`);
      }
    }

    // Verificar origen 2
    if (match.partidoOrigen2Id) {
      const origen2 = await this.prisma.match.findUnique({
        where: { id: match.partidoOrigen2Id },
        select: { fechaProgramada: true, horaProgramada: true, esBye: true },
      });

      // console.log(`[verificarOrigenAsignado] Origen2 ${match.partidoOrigen2Id}: fecha=${origen2?.fechaProgramada}, hora=${origen2?.horaProgramada}, esBye=${origen2?.esBye}`);

      if (!origen2?.fechaProgramada) {
        // Si es BYE sin fecha, no bloquea la asignación (no aplica descanso)
        if (origen2?.esBye) {
          // console.log(`[verificarOrigenAsignado] Origen2 es BYE sin fecha - no bloquea`);
        } else {
          // console.log(`[verificarOrigenAsignado] Origen2 NO tiene fecha asignada`);
          todosLosOrigenesAsignados = false;
        }
      } else if (origen2.fechaProgramada === diaFecha && origen2.horaProgramada) {
        // Origen es mismo día - calcular hora fin + 2h descanso
        algunoMismoDia = true;
        const horaFinMinutos = horaAMinutos(origen2.horaProgramada) + 70 + 120; // slot + 2h
        // console.log(`[verificarOrigenAsignado] Origen2 MISMO DIA. Hora fin calculada: ${minutosAHora(horaFinMinutos)} (${horaFinMinutos} min)`);
        if (horaFinMinutos > horaMaximaFinMinutos) {
          horaMaximaFinMinutos = horaFinMinutos;
        }
      } else {
        // console.log(`[verificarOrigenAsignado] Origen2 dia diferente: ${origen2.fechaProgramada} vs ${diaFecha}`);
      }
    }

    if (!todosLosOrigenesAsignados) {
      // console.log(`[verificarOrigenAsignado] Resultado: NO puede asignar (faltan origenes)`);
      return { puedeAsignar: false };
    }

    // Si algún origen es mismo día, retornar hora mínima calculada
    if (algunoMismoDia && horaMaximaFinMinutos > 0) {
      // console.log(`[verificarOrigenAsignado] Resultado: horaMinima=${minutosAHora(horaMaximaFinMinutos)}`);
      return {
        puedeAsignar: true,
        horaMinima: minutosAHora(horaMaximaFinMinutos),
      };
    }

    // Si todos los orígenes son días anteriores, sin restricción de hora
    // console.log(`[verificarOrigenAsignado] Resultado: puedeAsignar sin restriccion (origenes en dias anteriores)`);
    return { puedeAsignar: true };
  }

  /**
   * Obtiene las restricciones de descanso para un partido.
   * Combina: 
   * - Descanso por pareja individual (si tiene inscripciones)
   * - Descanso por origen (si no tiene inscripciones definidas)
   */
  private async obtenerRestriccionesDescanso(
    partido: any,
    dia: any,
    ultimoPartidoPorPareja: Map<string, { fecha: string; horaFin: string }>,
  ): Promise<{
    horaMinima?: string;
    fechaMinima?: string;
    puedeAsignar: boolean;
  }> {
    const insc1 = partido.inscripcion1Id;
    const insc2 = partido.inscripcion2Id;

    // CASO A: Partido con ambas inscripciones definidas
    // → Validar descanso por tracker individual de cada pareja
    if (insc1 && insc2) {
      let horaMinimaGlobal: number | null = null;

      const ult1 = ultimoPartidoPorPareja.get(insc1);
      if (ult1?.fecha === dia.fecha) {
        horaMinimaGlobal = horaAMinutos(ult1.horaFin) + 120;
      }

      const ult2 = ultimoPartidoPorPareja.get(insc2);
      if (ult2?.fecha === dia.fecha) {
        const horaMinima2 = horaAMinutos(ult2.horaFin) + 120;
        if (!horaMinimaGlobal || horaMinima2 > horaMinimaGlobal) {
          horaMinimaGlobal = horaMinima2;
        }
      }

      if (horaMinimaGlobal) {
        return {
          horaMinima: minutosAHora(horaMinimaGlobal),
          fechaMinima: dia.fecha,
          puedeAsignar: true,
        };
      }

      return { puedeAsignar: true };
    }

    // CASO B: Partido SIN inscripciones definidas (OCTAVOS, CUARTOS, etc.)
    // → Verificar origen y calcular hora mínima SOLO si es mismo día
    const resultadoOrigen = await this.verificarOrigenAsignado(partido.id, dia.fecha);
    
    return {
      puedeAsignar: resultadoOrigen.puedeAsignar,
      horaMinima: resultadoOrigen.horaMinima,
      fechaMinima: resultadoOrigen.horaMinima ? dia.fecha : undefined,
    };
  }

  /**
   * Helper: Intenta asignar un slot específico a un partido
   * Usa restricciones de descanso por pareja y por origen
   */
  private async intentarAsignarSlot(
    partido: any,
    dia: any,
    slotsDelDia: any[],
    slotsUsados: Set<number>,
    ultimoPartidoPorPareja: Map<string, { fecha: string; horaFin: string }>,
    ultimaHoraFinDelDia: { value: string | null },
    partidosAsignados: Set<string>,
    distribucionPorDia: Record<string, number>,
  ): Promise<boolean> {
    const insc1 = partido.inscripcion1Id;
    const insc2 = partido.inscripcion2Id;

    // console.log(`[intentarAsignarSlot] Partido ${partido.id} (${partido.ronda}): insc1=${insc1}, insc2=${insc2}, dia=${dia.fecha}`);

    // Obtener restricciones de descanso (por pareja o por origen)
    const restricciones = await this.obtenerRestriccionesDescanso(
      partido, dia, ultimoPartidoPorPareja
    );

    // console.log(`[intentarAsignarSlot] Restricciones: puedeAsignar=${restricciones.puedeAsignar}, horaMinima=${restricciones.horaMinima}, fechaMinima=${restricciones.fechaMinima}`);

    // Si el partido origen no está asignado todavía, no podemos asignar este partido
    if (!restricciones.puedeAsignar) {
      // console.log(`[intentarAsignarSlot] Partido ${partido.id} NO puede asignarse: origen no tiene fecha asignada`);
      return false;
    }

    for (let i = 0; i < slotsDelDia.length; i++) {
      if (slotsUsados.has(i)) continue;
      
      const slot = slotsDelDia[i];
      
      // console.log(`[intentarAsignarSlot] Evaluando slot ${i}: ${slot.horaInicio}-${slot.horaFin}`);

      // Validar fecha mínima (por origen - partido padre en día anterior)
      if (restricciones.fechaMinima && slot.fecha < restricciones.fechaMinima) {
        // console.log(`[intentarAsignarSlot] Slot ${i} RECHAZADO: fecha ${slot.fecha} < fechaMinima ${restricciones.fechaMinima}`);
        continue;
      }

      // Validar hora mínima (por pareja o por origen)
      if (restricciones.horaMinima && horaAMinutos(slot.horaInicio) < horaAMinutos(restricciones.horaMinima)) {
        // console.log(`[intentarAsignarSlot] Slot ${i} RECHAZADO: hora ${slot.horaInicio} (${horaAMinutos(slot.horaInicio)}) < horaMinima ${restricciones.horaMinima} (${horaAMinutos(restricciones.horaMinima)})`);
        continue;
      }
      
      // console.log(`[intentarAsignarSlot] Slot ${i} ACEPTADO: ${slot.horaInicio}-${slot.horaFin}`);

      // Verificar descanso 2h por pareja (backup adicional para parejas con inscripciones)
      if (insc1 && ultimoPartidoPorPareja.has(insc1)) {
        const ult = ultimoPartidoPorPareja.get(insc1)!;
        if (ult.fecha === dia.fecha) {
          const valido = this.descansoCalculator.validarSlotConDescanso(
            { fecha: dia.fecha, horaInicio: slot.horaInicio, horaFin: slot.horaFin },
            { fecha: ult.fecha, horaInicio: ult.horaFin, horaFin: ult.horaFin },
            120
          ).valido;
          if (!valido) continue;
        }
      }

      if (insc2 && ultimoPartidoPorPareja.has(insc2)) {
        const ult = ultimoPartidoPorPareja.get(insc2)!;
        if (ult.fecha === dia.fecha) {
          const valido = this.descansoCalculator.validarSlotConDescanso(
            { fecha: dia.fecha, horaInicio: slot.horaInicio, horaFin: slot.horaFin },
            { fecha: ult.fecha, horaInicio: ult.horaFin, horaFin: ult.horaFin },
            120
          ).valido;
          if (!valido) continue;
        }
      }

      // ASIGNAR
      slotsUsados.add(i);
      
      await this.prisma.torneoSlot.update({
        where: { id: slot.id },
        data: { estado: 'OCUPADO', matchId: partido.id },
      });

      await this.prisma.match.update({
        where: { id: partido.id },
        data: {
          fechaProgramada: dia.fecha,
          horaProgramada: slot.horaInicio,
          torneoCanchaId: slot.torneoCanchaId,
        },
      });

      // Actualizar trackers (solo por pareja, no global)
      if (insc1) {
        ultimoPartidoPorPareja.set(insc1, { fecha: dia.fecha, horaFin: slot.horaFin });
      }
      if (insc2) {
        ultimoPartidoPorPareja.set(insc2, { fecha: dia.fecha, horaFin: slot.horaFin });
      }

      partidosAsignados.add(partido.id);
      distribucionPorDia[dia.fecha] = (distribucionPorDia[dia.fecha] || 0) + 1;
      
      return true;
    }
    
    return false;
  }
}
