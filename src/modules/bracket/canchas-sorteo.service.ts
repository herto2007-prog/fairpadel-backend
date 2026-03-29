import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DateService } from '../../common/services/date.service';
import { BracketService } from './bracket.service';
import { DescansoCalculatorService } from '../programacion/descanso-calculator.service';
import { horaAMinutos, horaEsMayor, horaEsMayorOIgual } from '../../common/utils/time-helpers';
import {
  ConfigurarFinalesDto,
  ConfigurarDiaJuegoDto,
  CerrarInscripcionesSortearDto,
  CalculoSlotsResponse,
  SorteoMasivoResponse,
} from './dto/canchas-sorteo.dto';
import { FaseBracket } from './dto/generate-bracket.dto';
import { Prisma, CategoriaEstado, FixtureVersionEstado } from '@prisma/client';

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

  /**
   * Determina qué fases pueden jugarse en un día según su fecha
   * Lógica paraguaya estándar: Jueves/Viernes=Zona/Repechaje, Sábado=Octavos/Cuartos, Domingo=Semis/Final
   */
  private obtenerFasesParaDia(fecha: string): FaseBracket[] {
    // Usar UTC para calcular día de semana, evitando problemas de timezone
    const [year, month, day] = fecha.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    const diaSemana = date.getUTCDay();
    
    switch (diaSemana) {
      case 4: // Jueves
      case 5: // Viernes
        return [FaseBracket.ZONA, FaseBracket.REPECHAJE];
      case 6: // Sábado
        return [FaseBracket.OCTAVOS, FaseBracket.CUARTOS];
      case 0: // Domingo
        return [FaseBracket.SEMIS, FaseBracket.FINAL];
      default:
        return [FaseBracket.ZONA];
    }
  }

  /**
   * PASO 1.a: Configurar horarios de semifinales y finales
   */
  async configurarFinales(dto: ConfigurarFinalesDto) {
    const torneo = await this.prisma.tournament.findUnique({
      where: { id: dto.tournamentId },
    });

    if (!torneo) {
      throw new NotFoundException('Torneo no encontrado');
    }

    if (!torneo.fechaFinales) {
      throw new BadRequestException('El torneo no tiene fecha de finales configurada');
    }

    // Validar que los horarios no se solapen (comparación numérica de horas)
    if (horaAMinutos(dto.horaFinSemifinales) > horaAMinutos(dto.horaInicioFinales)) {
      throw new BadRequestException('El horario de semifinales no puede terminar después de que empiecen las finales');
    }

    await this.prisma.tournament.update({
      where: { id: dto.tournamentId },
      data: {
        horaInicioFinales: dto.horaInicioFinales,
        horaFinFinales: dto.horaFinFinales,
        canchasFinales: dto.canchasFinalesIds,
      },
    });

    const fechaFinales = torneo.fechaFinales;
    
    const disponibilidad = await this.prisma.torneoDisponibilidadDia.upsert({
      where: {
        tournamentId_fecha_horaInicio: {
          tournamentId: dto.tournamentId,
          fecha: torneo.fechaFinales,
          horaInicio: dto.horaInicioSemifinales,
        },
      },
      update: {
        horaFin: dto.horaFinFinales,
        minutosSlot: 90,
      },
      create: {
        tournamentId: dto.tournamentId,
        fecha: torneo.fechaFinales,
        horaInicio: dto.horaInicioSemifinales,
        horaFin: dto.horaFinFinales,
        minutosSlot: 90,
      },
    });

    const slotsSemifinales = await this.generarSlotsParaDiaConFase(
      disponibilidad.id,
      dto.canchasSemifinalesIds,
      dto.horaInicioSemifinales,
      dto.horaFinSemifinales,
      90,
      'SEMIFINAL',
    );

    const slotsFinales = await this.generarSlotsParaDiaConFase(
      disponibilidad.id,
      dto.canchasFinalesIds,
      dto.horaInicioFinales,
      dto.horaFinFinales,
      90,
      'FINAL',
    );

    return {
      success: true,
      message: 'Configuración guardada',
      data: {
        semifinales: {
          horaInicio: dto.horaInicioSemifinales,
          horaFin: dto.horaFinSemifinales,
          canchas: dto.canchasSemifinalesIds,
          slotsGenerados: slotsSemifinales,
        },
        finales: {
          horaInicio: dto.horaInicioFinales,
          horaFin: dto.horaFinFinales,
          canchas: dto.canchasFinalesIds,
          slotsGenerados: slotsFinales,
        },
        fechaFinales,
        diaId: disponibilidad.id,
        totalSlots: slotsSemifinales + slotsFinales,
      },
    };
  }

  /**
   * PASO 1.b: Configurar días de juego
   */
  async configurarDiaJuego(dto: ConfigurarDiaJuegoDto) {
    const torneo = await this.prisma.tournament.findUnique({
      where: { id: dto.tournamentId },
    });

    if (!torneo) {
      throw new NotFoundException('Torneo no encontrado');
    }

    const fecha = dto.fecha;
    const fasesPermitidas = dto.fasesPermitidas?.join(',') || 
      this.obtenerFasesParaDia(fecha).join(',');
    
    const disponibilidad = await this.prisma.torneoDisponibilidadDia.upsert({
      where: {
        tournamentId_fecha_horaInicio: {
          tournamentId: dto.tournamentId,
          fecha: fecha,
          horaInicio: dto.horaInicio,
        },
      },
      update: {
        horaFin: dto.horaFin,
        minutosSlot: dto.minutosSlot,
        fasesPermitidas,
      },
      create: {
        tournamentId: dto.tournamentId,
        fecha: fecha,
        horaInicio: dto.horaInicio,
        horaFin: dto.horaFin,
        minutosSlot: dto.minutosSlot,
        fasesPermitidas,
      },
    });

    const slotsGenerados = await this.generarSlotsParaDia(
      disponibilidad.id,
      dto.canchasIds,
      dto.horaInicio,
      dto.horaFin,
      dto.minutosSlot,
    );

    return {
      success: true,
      message: `Día configurado con ${slotsGenerados} slots`,
      data: {
        disponibilidadId: disponibilidad.id,
        fecha: dto.fecha,
        horaInicio: dto.horaInicio,
        horaFin: dto.horaFin,
        minutosSlot: dto.minutosSlot,
        fasesPermitidas,
        slotsGenerados,
        canchas: dto.canchasIds.length,
      },
    };
  }

  /**
   * Genera slots (TorneoSlot) para un día específico
   */
  private async generarSlotsParaDia(
    disponibilidadId: string,
    canchasIds: string[],
    horaInicio: string,
    horaFin: string,
    minutosSlot: number,
  ): Promise<number> {
    const [iniHora, iniMin] = horaInicio.split(':').map(Number);
    const [finHora, finMin] = horaFin.split(':').map(Number);
    const minutosTotales = (finHora * 60 + finMin) - (iniHora * 60 + iniMin);
    const slotsPorCancha = Math.ceil(minutosTotales / minutosSlot);

    let slotsGenerados = 0;

    for (const canchaId of canchasIds) {
      for (let i = 0; i < slotsPorCancha; i++) {
        const minutosInicio = (iniHora * 60 + iniMin) + (i * minutosSlot);
        const minutosFin = minutosInicio + minutosSlot;
        
        const slotInicio = `${String(Math.floor(minutosInicio / 60)).padStart(2, '0')}:${String(minutosInicio % 60).padStart(2, '0')}`;
        let slotFin = `${String(Math.floor(minutosFin / 60)).padStart(2, '0')}:${String(minutosFin % 60).padStart(2, '0')}`;
        
        if (horaAMinutos(slotFin) >= 24 * 60) {
          slotFin = '23:59';
        }

        await this.prisma.torneoSlot.upsert({
          where: {
            disponibilidadId_torneoCanchaId_horaInicio: {
              disponibilidadId,
              torneoCanchaId: canchaId,
              horaInicio: slotInicio,
            },
          },
          update: {
            horaFin: slotFin,
            estado: 'LIBRE',
          },
          create: {
            disponibilidadId,
            torneoCanchaId: canchaId,
            horaInicio: slotInicio,
            horaFin: slotFin,
            estado: 'LIBRE',
          },
        });
        slotsGenerados++;
      }
    }

    return slotsGenerados;
  }

  /**
   * Genera slots marcados con una fase específica
   */
  private async generarSlotsParaDiaConFase(
    disponibilidadId: string,
    canchasIds: string[],
    horaInicio: string,
    horaFin: string,
    minutosSlot: number,
    fase: string,
  ): Promise<number> {
    const [iniHora, iniMin] = horaInicio.split(':').map(Number);
    const [finHora, finMin] = horaFin.split(':').map(Number);
    const minutosTotales = (finHora * 60 + finMin) - (iniHora * 60 + iniMin);
    const slotsPorCancha = Math.ceil(minutosTotales / minutosSlot);

    let slotsGenerados = 0;

    for (const canchaId of canchasIds) {
      for (let i = 0; i < slotsPorCancha; i++) {
        const minutosInicio = (iniHora * 60 + iniMin) + (i * minutosSlot);
        const minutosFin = minutosInicio + minutosSlot;
        
        const slotInicio = `${String(Math.floor(minutosInicio / 60)).padStart(2, '0')}:${String(minutosInicio % 60).padStart(2, '0')}`;
        const slotFin = `${String(Math.floor(minutosFin / 60)).padStart(2, '0')}:${String(minutosFin % 60).padStart(2, '0')}`;

        await this.prisma.torneoSlot.upsert({
          where: {
            disponibilidadId_torneoCanchaId_horaInicio: {
              disponibilidadId,
              torneoCanchaId: canchaId,
              horaInicio: slotInicio,
            },
          },
          update: {
            horaFin: slotFin,
            estado: 'LIBRE',
            fase,
          },
          create: {
            disponibilidadId,
            torneoCanchaId: canchaId,
            horaInicio: slotInicio,
            horaFin: slotFin,
            estado: 'LIBRE',
            fase,
          },
        });
        slotsGenerados++;
      }
    }

    return slotsGenerados;
  }

  /**
   * PASO 2: Calcular slots necesarios para cerrar inscripciones
   */
  async calcularSlotsNecesarios(
    tournamentId: string,
    categoriasIds: string[],
  ): Promise<CalculoSlotsResponse> {
    const categorias = await this.prisma.tournamentCategory.findMany({
      where: {
        id: { in: categoriasIds },
        tournamentId,
      },
    });
    
    const inscripciones = await this.prisma.inscripcion.findMany({
      where: {
        tournamentId,
        estado: 'CONFIRMADA',
        categoryId: { in: categorias.map(c => c.categoryId) },
      },
    });
    
    const inscripcionesPorCategoria = new Map<string, typeof inscripciones>();
    for (const cat of categorias) {
      inscripcionesPorCategoria.set(
        cat.id,
        inscripciones.filter(i => i.categoryId === cat.categoryId)
      );
    }

    const categoriasBase = await this.prisma.category.findMany({
      where: {
        id: { in: categorias.map(c => c.categoryId) },
      },
    });
    
    const categoriaMap = new Map(categoriasBase.map(c => [c.id, c]));
    
    const detallePorCategoria = categorias.map((cat) => {
      const inscripcionesCat = inscripcionesPorCategoria.get(cat.id) || [];
      const parejas = inscripcionesCat.length;
      const calculo = this.bracketService.calcularSlotsNecesarios(parejas);
      const categoriaBase = categoriaMap.get(cat.categoryId);
      
      return {
        categoriaId: cat.id,
        nombre: categoriaBase?.nombre || 'Categoría',
        parejas,
        slotsNecesarios: calculo.totalPartidos,
        partidosPorFase: calculo.detallePorFase,
      };
    });

    const totalSlotsNecesarios = detallePorCategoria.reduce(
      (sum, cat) => sum + cat.slotsNecesarios,
      0,
    );

    const slotsLibres = await this.prisma.torneoSlot.findMany({
      where: {
        disponibilidad: { tournamentId },
        estado: 'LIBRE',
      },
    });

    const totalSlotsLibres = slotsLibres.length;
    const slotsFaltantes = Math.max(0, totalSlotsNecesarios - totalSlotsLibres);

    const response: CalculoSlotsResponse = {
      totalSlotsNecesarios,
      slotsDisponibles: totalSlotsLibres,
      slotsFaltantes,
      horasNecesarias: Math.ceil(totalSlotsNecesarios * 1.5),
      horasDisponibles: Math.ceil(totalSlotsLibres * 1.5),
      duracionPromedioMinutos: 90,
      detallePorCategoria: detallePorCategoria.map(c => ({
        ...c,
        partidosPorFase: c.partidosPorFase || [],
      })),
      valido: slotsFaltantes === 0,
      mensaje: slotsFaltantes === 0 ? 'Slots suficientes' : `Faltan ${slotsFaltantes} slots`,
    };

    return response;
  }

  /**
   * Obtiene las canchas asignadas al torneo
   */
  async obtenerCanchas(tournamentId: string) {
    const torneoCanchas = await this.prisma.torneoCancha.findMany({
      where: { tournamentId },
      include: {
        sedeCancha: {
          include: {
            sede: true,
          },
        },
      },
      orderBy: {
        orden: 'asc',
      },
    });

    return {
      success: true,
      data: torneoCanchas.map(tc => ({
        id: tc.id,
        nombre: `Cancha ${tc.orden + 1}`,
        sede: tc.sedeCancha.sede.nombre,
        orden: tc.orden,
      })),
    };
  }

  /**
   * Obtiene configuración actual del torneo
   */
  async obtenerConfiguracion(tournamentId: string) {
    const [torneo, disponibilidadDias, torneoCanchas] = await Promise.all([
      this.prisma.tournament.findUnique({
        where: { id: tournamentId },
      }),
      this.prisma.torneoDisponibilidadDia.findMany({
        where: { tournamentId },
        include: { slots: true },
        orderBy: { fecha: 'asc' },
      }),
      this.prisma.torneoCancha.findMany({
        where: { tournamentId },
        include: {
          sedeCancha: {
            include: { sede: true },
          },
        },
      }),
    ]);

    if (!torneo) {
      throw new NotFoundException('Torneo no encontrado');
    }

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
          minutosSlot: d.minutosSlot,
          fasesPermitidas: d.fasesPermitidas,
          totalSlots: d.slots.length,
          slotsLibres: d.slots.filter(s => s.estado === 'LIBRE').length,
        })),
        canchas: torneoCanchas.map(tc => ({
          id: tc.id,
          nombre: `Cancha ${tc.orden + 1}`,
          sede: tc.sedeCancha.sede.nombre,
        })),
      },
    };
  }

  /**
   * Eliminar un día de juego y sus slots
   */
  async eliminarDia(diaId: string) {
    const dia = await this.prisma.torneoDisponibilidadDia.findUnique({
      where: { id: diaId },
      include: { slots: true },
    });

    if (!dia) {
      throw new NotFoundException('Día no encontrado');
    }

    // Verificar si hay slots ocupados
    const slotsOcupados = dia.slots.filter(s => s.estado === 'OCUPADO' || s.matchId !== null);
    if (slotsOcupados.length > 0) {
      throw new BadRequestException(
        `No se puede eliminar el día porque tiene ${slotsOcupados.length} partidos programados`
      );
    }

    await this.prisma.torneoDisponibilidadDia.delete({
      where: { id: diaId },
    });

    return {
      success: true,
      message: 'Día eliminado correctamente',
    };
  }

  /**
   * PASO 2: Cerrar inscripciones y sortear (con asignación de slots)
   * 
   * ALGORITMO DE DESCANSO:
   * - 4 horas de descanso entre fases del mismo día
   * - 4 horas de descanso entre partidos de la misma pareja
   * - Si no cabe en el día, pasa al siguiente día disponible
   */
  async cerrarInscripcionesYsortear(
    dto: CerrarInscripcionesSortearDto,
  ): Promise<SorteoMasivoResponse> {
    const { tournamentId, categoriasIds } = dto;

    // Guardar estado inicial para rollback si es necesario
    const estadoInicialCategorias = await this.prisma.tournamentCategory.findMany({
      where: { id: { in: categoriasIds } },
    });

    try {
      const resultado = await this.ejecutarSorteo(tournamentId, categoriasIds);
      return resultado;
    } catch (error) {
      // Rollback: restaurar estado inicial
      console.error('[Sorteo] Error durante el sorteo, iniciando rollback...', error);
      
      await this.rollbackSorteo(tournamentId, estadoInicialCategorias);
      
      throw error;
    }
  }

  /**
   * Ejecuta el sorteo propiamente dicho
   */
  private async ejecutarSorteo(
    tournamentId: string,
    categoriasIds: string[],
  ): Promise<SorteoMasivoResponse> {
    // Obtener información completa de categorías
    const categoriasData = await this.obtenerCategoriasData(tournamentId, categoriasIds);
    
    // Validar que todas las categorías tienen inscripciones confirmadas
    for (const catData of categoriasData) {
      if (catData.inscripciones.length < 8) {
        throw new BadRequestException(
          `La categoría ${catData.nombre} tiene solo ${catData.inscripciones.length} inscripciones confirmadas. Mínimo requerido: 8`
        );
      }
    }

    // Obtener días configurados ordenados cronológicamente
    const diasConfig = await this.prisma.torneoDisponibilidadDia.findMany({
      where: { tournamentId },
      orderBy: [{ fecha: 'asc' }, { horaInicio: 'asc' }],
    });

    if (diasConfig.length === 0) {
      throw new BadRequestException('No hay días configurados para el torneo');
    }

    // Cerrar inscripciones y generar brackets
    await this.cerrarInscripcionesYGenerarBrackets(categoriasData);

    // Asignar slots a partidos
    const asignaciones = await this.asignarSlots(tournamentId, categoriasData, diasConfig);

    // Validar que todos los partidos tienen slot asignado
    await this.validarTodosLosPartidosAsignados(tournamentId, categoriasData);

    const response: SorteoMasivoResponse = {
      success: true,
      message: `Sorteo completado. ${asignaciones.totalPartidosAsignados} partidos asignados a slots.`,
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

    return response;
  }

  /**
   * Obtiene información completa de las categorías
   */
  private async obtenerCategoriasData(tournamentId: string, categoriasIds: string[]) {
    const categorias = await this.prisma.tournamentCategory.findMany({
      where: {
        id: { in: categoriasIds },
        tournamentId,
      },
      include: {
        category: true,
      },
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

  /**
   * Cierra inscripciones y genera brackets para todas las categorías
   */
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

      await this.bracketService.generarBracket({
        tournamentCategoryId: catData.categoria.id,
        totalParejas: catData.inscripciones.length,
      });

      const categoriaActualizada = await this.prisma.tournamentCategory.findUnique({
        where: { id: catData.categoria.id },
      });
      if (categoriaActualizada) {
        catData.categoria = categoriaActualizada;
      }
    }
  }

  /**
   * Asigna slots a partidos con descanso de 4 horas entre fases y entre partidos de la misma pareja
   */
  private async asignarSlots(
    tournamentId: string,
    categoriasData: Array<{ categoria: any; nombre: string; inscripciones: any[] }>,
    diasConfig: any[],
  ): Promise<{ totalPartidosAsignados: number; distribucionPorDia: Record<string, number> }> {
    const asignacionesPorCategoria = new Map<string, SlotReserva[]>();
    const distribucionPorDia: Record<string, number> = {};
    const ultimaHoraFinPorCategoriaFase: Record<string, string> = {};
    const ultimaHoraPorPareja = new Map<string, { fecha: string; horaFin: string }>();
    const partidosAsignados = new Set<string>();

    const ordenFases = [
      FaseBracket.ZONA,
      FaseBracket.REPECHAJE,
      FaseBracket.OCTAVOS,
      FaseBracket.CUARTOS,
      FaseBracket.SEMIS,
      FaseBracket.FINAL,
    ];

    for (const dia of diasConfig) {
      const fasesPermitidas = (dia.fasesPermitidas as string)?.split(',') as FaseBracket[] || 
        this.obtenerFasesParaDia(dia.fecha);

      if (fasesPermitidas.length === 0) continue;

      const slotsDelDia = await this.prisma.torneoSlot.findMany({
        where: {
          disponibilidadId: dia.id,
          estado: 'LIBRE',
        },
        orderBy: { horaInicio: 'asc' },
      });

      if (slotsDelDia.length === 0) continue;

      const slotsUsadosEnEsteDia = new Set<string>();
      const partidosPendientesPorDescanso: Array<{
        categoriaId: string;
        fase: FaseBracket;
        orden: number;
        matchId: string;
        inscripcion1Id?: string;
        inscripcion2Id?: string;
      }> = [];

      // Obtener partidos pendientes
      const partidosPorCategoria = await this.obtenerPartidosPendientes(
        tournamentId,
        categoriasData,
        fasesPermitidas,
        partidosAsignados,
      );

      if (partidosPorCategoria.size === 0) continue;

      // Ordenar con Round-Robin
      const partidosOrdenados = this.ordenarRoundRobinConParejas(
        partidosPorCategoria,
        categoriasData.map(c => c.categoria.id),
      );

      // Asignar partidos a slots
      for (const partido of partidosOrdenados) {
        const catNombre = categoriasData.find(c => c.categoria.id === partido.categoriaId)?.nombre;
        
        // Calcular hora mínima para esta fase
        const idxFaseActual = ordenFases.indexOf(partido.fase);
        let horaMinimaInicio = '00:00';
        let faseAnteriorMismoDia = false;
        let fechaMinimaInicio = dia.fecha;
        
        if (idxFaseActual > 0) {
          for (let j = idxFaseActual - 1; j >= 0; j--) {
            const faseAnterior = ordenFases[j];
            const key = `${partido.categoriaId}-${dia.fecha}-${faseAnterior}`;
            if (ultimaHoraFinPorCategoriaFase[key]) {
              const descansoMinutos = this.descansoCalculator.getDescansoEntreFases(
                faseAnterior,
                partido.fase,
              );
              const resultadoDescanso = this.descansoCalculator.calcularHoraMinimaDescanso(
                dia.fecha,
                ultimaHoraFinPorCategoriaFase[key],
                descansoMinutos,
              );
              
              horaMinimaInicio = resultadoDescanso.hora;
              fechaMinimaInicio = resultadoDescanso.fecha;
              faseAnteriorMismoDia = true;
              break;
            }
          }
        }
        
        // Si la fase anterior fue en este día pero el descanso empuja fuera del horario
        if (faseAnteriorMismoDia && slotsDelDia.length > 0) {
          const ultimoSlotDelDia = slotsDelDia[slotsDelDia.length - 1].horaInicio;
          if (horaAMinutos(horaMinimaInicio) > horaAMinutos(ultimoSlotDelDia) || fechaMinimaInicio > dia.fecha) {
            partidosPendientesPorDescanso.push(partido);
            continue;
          }
        }
        
        // Buscar slot válido
        const slotAsignado = await this.buscarYAsignarSlot(
          partido,
          dia,
          slotsDelDia,
          slotsUsadosEnEsteDia,
          ultimaHoraPorPareja,
          horaMinimaInicio,
          fechaMinimaInicio,
          asignacionesPorCategoria,
          ultimaHoraFinPorCategoriaFase,
          partidosAsignados,
          distribucionPorDia,
        );

        if (!slotAsignado) {
          partidosPendientesPorDescanso.push(partido);
        }
      }
      
      // Reintentar partidos pendientes por descanso
      for (const pendiente of partidosPendientesPorDescanso) {
        if (!partidosAsignados.has(pendiente.matchId)) {
          if (!partidosPorCategoria.has(pendiente.categoriaId)) {
            partidosPorCategoria.set(pendiente.categoriaId, []);
          }
          partidosPorCategoria.get(pendiente.categoriaId)!.push(pendiente);
        }
      }
    }

    return {
      totalPartidosAsignados: partidosAsignados.size,
      distribucionPorDia,
    };
  }

  /**
   * Obtiene partidos pendientes de asignación
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
   * Busca y asigna un slot válido para un partido
   */
  private async buscarYAsignarSlot(
    partido: {
      categoriaId: string;
      fase: FaseBracket;
      orden: number;
      matchId: string;
      inscripcion1Id?: string;
      inscripcion2Id?: string;
    },
    dia: any,
    slotsDelDia: any[],
    slotsUsadosEnEsteDia: Set<string>,
    ultimaHoraPorPareja: Map<string, { fecha: string; horaFin: string }>,
    horaMinimaInicio: string,
    fechaMinimaInicio: string,
    asignacionesPorCategoria: Map<string, SlotReserva[]>,
    ultimaHoraFinPorCategoriaFase: Record<string, string>,
    partidosAsignados: Set<string>,
    distribucionPorDia: Record<string, number>,
  ): Promise<boolean> {
    const { inscripcion1Id, inscripcion2Id } = partido;

    for (const slot of slotsDelDia) {
      const slotKey = `${slot.torneoCanchaId}-${slot.horaInicio}`;
      
      if (slotsUsadosEnEsteDia.has(slotKey)) continue;
      
      // Verificar descanso de fase
      if (slot.fecha === fechaMinimaInicio && horaAMinutos(slot.horaInicio) < horaAMinutos(horaMinimaInicio)) {
        continue;
      }
      if (slot.fecha < fechaMinimaInicio) {
        continue;
      }
      
      // Verificar descanso individual de cada pareja
      let pareja1TieneDescanso = true;
      let pareja2TieneDescanso = true;
      
      if (inscripcion1Id && ultimaHoraPorPareja.has(inscripcion1Id)) {
        const ultimaHora = ultimaHoraPorPareja.get(inscripcion1Id)!;
        const validacion = this.descansoCalculator.validarSlotConDescanso(
          { fecha: slot.fecha || dia.fecha, horaInicio: slot.horaInicio, horaFin: slot.horaFin },
          { fecha: ultimaHora.fecha, horaInicio: '', horaFin: ultimaHora.horaFin },
          240
        );
        pareja1TieneDescanso = validacion.valido;
      }
      
      if (inscripcion2Id && ultimaHoraPorPareja.has(inscripcion2Id)) {
        const ultimaHora = ultimaHoraPorPareja.get(inscripcion2Id)!;
        const validacion = this.descansoCalculator.validarSlotConDescanso(
          { fecha: slot.fecha || dia.fecha, horaInicio: slot.horaInicio, horaFin: slot.horaFin },
          { fecha: ultimaHora.fecha, horaInicio: '', horaFin: ultimaHora.horaFin },
          240
        );
        pareja2TieneDescanso = validacion.valido;
      }
      
      if (pareja1TieneDescanso && pareja2TieneDescanso) {
        // Asignar slot
        slotsUsadosEnEsteDia.add(slotKey);
        
        const slotReserva: SlotReserva = {
          fecha: dia.fecha,
          horaInicio: slot.horaInicio,
          horaFin: slot.horaFin,
          torneoCanchaId: slot.torneoCanchaId,
          categoriaId: partido.categoriaId,
          fase: partido.fase,
          ordenPartido: partido.orden,
          matchId: partido.matchId,
        };

        if (!asignacionesPorCategoria.has(partido.categoriaId)) {
          asignacionesPorCategoria.set(partido.categoriaId, []);
        }
        asignacionesPorCategoria.get(partido.categoriaId)!.push(slotReserva);

        const key = `${partido.categoriaId}-${dia.fecha}-${partido.fase}`;
        ultimaHoraFinPorCategoriaFase[key] = slot.horaFin;

        if (inscripcion1Id) {
          ultimaHoraPorPareja.set(inscripcion1Id, { fecha: dia.fecha, horaFin: slot.horaFin });
        }
        if (inscripcion2Id) {
          ultimaHoraPorPareja.set(inscripcion2Id, { fecha: dia.fecha, horaFin: slot.horaFin });
        }

        await this.prisma.torneoSlot.update({
          where: { id: slot.id },
          data: { 
            estado: 'RESERVADO',
            matchId: partido.matchId,
          },
        });

        await this.prisma.match.update({
          where: { id: partido.matchId },
          data: {
            fechaProgramada: dia.fecha,
            horaProgramada: slot.horaInicio,
            torneoCanchaId: slot.torneoCanchaId,
          },
        });

        partidosAsignados.add(partido.matchId);
        distribucionPorDia[dia.fecha] = (distribucionPorDia[dia.fecha] || 0) + 1;

        return true;
      }
    }

    return false;
  }

  /**
   * Valida que todos los partidos tienen slot asignado
   */
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
      const partidosSinSlot = totalPartidos - partidosConSlot;
      throw new BadRequestException(
        `No se pudieron asignar ${partidosSinSlot} partidos. ` +
        `Verifica que haya suficientes slots configurados y que los descansos entre fases permitan asignar todos los partidos.`
      );
    }
  }

  /**
   * Rollback del sorteo en caso de error
   */
  private async rollbackSorteo(
    tournamentId: string,
    estadoInicialCategorias: any[],
  ) {
    console.log('[Sorteo] Ejecutando rollback...');

    // Restaurar estado de categorías
    for (const cat of estadoInicialCategorias) {
      await this.prisma.tournamentCategory.update({
        where: { id: cat.id },
        data: { estado: cat.estado },
      });
    }

    // Liberar slots reservados
    await this.prisma.torneoSlot.updateMany({
      where: {
        disponibilidad: { tournamentId },
        estado: 'RESERVADO',
      },
      data: { estado: 'LIBRE', matchId: null },
    });

    // Eliminar brackets generados
    const fixtureVersionIds = estadoInicialCategorias
      .filter(c => c.fixtureVersionId)
      .map(c => c.fixtureVersionId);

    if (fixtureVersionIds.length > 0) {
      await this.prisma.match.deleteMany({
        where: { fixtureVersionId: { in: fixtureVersionIds } },
      });
    }

    console.log('[Sorteo] Rollback completado');
  }

  /**
   * Re-sortear una categoría individual
   */
  async reSortearCategoria(categoriaId: string) {
    const categoria = await this.prisma.tournamentCategory.findUnique({
      where: { id: categoriaId },
      include: { tournament: true },
    });

    if (!categoria) {
      throw new NotFoundException('Categoría no encontrada');
    }

    const partidos = await this.prisma.match.findMany({
      where: {
        fixtureVersionId: categoria.fixtureVersionId!,
      },
    });

    const partidosConResultado = partidos.filter(p => p.estado === 'FINALIZADO');
    const partidosSinResultado = partidos.filter(p => p.estado !== 'FINALIZADO');

    if (partidosSinResultado.length === 0) {
      throw new BadRequestException('No hay partidos pendientes para re-sortear');
    }

    // Liberar slots de partidos sin resultado
    for (const partido of partidosSinResultado) {
      await this.prisma.torneoSlot.updateMany({
        where: { matchId: partido.id },
        data: { estado: 'LIBRE', matchId: null },
      });
    }

    // Eliminar partidos sin resultado
    await this.prisma.match.deleteMany({
      where: { id: { in: partidosSinResultado.map(p => p.id) } },
    });

    // Archivar o eliminar fixture anterior
    if (partidosConResultado.length > 0) {
      await this.prisma.fixtureVersion.update({
        where: { id: categoria.fixtureVersionId! },
        data: { estado: FixtureVersionEstado.ARCHIVADO },
      });
    } else {
      await this.prisma.fixtureVersion.delete({
        where: { id: categoria.fixtureVersionId! },
      });
    }

    // Regenerar bracket
    const inscripciones = await this.prisma.inscripcion.findMany({
      where: {
        tournamentId: categoria.tournamentId,
        categoryId: categoria.categoryId,
        estado: 'CONFIRMADA',
      },
    });

    await this.bracketService.generarBracket({
      tournamentCategoryId: categoria.id,
      totalParejas: inscripciones.length,
    });

    // Re-asignar slots
    const diasConfig = await this.prisma.torneoDisponibilidadDia.findMany({
      where: { tournamentId: categoria.tournamentId },
      orderBy: [{ fecha: 'asc' }, { horaInicio: 'asc' }],
    });

    const categoriaActualizada = await this.prisma.tournamentCategory.findUnique({
      where: { id: categoriaId },
    });

    const categoriasData = [{
      categoria: categoriaActualizada!,
      nombre: 'Categoría',
      inscripciones,
    }];

    const asignaciones = await this.asignarSlots(
      categoria.tournamentId,
      categoriasData,
      diasConfig,
    );

    return {
      success: true,
      message: 'Categoría re-sorteadas correctamente',
      data: {
        partidosMantenidos: partidosConResultado.length,
        partidosReasignados: asignaciones.totalPartidosAsignados,
      },
    };
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
}
