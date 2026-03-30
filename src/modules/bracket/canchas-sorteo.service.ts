import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DateService } from '../../common/services/date.service';
import { BracketService } from './bracket.service';
import { DescansoCalculatorService } from '../programacion/descanso-calculator.service';
import { horaAMinutos } from '../../common/utils/time-helpers';
import {
  ConfigurarFinalesDto,
  ConfigurarDiaJuegoDto,
  CerrarInscripcionesSortearDto,
  CalculoSlotsResponse,
  SorteoMasivoResponse,
} from './dto/canchas-sorteo.dto';
import { FaseBracket } from './dto/generate-bracket.dto';
import { CategoriaEstado, FixtureVersionEstado } from '@prisma/client';

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
export class CanchasSorteoService {
  constructor(
    private prisma: PrismaService,
    private dateService: DateService,
    private bracketService: BracketService,
    private descansoCalculator: DescansoCalculatorService,
  ) {}

  private obtenerFasesParaDia(fecha: string): FaseBracket[] {
    const [year, month, day] = fecha.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    const diaSemana = date.getUTCDay();
    
    switch (diaSemana) {
      case 4: case 5: return [FaseBracket.ZONA, FaseBracket.REPECHAJE];
      case 6: return [FaseBracket.OCTAVOS, FaseBracket.CUARTOS];
      case 0: return [FaseBracket.SEMIS, FaseBracket.FINAL];
      default: return [FaseBracket.ZONA];
    }
  }

  async configurarFinales(dto: ConfigurarFinalesDto) {
    // ... mantener implementación existente ...
  }

  async configurarDiaJuego(dto: ConfigurarDiaJuegoDto) {
    // ... mantener implementación existente ...
  }

  async obtenerCanchas(tournamentId: string) {
    // ... mantener implementación existente ...
  }

  async obtenerConfiguracion(tournamentId: string) {
    const [torneo, disponibilidadDias, torneoCanchas] = await Promise.all([
      this.prisma.tournament.findUnique({ where: { id: tournamentId } }),
      this.prisma.torneoDisponibilidadDia.findMany({
        where: { tournamentId },
        include: { slots: true },
        orderBy: { fecha: 'asc' },
      }),
      this.prisma.torneoCancha.findMany({
        where: { tournamentId },
        include: { sedeCancha: { include: { sede: true } } },
      }),
    ]);

    if (!torneo) throw new NotFoundException('Torneo no encontrado');

    return {
      success: true,
      data: {
        torneo: {
          id: torneo.id,
          nombre: torneo.nombre,
          fechaInicio: torneo.fechaInicio,
          fechaFin: torneo.fechaFin,
          fechaFinales: torneo.fechaFinales,
          horaInicioFinales: torneo.horaInicioFinales,
          horaFinFinales: torneo.horaFinFinales,
        },
        dias: disponibilidadDias.map(d => ({
          id: d.id,
          fecha: d.fecha,
          horaInicio: d.horaInicio,
          horaFin: d.horaFin,
          fasesPermitidas: d.fasesPermitidas,
          minutosSlot: d.minutosSlot,
          slots: d.slots.length,
        })),
        canchas: torneoCanchas.map(c => ({
          id: c.id,
          sede: c.sedeCancha.sede.nombre,
          cancha: c.sedeCancha.nombre,
        })),
      },
    };
  }

  async eliminarDia(diaId: string) {
    const dia = await this.prisma.torneoDisponibilidadDia.findUnique({
      where: { id: diaId },
      include: { slots: true },
    });

    if (!dia) throw new NotFoundException('Día no encontrado');

    const slotsOcupados = dia.slots.filter(s => s.estado === 'OCUPADO' || s.matchId !== null);
    if (slotsOcupados.length > 0) {
      throw new BadRequestException(`No se puede eliminar: tiene ${slotsOcupados.length} partidos programados`);
    }

    await this.prisma.torneoDisponibilidadDia.delete({ where: { id: diaId } });

    return { success: true, message: 'Día eliminado correctamente' };
  }

  async calcularSlotsNecesarios(
    tournamentId: string,
    categoriasIds?: string[],
  ): Promise<CalculoSlotsResponse> {
    const whereClause: any = { tournamentId };
    if (categoriasIds && categoriasIds.length > 0) {
      whereClause.id = { in: categoriasIds };
    }
    
    const categorias = await this.prisma.tournamentCategory.findMany({
      where: whereClause,
      include: { category: true },
    });

    const inscripciones = await this.prisma.inscripcion.findMany({
      where: { tournamentId, estado: 'CONFIRMADA' },
    });

    // Obtener slots disponibles
    const slotsLibres = await this.prisma.torneoSlot.count({
      where: { 
        disponibilidad: { tournamentId },
        estado: 'LIBRE',
      },
    });

    let totalSlotsNecesarios = 0;
    const detallePorCategoria = categorias.map(cat => {
      const inscripcionesCat = inscripciones.filter(i => i.categoryId === cat.categoryId);
      const parejas = inscripcionesCat.length;
      const calculo = this.bracketService.calcularSlotsNecesarios(parejas);
      
      totalSlotsNecesarios += calculo.totalPartidos;
      
      return {
        categoriaId: cat.id,
        nombre: cat.category.nombre,
        parejas,
        slotsNecesarios: calculo.totalPartidos,
        partidosPorFase: calculo.detallePorFase,
      };
    });

    const slotsFaltantes = Math.max(0, totalSlotsNecesarios - slotsLibres);
    const duracionPromedioMinutos = 90;
    const horasNecesarias = Math.ceil((totalSlotsNecesarios * duracionPromedioMinutos) / 60);
    const horasDisponibles = Math.ceil((slotsLibres * duracionPromedioMinutos) / 60);

    return {
      totalSlotsNecesarios,
      slotsDisponibles: slotsLibres,
      slotsFaltantes,
      horasNecesarias,
      horasDisponibles,
      duracionPromedioMinutos,
      detallePorCategoria,
      valido: slotsFaltantes === 0,
      mensaje: slotsFaltantes > 0 ? `Faltan ${slotsFaltantes} slots` : undefined,
    };
  }

  async cerrarInscripcionesYsortear(dto: CerrarInscripcionesSortearDto): Promise<SorteoMasivoResponse> {
    const { tournamentId, categoriasIds } = dto;
    
    const estadoInicialCategorias = await this.prisma.tournamentCategory.findMany({
      where: { id: { in: categoriasIds } },
    });

    try {
      const resultado = await this.ejecutarSorteo(tournamentId, categoriasIds);
      return resultado;
    } catch (error) {
      console.error('[Sorteo] Error durante el sorteo, iniciando rollback...', error);
      await this.rollbackSorteo(tournamentId, estadoInicialCategorias);
      throw error;
    }
  }

  private async ejecutarSorteo(tournamentId: string, categoriasIds: string[]): Promise<SorteoMasivoResponse> {
    const categoriasData = await this.obtenerCategoriasData(tournamentId, categoriasIds);
    
    for (const catData of categoriasData) {
      if (catData.inscripciones.length < 8) {
        throw new BadRequestException(
          `La categoría ${catData.nombre} tiene solo ${catData.inscripciones.length} inscripciones. Mínimo: 8`
        );
      }
    }

    const diasConfig = await this.prisma.torneoDisponibilidadDia.findMany({
      where: { tournamentId },
      orderBy: [{ fecha: 'asc' }, { horaInicio: 'asc' }],
    });

    if (diasConfig.length === 0) {
      throw new BadRequestException('No hay días configurados para el torneo');
    }

    // 1. Cerrar inscripciones y generar brackets
    await this.cerrarInscripcionesYGenerarBrackets(categoriasData);

    // 2. Guardar brackets en BD (sin slots)
    for (const catData of categoriasData) {
      const config = (catData as any).bracketConfig;
      const partidos = (catData as any).bracketPartidos;
      
      if (config && partidos) {
        const fixtureVersionId = await this.bracketService.guardarBracket(
          catData.categoria.id, config, partidos, catData.inscripciones, [],
        );
        
        await this.prisma.tournamentCategory.update({
          where: { id: catData.categoria.id },
          data: { fixtureVersionId },
        });
        
        catData.categoria.fixtureVersionId = fixtureVersionId;
      }
    }

    // 3. Asignar slots
    const asignaciones = await this.asignarSlots(tournamentId, categoriasData, diasConfig);

    // 4. Validar
    await this.validarTodosLosPartidosAsignados(tournamentId, categoriasData);

    return {
      success: true,
      message: `Sorteo completado. ${asignaciones.totalPartidosAsignados} partidos asignados.`,
      categoriasSorteadas: categoriasData.map(c => ({
        categoriaId: c.categoria.id,
        nombre: c.nombre,
        fixtureVersionId: c.categoria.fixtureVersionId || '',
        totalPartidos: c.inscripciones.length,
        slotsReservados: asignaciones.distribucionPorDia[Object.keys(asignaciones.distribucionPorDia)[0]] || 0,
      })),
      slotsTotalesReservados: asignaciones.totalPartidosAsignados,
      distribucionPorDia: Object.entries(asignaciones.distribucionPorDia).map(([fecha, slots]) => ({
        fecha,
        slotsReservados: slots as number,
        categorias: categoriasData.map(c => c.nombre),
      })),
    };
  }

  private async obtenerCategoriasData(tournamentId: string, categoriasIds: string[]) {
    const categorias = await this.prisma.tournamentCategory.findMany({
      where: { id: { in: categoriasIds }, tournamentId },
      include: { category: true },
    });

    const inscripciones = await this.prisma.inscripcion.findMany({
      where: {
        tournamentId,
        categoryId: { in: categorias.map(c => c.categoryId) },
        estado: 'CONFIRMADA',
      },
    });

    return categorias.map(cat => ({
      categoria: cat,
      nombre: cat.category.nombre,
      inscripciones: inscripciones.filter(i => i.categoryId === cat.categoryId),
    }));
  }

  private async cerrarInscripcionesYGenerarBrackets(
    categoriasData: Array<{ categoria: any; nombre: string; inscripciones: any[] }>,
  ) {
    for (const catData of categoriasData) {
      await this.prisma.tournamentCategory.update({
        where: { id: catData.categoria.id },
        data: { estado: CategoriaEstado.INSCRIPCIONES_CERRADAS },
      });

      if (catData.categoria.fixtureVersionId) {
        await this.prisma.fixtureVersion.update({
          where: { id: catData.categoria.fixtureVersionId },
          data: { estado: FixtureVersionEstado.ARCHIVADO, archivadoAt: new Date() },
        });
      }

      const resultado = await this.bracketService.generarBracket({
        tournamentCategoryId: catData.categoria.id,
        totalParejas: catData.inscripciones.length,
      });

      (catData as any).bracketConfig = resultado.config;
      (catData as any).bracketPartidos = resultado.partidos;
    }
  }

  /**
   * NUEVO ALGORITMO DE ASIGNACIÓN DE SLOTS
   * 
   * Reglas:
   * 1. Validación previa: verificar slots suficientes
   * 2. Prioridad: categorías con más inscriptos primero
   * 3. Round-robin por fase: una vuelta por categoría, repitiendo hasta vaciar
   * 4. Descanso: 3h entre partidos de la misma pareja (solo si es mismo día)
   * 5. BYE: no reciben slots
   * 6. Mensaje detallado si faltan slots
   */
  private async asignarSlots(
    tournamentId: string,
    categoriasData: Array<{ categoria: any; nombre: string; inscripciones: any[] }>,
    diasConfig: any[],
  ): Promise<{ totalPartidosAsignados: number; distribucionPorDia: Record<string, number> }> {
    
    // 1. VALIDACIÓN PREVIA
    await this.validarDisponibilidadSlots(tournamentId, categoriasData, diasConfig);

    const distribucionPorDia: Record<string, number> = {};
    const ultimoPartidoPorPareja = new Map<string, { fecha: string; horaFin: string }>();
    const partidosAsignados = new Set<string>();

    // 2. ORDENAR CATEGORÍAS: más inscriptos primero
    const categoriasOrdenadas = [...categoriasData].sort((a, b) => 
      b.inscripciones.length - a.inscripciones.length
    );

    const ordenFases = [
      FaseBracket.ZONA,
      FaseBracket.REPECHAJE,
      FaseBracket.OCTAVOS,
      FaseBracket.CUARTOS,
      FaseBracket.SEMIS,
      FaseBracket.FINAL,
    ];

    // 3. ASIGNAR POR DÍA
    for (const dia of diasConfig) {
      const fasesPermitidas = (dia.fasesPermitidas as string)?.split(',') as FaseBracket[] || 
        this.obtenerFasesParaDia(dia.fecha);

      if (fasesPermitidas.length === 0) continue;

      const slotsDelDia = await this.prisma.torneoSlot.findMany({
        where: { disponibilidadId: dia.id, estado: 'LIBRE' },
        orderBy: { horaInicio: 'asc' },
      });

      if (slotsDelDia.length === 0) continue;

      const slotsUsados = new Set<number>();

      // ROUND-ROBIN: repetir hasta que no haya más asignaciones
      let huboAsignaciones = true;
      while (huboAsignaciones) {
        huboAsignaciones = false;

        for (const fase of fasesPermitidas) {
          for (const catData of categoriasOrdenadas) {
            
            // Buscar siguiente partido sin asignar de esta fase/categoría
            const partido = await this.prisma.match.findFirst({
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
            });

            if (!partido) continue;

            // Buscar primer slot que cumpla descanso
            let slotAsignado = false;
            
            for (let i = 0; i < slotsDelDia.length; i++) {
              if (slotsUsados.has(i)) continue;
              
              const slot = slotsDelDia[i];
              const insc1 = partido.inscripcion1Id;
              const insc2 = partido.inscripcion2Id;

              // Verificar descanso 3h (solo si mismo día)
              let puedeJugar = true;
              
              if (insc1 && ultimoPartidoPorPareja.has(insc1)) {
                const ult = ultimoPartidoPorPareja.get(insc1)!;
                if (ult.fecha === dia.fecha) {
                  puedeJugar = this.descansoCalculator.validarSlotConDescanso(
                    { fecha: dia.fecha, horaInicio: slot.horaInicio, horaFin: slot.horaFin },
                    { fecha: ult.fecha, horaInicio: ult.horaFin, horaFin: ult.horaFin },
                    180
                  ).valido;
                  if (!puedeJugar) continue;
                }
              }

              if (insc2 && ultimoPartidoPorPareja.has(insc2)) {
                const ult = ultimoPartidoPorPareja.get(insc2)!;
                if (ult.fecha === dia.fecha) {
                  puedeJugar = this.descansoCalculator.validarSlotConDescanso(
                    { fecha: dia.fecha, horaInicio: slot.horaInicio, horaFin: slot.horaFin },
                    { fecha: ult.fecha, horaInicio: ult.horaFin, horaFin: ult.horaFin },
                    180
                  ).valido;
                  if (!puedeJugar) continue;
                }
              }

              // Asignar slot
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

              if (insc1) ultimoPartidoPorPareja.set(insc1, { fecha: dia.fecha, horaFin: slot.horaFin });
              if (insc2) ultimoPartidoPorPareja.set(insc2, { fecha: dia.fecha, horaFin: slot.horaFin });

              partidosAsignados.add(partido.id);
              distribucionPorDia[dia.fecha] = (distribucionPorDia[dia.fecha] || 0) + 1;
              huboAsignaciones = true;
              slotAsignado = true;
              break;
            }

            if (!slotAsignado) {
              // No hay slot para este partido hoy, continuará en siguiente día
              continue;
            }
          }
        }
      }
    }

    return {
      totalPartidosAsignados: partidosAsignados.size,
      distribucionPorDia,
    };
  }

  /**
   * Valida que haya suficientes slots antes de empezar
   */
  private async validarDisponibilidadSlots(
    tournamentId: string,
    categoriasData: Array<{ categoria: any; nombre: string; inscripciones: any[] }>,
    diasConfig: any[],
  ): Promise<void> {
    // Contar partidos por fase (excluyendo BYE)
    const partidosPorFase: Record<string, number> = {};
    
    for (const catData of categoriasData) {
      const partidos = await this.prisma.match.findMany({
        where: {
          fixtureVersionId: catData.categoria.fixtureVersionId,
          esBye: false,
        },
        select: { ronda: true },
      });
      
      for (const p of partidos) {
        partidosPorFase[p.ronda] = (partidosPorFase[p.ronda] || 0) + 1;
      }
    }

    // Verificar por día
    const faltantes: string[] = [];
    
    for (const dia of diasConfig) {
      const fasesPermitidas = (dia.fasesPermitidas as string)?.split(',') as FaseBracket[] || [];
      
      const slotsLibres = await this.prisma.torneoSlot.count({
        where: { disponibilidadId: dia.id, estado: 'LIBRE' },
      });

      const partidosNecesarios = fasesPermitidas.reduce((total, fase) => 
        total + (partidosPorFase[fase] || 0), 0
      );

      if (partidosNecesarios > slotsLibres) {
        const faltan = partidosNecesarios - slotsLibres;
        const horasNecesarias = Math.ceil(faltan * 1.5); // 1.5h por slot
        faltantes.push(
          `${dia.fecha}: faltan ${faltan} slots (${horasNecesarias}h) para ${fasesPermitidas.join(',')}`
        );
      }
    }

    if (faltantes.length > 0) {
      throw new BadRequestException(
        `Slots insuficientes:\n${faltantes.join('\n')}\n\nAgrega más canchas o días de juego.`
      );
    }
  }

  private async validarTodosLosPartidosAsignados(
    tournamentId: string,
    categoriasData: Array<{ categoria: any; nombre: string; inscripciones: any[] }>,
  ) {
    const fixtureVersionIds = categoriasData
      .map(c => c.categoria.fixtureVersionId)
      .filter(Boolean);

    if (fixtureVersionIds.length === 0) return;

    const totalPartidos = await this.prisma.match.count({
      where: { fixtureVersionId: { in: fixtureVersionIds } },
    });

    const partidosConSlot = await this.prisma.match.count({
      where: {
        fixtureVersionId: { in: fixtureVersionIds },
        torneoCanchaId: { not: null },
        fechaProgramada: { not: null },
      },
    });

    if (partidosConSlot < totalPartidos) {
      const sinSlot = totalPartidos - partidosConSlot;
      throw new BadRequestException(
        `No se pudieron asignar ${sinSlot} partidos. Agrega más días de juego.`
      );
    }
  }

  private async rollbackSorteo(tournamentId: string, estadoInicialCategorias: any[]) {
    const categoriasActuales = await this.prisma.tournamentCategory.findMany({
      where: { id: { in: estadoInicialCategorias.map(c => c.id) } },
    });

    for (const cat of estadoInicialCategorias) {
      await this.prisma.tournamentCategory.update({
        where: { id: cat.id },
        data: { 
          estado: cat.estado,
          fixtureVersionId: cat.fixtureVersionId,
        },
      });
    }

    await this.prisma.torneoSlot.updateMany({
      where: {
        disponibilidad: { tournamentId },
        estado: 'RESERVADO',
      },
      data: { estado: 'LIBRE', matchId: null },
    });

    const fixtureVersionIds = categoriasActuales
      .filter(c => c.fixtureVersionId)
      .map(c => c.fixtureVersionId);

    if (fixtureVersionIds.length > 0) {
      await this.prisma.match.deleteMany({
        where: { fixtureVersionId: { in: fixtureVersionIds } },
      });
    }
  }

  async reSortearCategoria(categoriaId: string) {
    // ... mantener implementación existente ...
  }
}
