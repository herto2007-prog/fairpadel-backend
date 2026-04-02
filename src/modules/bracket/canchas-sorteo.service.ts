import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DateService } from '../../common/services/date.service';
import { BracketService } from './bracket.service';
import { DescansoCalculatorService } from '../programacion/descanso-calculator.service';
import { horaAMinutos, minutosAHora, horaEsMayor, horaEsMayorOIgual } from '../../common/utils/time-helpers';
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
   * Determina qu├® fases pueden jugarse en un d├¡a seg├║n su fecha
   * L├│gica paraguaya est├índar: Jueves/Viernes=Zona/Repechaje, S├íbado=Octavos/Cuartos, Domingo=Semis/Final
   */
  private obtenerFasesParaDia(fecha: string): FaseBracket[] {
    // Usar UTC para calcular d├¡a de semana, evitando problemas de timezone
    const [year, month, day] = fecha.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    const diaSemana = date.getUTCDay();
    
    switch (diaSemana) {
      case 4: // Jueves
      case 5: // Viernes
        return [FaseBracket.ZONA, FaseBracket.REPECHAJE];
      case 6: // S├íbado
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

    // Validar que los horarios no se solapen (comparaci├│n num├®rica de horas)
    if (horaAMinutos(dto.horaFinSemifinales) > horaAMinutos(dto.horaInicioFinales)) {
      throw new BadRequestException('El horario de semifinales no puede terminar despu├®s de que empiecen las finales');
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
        minutosSlot: 70,
      },
      create: {
        tournamentId: dto.tournamentId,
        fecha: torneo.fechaFinales,
        horaInicio: dto.horaInicioSemifinales,
        horaFin: dto.horaFinFinales,
        minutosSlot: 70,
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
      message: 'Configuraci├│n guardada',
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
   * PASO 1.b: Configurar d├¡as de juego
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
      message: `D├¡a configurado con ${slotsGenerados} slots`,
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
   * Genera slots (TorneoSlot) para un d├¡a espec├¡fico
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
   * Genera slots marcados con una fase espec├¡fica
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
        nombre: categoriaBase?.nombre || 'Categor├¡a',
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
      duracionPromedioMinutos: 70,
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
      where: { tournamentId, activa: true },
      include: {
        sedeCancha: {
          include: { sede: { select: { id: true, nombre: true } } },
        },
      },
      orderBy: { orden: 'asc' },
    });

    return {
      success: true,
      canchas: torneoCanchas.map(tc => ({
        id: tc.id,
        nombre: tc.sedeCancha.nombre,
        tipo: tc.sedeCancha.tipo,
        iluminacion: tc.sedeCancha.tieneLuz,
        sede: tc.sedeCancha.sede,
      })),
    };
  }

  /**
   * Obtiene configuraci├│n actual del torneo
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
        dias: disponibilidadDias.map(d => {
          const slotsLibres = d.slots.filter(s => s.estado === 'LIBRE').length;
          const slotsOcupados = d.slots.filter(s => s.estado === 'OCUPADO' || s.estado === 'RESERVADO').length;
          return {
            id: d.id,
            fecha: d.fecha,
            horaInicio: d.horaInicio,
            horaFin: d.horaFin,
            minutosSlot: d.minutosSlot,
            fasesPermitidas: d.fasesPermitidas,
            totalSlots: d.slots.length,
            slotsLibres,
            slotsOcupados,
          };
        }),
        canchas: torneoCanchas.map(tc => ({
          id: tc.id,
          nombre: `Cancha ${tc.orden + 1}`,
          sede: tc.sedeCancha.sede.nombre,
        })),
      },
    };
  }

  /**
   * Eliminar un d├¡a de juego y sus slots
   */
  async eliminarDia(diaId: string) {
    const dia = await this.prisma.torneoDisponibilidadDia.findUnique({
      where: { id: diaId },
      include: { slots: true },
    });

    if (!dia) {
      throw new NotFoundException('D├¡a no encontrado');
    }

    // Verificar si hay slots ocupados
    const slotsOcupados = dia.slots.filter(s => s.estado === 'OCUPADO' || s.matchId !== null);
    if (slotsOcupados.length > 0) {
      throw new BadRequestException(
        `No se puede eliminar el d├¡a porque tiene ${slotsOcupados.length} partidos programados`
      );
    }

    await this.prisma.torneoDisponibilidadDia.delete({
      where: { id: diaId },
    });

    return {
      success: true,
      message: 'D├¡a eliminado correctamente',
    };
  }

  /**
   * PASO 2: Cerrar inscripciones y sortear (con asignaci├│n de slots)
   * 
   * ALGORITMO DE DESCANSO:
   * - 3 horas de descanso entre fases del mismo d├¡a
   * - 3 horas de descanso entre partidos de la misma pareja
   * - Si no cabe en el d├¡a, pasa al siguiente d├¡a disponible
   */
  async cerrarInscripcionesYsortear(
    dto: CerrarInscripcionesSortearDto,
  ): Promise<SorteoMasivoResponse> {
    const { tournamentId, categoriasIds, fechaDesde } = dto;

    // Guardar estado inicial para rollback si es necesario
    const estadoInicialCategorias = await this.prisma.tournamentCategory.findMany({
      where: { id: { in: categoriasIds } },
    });

    try {
      const resultado = await this.ejecutarSorteo(tournamentId, categoriasIds, fechaDesde);
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
    fechaDesde?: string,
  ): Promise<SorteoMasivoResponse> {
    // Obtener informaci├│n completa de categor├¡as
    const categoriasData = await this.obtenerCategoriasData(tournamentId, categoriasIds);
    
    // Validar que todas las categor├¡as tienen inscripciones confirmadas
    for (const catData of categoriasData) {
      if (catData.inscripciones.length < 8) {
        throw new BadRequestException(
          `La categor├¡a ${catData.nombre} tiene solo ${catData.inscripciones.length} inscripciones confirmadas. M├¡nimo requerido: 8`
        );
      }
    }

    // Obtener d├¡as configurados ordenados cronol├│gicamente
    const diasConfig = await this.prisma.torneoDisponibilidadDia.findMany({
      where: { tournamentId },
      orderBy: [{ fecha: 'asc' }, { horaInicio: 'asc' }],
    });

    if (diasConfig.length === 0) {
      throw new BadRequestException('No hay d├¡as configurados para el torneo');
    }

    // Filtrar d├¡as por fechaDesde si se proporciona (para sorteo por lotes)
    let diasFiltrados = diasConfig;
    if (fechaDesde) {
      diasFiltrados = diasConfig.filter(d => d.fecha >= fechaDesde);
      if (diasFiltrados.length === 0) {
        throw new BadRequestException(`No hay d├¡as disponibles desde la fecha ${fechaDesde}`);
      }
      console.log(`[Sorteo] Filtrando desde ${fechaDesde}: ${diasFiltrados.length} d├¡as disponibles (de ${diasConfig.length} total)`);
    }

    // FIX: Liberar slots de sorteos anteriores para permitir nueva asignacion
    console.log('[Sorteo] Liberando slots de sorteos anteriores...');
    await this.prisma.torneoSlot.updateMany({
      where: {
        disponibilidad: { tournamentId },
        estado: { in: ['RESERVADO', 'OCUPADO'] },
        matchId: { not: null },
      },
      data: { estado: 'LIBRE', matchId: null },
    });

    // Cerrar inscripciones y generar brackets
    await this.cerrarInscripcionesYGenerarBrackets(categoriasData);

    // Guardar brackets en BD (sin slots) y obtener fixtureVersionId
    for (const catData of categoriasData) {
      const config = (catData as any).bracketConfig;
      const partidos = (catData as any).bracketPartidos;
      
      if (config && partidos) {
        const fixtureVersionId = await this.bracketService.guardarBracket(
          catData.categoria.id,
          config,
          partidos,
          catData.inscripciones,
          [], // Slots vacíos - se asignarán después
        );
        
        // Actualizar la categoría con el fixtureVersionId
        await this.prisma.tournamentCategory.update({
          where: { id: catData.categoria.id },
          data: { fixtureVersionId },
        });
        
        catData.categoria.fixtureVersionId = fixtureVersionId;
      }
    }

    // Asignar slots a partidos (usando días filtrados por fechaDesde si aplica)
    const asignaciones = await this.asignarSlots(tournamentId, categoriasData, diasFiltrados);

    // Validar que todos los partidos tienen fecha asignada (permitir sin cancha)
    const validacion = await this.validarTodosLosPartidosAsignados(tournamentId, categoriasData);

    // Construir mensaje incluyendo advertencia de partidos sin cancha
    let mensaje = `Sorteo completado. ${asignaciones.totalPartidosAsignados} partidos asignados a slots.`;
    if (validacion.partidosSinCancha > 0) {
      const detalleSinCancha = Object.entries(validacion.porFase)
        .map(([fase, cantidad]) => `${cantidad} ${fase}`)
        .join(', ');
      mensaje += ` ${validacion.partidosSinCancha} partidos pendientes de asignar cancha: ${detalleSinCancha}. Use el módulo Auditoría para asignar canchas.`;
    }

    const response: SorteoMasivoResponse = {
      success: true,
      message: mensaje,
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
   * Obtiene informaci├│n completa de las categor├¡as
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
   * Cierra inscripciones y genera brackets para todas las categor├¡as
   */
  private async cerrarInscripcionesYGenerarBrackets(
    categoriasData: Array<{ categoria: any; nombre: string; inscripciones: any[] }>,
  ) {
    for (const catData of categoriasData) {
      // 1. Cerrar inscripciones
      await this.prisma.tournamentCategory.update({
        where: { id: catData.categoria.id },
        data: { estado: CategoriaEstado.INSCRIPCIONES_CERRADAS },
      });

      // 2. Archivar fixture anterior si existe
      if (catData.categoria.fixtureVersionId) {
        await this.prisma.fixtureVersion.update({
          where: { id: catData.categoria.fixtureVersionId },
          data: { estado: FixtureVersionEstado.ARCHIVADO, archivadoAt: new Date() },
        });
      }

      // 3. Generar bracket (config + partidos en memoria)
      const resultado = await this.bracketService.generarBracket({
        tournamentCategoryId: catData.categoria.id,
        totalParejas: catData.inscripciones.length,
      });

      // 4. Guardar en catData para usar después
      (catData as any).bracketConfig = resultado.config;
      (catData as any).bracketPartidos = resultado.partidos;
    }
  }

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
  private async asignarSlots(
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
        this.obtenerFasesParaDia(dia.fecha);
      
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
        console.log(`[asignarSlots] ===== VIERNES ${dia.fecha} =====`);
        console.log(`[asignarSlots] Fases permitidas: ${fasesPermitidas.join(', ')}`);
        
        // 1. Primero: ZONA pendiente de cualquier categoría (si está permitida)
        if (fasePermitida(FaseBracket.ZONA)) {
          console.log(`[asignarSlots] --- Fase ZONA ---`);
          for (const catData of categoriasData) {
            await this.asignarPartidosDeFase(
              catData, FaseBracket.ZONA, dia, slotsDelDia, slotsUsados,
              ultimoPartidoPorPareja, ultimaHoraFinDelDia, partidosAsignados, distribucionPorDia
            );
          }
        }
        
        // 2. Segundo: AJUSTES - y registrar parejas que juegan ajustes (si está permitida)
        if (fasePermitida(FaseBracket.REPECHAJE)) {
          console.log(`[asignarSlots] --- Fase REPECHAJE ---`);
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
          console.log(`[asignarSlots] --- Fase TREINTAYDOSAVOS ---`);
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
          console.log(`[asignarSlots] --- Fase DIECISEISAVOS ---`);
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
          console.log(`[asignarSlots] --- Fase OCTAVOS ---`);
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
          console.log(`[asignarSlots] --- Fase CUARTOS ---`);
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
        console.log(`[asignarSlots] ===== SABADO ${dia.fecha} =====`);
        console.log(`[asignarSlots] Fases permitidas: ${fasesPermitidas.join(', ')}`);
        
        // Procesar en ORDEN CRONOLÓGICO según tamaño del bracket
        // Solo procesar fases que estén explícitamente permitidas
        
        // 1. 32avos pendientes (solo bracket de 64)
        if (fasePermitida(FaseBracket.TREINTAYDOSAVOS)) {
          console.log(`[asignarSlots] --- Fase TREINTAYDOSAVOS ---`);
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
          console.log(`[asignarSlots] --- Fase DIECISEISAVOS ---`);
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
          console.log(`[asignarSlots] --- Fase OCTAVOS ---`);
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
          console.log(`[asignarSlots] --- Fase CUARTOS ---`);
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
        console.log(`[asignarSlots] ===== DOMINGO ${dia.fecha} =====`);
        console.log(`[asignarSlots] Fases permitidas: ${fasesPermitidas.join(', ')}`);
        
        // SEMIS (con descanso desde CUARTOS - calculado automáticamente por origen)
        if (fasePermitida(FaseBracket.SEMIS)) {
          console.log(`[asignarSlots] --- Fase SEMIS ---`);
          for (const catData of categoriasData) {
            await this.asignarPartidosDeFase(
              catData, FaseBracket.SEMIS, dia, slotsDelDia, slotsUsados,
              ultimoPartidoPorPareja, ultimaHoraFinDelDia, partidosAsignados, distribucionPorDia
            );
          }
        }
        
        // FINAL (con descanso desde SEMIS - calculado automáticamente por origen)
        if (fasePermitida(FaseBracket.FINAL)) {
          console.log(`[asignarSlots] --- Fase FINAL ---`);
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
          this.obtenerFasesParaDia(dia.fecha);
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
      console.log(`[AsignarSlots] ${partidosSinCancha.length} partidos sin cancha asignados al último día para Auditoría`);
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
   * Valida que todos los partidos tienen fecha/hora asignada.
   * Permite partidos sin cancha (torneoCanchaId = null) - se asignarán manualmente en Auditoría.
   * Solo falla si el partido no tiene ni siquiera fecha programada.
   */
  private async validarTodosLosPartidosAsignados(
    tournamentId: string,
    categoriasData: Array<{ categoria: any; nombre: string; inscripciones: any[] }>,
  ): Promise<{ partidosSinCancha: number; porFase: Record<string, number> }> {
    const fixtureVersionIds = categoriasData
      .map(c => c.categoria.fixtureVersionId)
      .filter(Boolean);

    if (fixtureVersionIds.length === 0) return { partidosSinCancha: 0, porFase: {} };

    // Buscar partidos SIN FECHA (estos sí son error crítico)
    const partidosSinFecha = await this.prisma.match.findMany({
      where: {
        fixtureVersionId: { in: fixtureVersionIds },
        esBye: false,
        fechaProgramada: null,
      },
      select: {
        id: true,
        ronda: true,
      },
    });

    if (partidosSinFecha.length > 0) {
      const porFase: Record<string, number> = {};
      for (const p of partidosSinFecha) {
        porFase[p.ronda] = (porFase[p.ronda] || 0) + 1;
      }
      
      const detalleFases = Object.entries(porFase)
        .map(([fase, cantidad]) => `${cantidad} ${fase}`)
        .join(', ');

      throw new BadRequestException({
        message: `${partidosSinFecha.length} partidos sin programar: ${detalleFases}`,
        detalle: { totalPartidosSinSlot: partidosSinFecha.length, porFase }
      });
    }

    // Buscar partidos CON FECHA pero SIN CANCHA (para advertencia)
    const partidosSinCancha = await this.prisma.match.findMany({
      where: {
        fixtureVersionId: { in: fixtureVersionIds },
        esBye: false,
        fechaProgramada: { not: null },
        torneoCanchaId: null,
      },
      select: {
        id: true,
        ronda: true,
      },
    });

    const porFaseSinCancha: Record<string, number> = {};
    for (const p of partidosSinCancha) {
      porFaseSinCancha[p.ronda] = (porFaseSinCancha[p.ronda] || 0) + 1;
    }

    // Log de advertencia pero NO falla
    if (partidosSinCancha.length > 0) {
      const detalle = Object.entries(porFaseSinCancha)
        .map(([fase, cantidad]) => `${cantidad} ${fase}`)
        .join(', ');
      console.log(`[Sorteo] Advertencia: ${partidosSinCancha.length} partidos sin cancha asignada: ${detalle}`);
    }

    return { partidosSinCancha: partidosSinCancha.length, porFase: porFaseSinCancha };
  }

  /**
   * PARTE 4: Rollback del sorteo
   * 
   * Si ocurre cualquier error, restaura todo al estado anterior.
   */
  private async rollbackSorteo(
    tournamentId: string,
    estadoInicialCategorias: any[],
  ) {
    console.log('[Sorteo] Ejecutando rollback...');

    // Obtener categorias actuales para conseguir los fixtureVersionId NUEVOS
    const categoriasActuales = await this.prisma.tournamentCategory.findMany({
      where: { id: { in: estadoInicialCategorias.map(c => c.id) } },
    });

    // 1. Restaurar estado de categorias (incluyendo fixtureVersionId original)
    for (const cat of estadoInicialCategorias) {
      await this.prisma.tournamentCategory.update({
        where: { id: cat.id },
        data: { 
          estado: cat.estado,
          fixtureVersionId: cat.fixtureVersionId, // Restaurar valor original
        },
      });
    }

    // 2. Liberar slots ocupados (tanto RESERVADO como OCUPADO)
    await this.prisma.torneoSlot.updateMany({
      where: {
        disponibilidad: { tournamentId },
        estado: { in: ['RESERVADO', 'OCUPADO'] },
        matchId: { not: null },
      },
      data: { estado: 'LIBRE', matchId: null },
    });

    // 3. Eliminar partidos creados (los de los nuevos fixtureVersionId)
    const fixtureVersionIdsNuevos = categoriasActuales
      .filter(c => c.fixtureVersionId)
      .map(c => c.fixtureVersionId)
      .filter(id => !estadoInicialCategorias.some(c => c.fixtureVersionId === id)); // Solo los nuevos

    if (fixtureVersionIdsNuevos.length > 0) {
      await this.prisma.match.deleteMany({
        where: { fixtureVersionId: { in: fixtureVersionIdsNuevos } },
      });
    }

    console.log('[Sorteo] Rollback completado');
  }

  /**
   * Re-sortear una categor├¡a individual
   */
  async reSortearCategoria(categoriaId: string) {
    const categoria = await this.prisma.tournamentCategory.findUnique({
      where: { id: categoriaId },
      include: { tournament: true },
    });

    if (!categoria) {
      throw new NotFoundException('Categor├¡a no encontrada');
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
      nombre: 'Categor├¡a',
      inscripciones,
    }];

    const asignaciones = await this.asignarSlots(
      categoria.tournamentId,
      categoriasData,
      diasConfig,
    );

    return {
      success: true,
      message: 'Categor├¡a re-sorteadas correctamente',
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
    
    console.log(`[asignarPartidosDeFase] Iniciando fase ${fase} para dia ${dia.fecha}. Slots disponibles: ${slotsDelDia.length - slotsUsados.size}`);
    
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
        console.log(`[asignarPartidosDeFase] No hay más partidos pendientes en fase ${fase}`);
        break;
      }

      console.log(`[asignarPartidosDeFase] Encontrado partido ${partido.id} en fase ${fase}`);

      const asignado = await this.intentarAsignarSlot(
        partido, dia, slotsDelDia, slotsUsados,
        ultimoPartidoPorPareja, ultimaHoraFinDelDia,
        partidosAsignados, distribucionPorDia
      );

      if (!asignado) {
        console.log(`[asignarPartidosDeFase] Partido ${partido.id} NO pudo asignarse, marcando para no reintentar`);
        // Marcar como no asignado para no reintentar en esta fase
        partidosNoAsignados.add(partido.id);
        // Continuar con el siguiente partido, NO hacer break
        continue;
      }
      
      console.log(`[asignarPartidosDeFase] Partido ${partido.id} ASIGNADO correctamente`);
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
    
    console.log(`[asignarPartidosDeFaseConFiltro] Iniciando fase ${fase} para dia ${dia.fecha}. Slots disponibles: ${slotsDelDia.length - slotsUsados.size}`);
    
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
      
      console.log(`[asignarPartidosDeFaseConFiltro] Candidatos encontrados: ${partidosCandidatos.length}`);
      
      // Filtrar manualmente (excluir parejas en ajustes y partidos ya intentados)
      const partidoValido = partidosCandidatos.find(p => {
        if (partidosNoAsignados.has(p.id)) return false;
        const p1Excluida = p.inscripcion1Id && parejasExcluidas.has(p.inscripcion1Id);
        const p2Excluida = p.inscripcion2Id && parejasExcluidas.has(p.inscripcion2Id);
        const valido = !p1Excluida && !p2Excluida;
        console.log(`[asignarPartidosDeFaseConFiltro] Partido ${p.id}: insc1=${p.inscripcion1Id}, insc2=${p.inscripcion2Id}, valido=${valido}`);
        return valido;
      });
      
      if (!partidoValido) {
        console.log(`[asignarPartidosDeFaseConFiltro] No hay más partidos válidos para fase ${fase}`);
        break; // No hay más partidos válidos
      }

      console.log(`[asignarPartidosDeFaseConFiltro] Intentando asignar partido ${partidoValido.id}`);
      
      const asignado = await this.intentarAsignarSlot(
        partidoValido, dia, slotsDelDia, slotsUsados,
        ultimoPartidoPorPareja, ultimaHoraFinDelDia,
        partidosAsignados, distribucionPorDia
      );

      if (!asignado) {
        console.log(`[asignarPartidosDeFaseConFiltro] Partido ${partidoValido.id} NO pudo asignarse`);
        partidosNoAsignados.add(partidoValido.id);
        continue; // Intentar con el siguiente partido
      }
      
      console.log(`[asignarPartidosDeFaseConFiltro] Partido ${partidoValido.id} ASIGNADO correctamente`);
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
      console.log(`[verificarOrigenAsignado] Match ${matchId} no encontrado`);
      return { puedeAsignar: true };
    }

    console.log(`[verificarOrigenAsignado] Match ${matchId}: origen1=${match.partidoOrigen1Id}, origen2=${match.partidoOrigen2Id}, diaFecha=${diaFecha}`);

    let horaMaximaFinMinutos = 0;
    let todosLosOrigenesAsignados = true;
    let algunoMismoDia = false;

    // Verificar origen 1
    if (match.partidoOrigen1Id) {
      const origen1 = await this.prisma.match.findUnique({
        where: { id: match.partidoOrigen1Id },
        select: { fechaProgramada: true, horaProgramada: true, esBye: true },
      });

      console.log(`[verificarOrigenAsignado] Origen1 ${match.partidoOrigen1Id}: fecha=${origen1?.fechaProgramada}, hora=${origen1?.horaProgramada}, esBye=${origen1?.esBye}`);

      if (!origen1?.fechaProgramada) {
        // Si es BYE sin fecha, no bloquea la asignación (no aplica descanso)
        if (origen1?.esBye) {
          console.log(`[verificarOrigenAsignado] Origen1 es BYE sin fecha - no bloquea`);
        } else {
          console.log(`[verificarOrigenAsignado] Origen1 NO tiene fecha asignada`);
          todosLosOrigenesAsignados = false;
        }
      } else if (origen1.fechaProgramada === diaFecha && origen1.horaProgramada) {
        // Origen es mismo día - calcular hora fin + 2h descanso
        algunoMismoDia = true;
        const horaFinMinutos = horaAMinutos(origen1.horaProgramada) + 70 + 120; // slot + 2h
        console.log(`[verificarOrigenAsignado] Origen1 MISMO DIA. Hora fin calculada: ${minutosAHora(horaFinMinutos)} (${horaFinMinutos} min)`);
        if (horaFinMinutos > horaMaximaFinMinutos) {
          horaMaximaFinMinutos = horaFinMinutos;
        }
      } else {
        console.log(`[verificarOrigenAsignado] Origen1 dia diferente: ${origen1.fechaProgramada} vs ${diaFecha}`);
      }
    }

    // Verificar origen 2
    if (match.partidoOrigen2Id) {
      const origen2 = await this.prisma.match.findUnique({
        where: { id: match.partidoOrigen2Id },
        select: { fechaProgramada: true, horaProgramada: true, esBye: true },
      });

      console.log(`[verificarOrigenAsignado] Origen2 ${match.partidoOrigen2Id}: fecha=${origen2?.fechaProgramada}, hora=${origen2?.horaProgramada}, esBye=${origen2?.esBye}`);

      if (!origen2?.fechaProgramada) {
        // Si es BYE sin fecha, no bloquea la asignación (no aplica descanso)
        if (origen2?.esBye) {
          console.log(`[verificarOrigenAsignado] Origen2 es BYE sin fecha - no bloquea`);
        } else {
          console.log(`[verificarOrigenAsignado] Origen2 NO tiene fecha asignada`);
          todosLosOrigenesAsignados = false;
        }
      } else if (origen2.fechaProgramada === diaFecha && origen2.horaProgramada) {
        // Origen es mismo día - calcular hora fin + 2h descanso
        algunoMismoDia = true;
        const horaFinMinutos = horaAMinutos(origen2.horaProgramada) + 70 + 120; // slot + 2h
        console.log(`[verificarOrigenAsignado] Origen2 MISMO DIA. Hora fin calculada: ${minutosAHora(horaFinMinutos)} (${horaFinMinutos} min)`);
        if (horaFinMinutos > horaMaximaFinMinutos) {
          horaMaximaFinMinutos = horaFinMinutos;
        }
      } else {
        console.log(`[verificarOrigenAsignado] Origen2 dia diferente: ${origen2.fechaProgramada} vs ${diaFecha}`);
      }
    }

    if (!todosLosOrigenesAsignados) {
      console.log(`[verificarOrigenAsignado] Resultado: NO puede asignar (faltan origenes)`);
      return { puedeAsignar: false };
    }

    // Si algún origen es mismo día, retornar hora mínima calculada
    if (algunoMismoDia && horaMaximaFinMinutos > 0) {
      console.log(`[verificarOrigenAsignado] Resultado: horaMinima=${minutosAHora(horaMaximaFinMinutos)}`);
      return {
        puedeAsignar: true,
        horaMinima: minutosAHora(horaMaximaFinMinutos),
      };
    }

    // Si todos los orígenes son días anteriores, sin restricción de hora
    console.log(`[verificarOrigenAsignado] Resultado: puedeAsignar sin restriccion (origenes en dias anteriores)`);
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

    console.log(`[intentarAsignarSlot] Partido ${partido.id} (${partido.ronda}): insc1=${insc1}, insc2=${insc2}, dia=${dia.fecha}`);

    // Obtener restricciones de descanso (por pareja o por origen)
    const restricciones = await this.obtenerRestriccionesDescanso(
      partido, dia, ultimoPartidoPorPareja
    );

    console.log(`[intentarAsignarSlot] Restricciones: puedeAsignar=${restricciones.puedeAsignar}, horaMinima=${restricciones.horaMinima}, fechaMinima=${restricciones.fechaMinima}`);

    // Si el partido origen no está asignado todavía, no podemos asignar este partido
    if (!restricciones.puedeAsignar) {
      console.log(`[intentarAsignarSlot] Partido ${partido.id} NO puede asignarse: origen no tiene fecha asignada`);
      return false;
    }

    for (let i = 0; i < slotsDelDia.length; i++) {
      if (slotsUsados.has(i)) continue;
      
      const slot = slotsDelDia[i];
      
      console.log(`[intentarAsignarSlot] Evaluando slot ${i}: ${slot.horaInicio}-${slot.horaFin}`);

      // Validar fecha mínima (por origen - partido padre en día anterior)
      if (restricciones.fechaMinima && slot.fecha < restricciones.fechaMinima) {
        console.log(`[intentarAsignarSlot] Slot ${i} RECHAZADO: fecha ${slot.fecha} < fechaMinima ${restricciones.fechaMinima}`);
        continue;
      }

      // Validar hora mínima (por pareja o por origen)
      if (restricciones.horaMinima && horaAMinutos(slot.horaInicio) < horaAMinutos(restricciones.horaMinima)) {
        console.log(`[intentarAsignarSlot] Slot ${i} RECHAZADO: hora ${slot.horaInicio} (${horaAMinutos(slot.horaInicio)}) < horaMinima ${restricciones.horaMinima} (${horaAMinutos(restricciones.horaMinima)})`);
        continue;
      }
      
      console.log(`[intentarAsignarSlot] Slot ${i} ACEPTADO: ${slot.horaInicio}-${slot.horaFin}`);

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

  /**
   * AUDITORÍA: Valida la integridad del fixture completo
   * Detecta problemas como partidos sin fecha, orígenes rotos, violaciones de descanso, etc.
   */
  async auditarFixture(tournamentId: string) {
    const problemas: Array<{
      id: string;
      tipo: 'CRITICO' | 'ADVERTENCIA' | 'INFO';
      categoria: string;
      categoriaId: string;
      mensaje: string;
      detalle: string;
      accionRecomendada: string;
      partidoId?: string;
      datos?: any;
    }> = [];

    // Obtener todas las categorías y días del torneo
    const categorias = await this.prisma.tournamentCategory.findMany({
      where: { tournamentId },
      include: { category: true },
    });

    const diasConfig = await this.prisma.torneoDisponibilidadDia.findMany({
      where: { tournamentId },
    });

    for (const cat of categorias) {
      const categoriaNombre = cat.category.nombre;
      const categoriaId = cat.categoryId;

      // Obtener todos los partidos de la categoría
      const partidos = await this.prisma.match.findMany({
        where: {
          tournamentId,
          categoryId: categoriaId,
        },
        include: {
          inscripcion1: { select: { id: true, jugador1Id: true, jugador2Id: true } },
          inscripcion2: { select: { id: true, jugador1Id: true, jugador2Id: true } },
          torneoCancha: { include: { sedeCancha: true } },
        },
      });

      // 1. Partidos sin fecha (no BYE)
      const partidosSinFecha = partidos.filter(p => !p.fechaProgramada && !p.esBye);
      if (partidosSinFecha.length > 0) {
        problemas.push({
          id: `sin-fecha-${categoriaId}`,
          tipo: 'CRITICO',
          categoria: categoriaNombre,
          categoriaId,
          mensaje: `${partidosSinFecha.length} partidos sin fecha asignada`,
          detalle: `Partidos: ${partidosSinFecha.map(p => `${p.ronda} (${p.id.slice(0, 8)}...)`).join(', ')}`,
          accionRecomendada: 'Re-sortear categoría',
          datos: { cantidad: partidosSinFecha.length, partidos: partidosSinFecha.map(p => ({ id: p.id, ronda: p.ronda })) },
        });
      }

      // 2. BYE sin fecha que afectan descanso (tienen partido siguiente)
      const byeSinFecha = partidos.filter(p => p.esBye && !p.fechaProgramada);
      for (const bye of byeSinFecha) {
        const partidosConEsteByeComoOrigen = await this.prisma.match.findMany({
          where: {
            OR: [
              { partidoOrigen1Id: bye.id },
              { partidoOrigen2Id: bye.id },
            ],
          },
        });
        
        if (partidosConEsteByeComoOrigen.length > 0) {
          problemas.push({
            id: `bye-afecta-${bye.id}`,
            tipo: 'ADVERTENCIA',
            categoria: categoriaNombre,
            categoriaId,
            mensaje: `BYE sin fecha afecta ${partidosConEsteByeComoOrigen.length} partido(s)`,
            detalle: `El BYE en ${bye.ronda} no tiene fecha pero es origen de otros partidos`,
            accionRecomendada: 'Ignorar (el sistema ya maneja esto) o asignar slot fantasma',
            partidoId: bye.id,
            datos: { partidosAfectados: partidosConEsteByeComoOrigen.map(p => p.id) },
          });
        }
      }

      // 3. Orígenes rotos (partidoOrigenXId apunta a null o partido inexistente)
      for (const partido of partidos) {
        if (partido.partidoOrigen1Id) {
          const origen1Existe = await this.prisma.match.findUnique({
            where: { id: partido.partidoOrigen1Id },
            select: { id: true },
          });
          if (!origen1Existe) {
            problemas.push({
              id: `origen-roto-${partido.id}-1`,
              tipo: 'CRITICO',
              categoria: categoriaNombre,
              categoriaId,
              mensaje: `Origen 1 roto en ${partido.ronda}`,
              detalle: `El partido origen ${partido.partidoOrigen1Id.slice(0, 8)}... no existe`,
              accionRecomendada: 'Re-generar bracket de la categoría',
              partidoId: partido.id,
            });
          }
        }
        if (partido.partidoOrigen2Id) {
          const origen2Existe = await this.prisma.match.findUnique({
            where: { id: partido.partidoOrigen2Id },
            select: { id: true },
          });
          if (!origen2Existe) {
            problemas.push({
              id: `origen-roto-${partido.id}-2`,
              tipo: 'CRITICO',
              categoria: categoriaNombre,
              categoriaId,
              mensaje: `Origen 2 roto en ${partido.ronda}`,
              detalle: `El partido origen ${partido.partidoOrigen2Id.slice(0, 8)}... no existe`,
              accionRecomendada: 'Re-generar bracket de la categoría',
              partidoId: partido.id,
            });
          }
        }
      }

      // 4. Violaciones de descanso (mismo día, diferencia < 2h + 70min)
      for (const partido of partidos.filter(p => p.fechaProgramada && !p.esBye)) {
        for (const origenId of [partido.partidoOrigen1Id, partido.partidoOrigen2Id].filter(Boolean)) {
          const origen = await this.prisma.match.findUnique({
            where: { id: origenId! },
          });
          
          if (origen?.fechaProgramada === partido.fechaProgramada && origen.horaProgramada && partido.horaProgramada) {
            const horaOrigenFin = horaAMinutos(origen.horaProgramada) + 70;
            const horaPartidoInicio = horaAMinutos(partido.horaProgramada);
            const diferenciaMin = horaPartidoInicio - horaOrigenFin;
            
            if (diferenciaMin < 120) {
              problemas.push({
                id: `descanso-${partido.id}-${origen.id}`,
                tipo: 'CRITICO',
                categoria: categoriaNombre,
                categoriaId,
                mensaje: `Violación de descanso en ${partido.ronda}`,
                detalle: `Origen termina ${origen.horaProgramada}, partido empieza ${partido.horaProgramada} (descanso: ${diferenciaMin}min, mínimo: 120min)`,
                accionRecomendada: 'Mover partido a slot posterior o día siguiente',
                partidoId: partido.id,
                datos: { horaOrigen: origen.horaProgramada, horaPartido: partido.horaProgramada, diferenciaMin },
              });
            }
          }
        }
      }

      // 5. Fase en día no permitido
      for (const partido of partidos.filter(p => p.fechaProgramada)) {
        const diaConfig = diasConfig.find(d => d.fecha === partido.fechaProgramada);
        if (diaConfig?.fasesPermitidas) {
          const fasesPermitidas = (diaConfig.fasesPermitidas as string).split(',');
          if (!fasesPermitidas.includes(partido.ronda)) {
            problemas.push({
              id: `fase-no-permitida-${partido.id}`,
              tipo: 'ADVERTENCIA',
              categoria: categoriaNombre,
              categoriaId,
              mensaje: `${partido.ronda} en día no permitido`,
              detalle: `El día ${partido.fechaProgramada} solo permite: ${fasesPermitidas.join(', ')}`,
              accionRecomendada: 'Re-sortear para mover al día correcto',
              partidoId: partido.id,
              datos: { fasesPermitidas },
            });
          }
        }
      }
    }

    // 6. Slots duplicados (verificar si un slot tiene más de un partido)
    const diasIds = diasConfig.map(d => d.id);
    const slotsOcupados = await this.prisma.torneoSlot.findMany({
      where: { 
        disponibilidadId: { in: diasIds },
        estado: 'OCUPADO' 
      },
      select: { id: true, disponibilidadId: true, horaInicio: true, torneoCanchaId: true, matchId: true },
    });
    
    const slotsPorClave = new Map<string, typeof slotsOcupados>();
    for (const slot of slotsOcupados) {
      const clave = `${slot.disponibilidadId}-${slot.horaInicio}-${slot.torneoCanchaId}`;
      if (!slotsPorClave.has(clave)) {
        slotsPorClave.set(clave, []);
      }
      slotsPorClave.get(clave)!.push(slot);
    }
    
    const slotsDuplicados = Array.from(slotsPorClave.values()).filter(slots => slots.length > 1);
    
    if (slotsDuplicados.length > 0) {
      problemas.push({
        id: 'slots-duplicados',
        tipo: 'CRITICO',
        categoria: 'Todas',
        categoriaId: 'all',
        mensaje: `${slotsDuplicados.length} slots con múltiples partidos`,
        detalle: 'Hay slots que tienen más de un partido asignado',
        accionRecomendada: 'Re-sortear todo el torneo',
        datos: { slotsDuplicados: slotsDuplicados.map(s => s.map(x => x.id)) },
      });
    }

    // Resumen
    const resumen = {
      totalCategorias: categorias.length,
      totalProblemas: problemas.length,
      criticos: problemas.filter(p => p.tipo === 'CRITICO').length,
      advertencias: problemas.filter(p => p.tipo === 'ADVERTENCIA').length,
      info: problemas.filter(p => p.tipo === 'INFO').length,
    };

    return {
      success: true,
      data: {
        resumen,
        problemas,
      },
    };
  }

  /**
   * Obtiene slots disponibles para un partido específico
   * Considera restricciones de descanso por origen y pareja
   */
  async obtenerSlotsDisponibles(tournamentId: string, matchId: string) {
    // Obtener datos del partido
    const partido = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: {
        inscripcion1: true,
        inscripcion2: true,
      },
    });

    if (!partido) {
      throw new NotFoundException('Partido no encontrado');
    }

    // Obtener días configurados
    const diasConfig = await this.prisma.torneoDisponibilidadDia.findMany({
      where: { tournamentId },
      orderBy: { fecha: 'asc' },
    });

    // Obtener slots disponibles (LIBRES)
    const slotsLibres = await this.prisma.torneoSlot.findMany({
      where: {
        disponibilidadId: { in: diasConfig.map(d => d.id) },
        estado: 'LIBRE',
      },
      include: {
        disponibilidad: true,
        torneoCancha: { include: { sedeCancha: true } },
      },
      orderBy: [
        { disponibilidad: { fecha: 'asc' } },
        { horaInicio: 'asc' },
      ],
    });

    // Verificar restricciones de descanso por origen
    const slotsValidos = [];
    for (const slot of slotsLibres) {
      const diaFecha = slot.disponibilidad.fecha;
      let esValido = true;
      let restriccion = '';

      // Verificar orígenes
      for (const origenId of [partido.partidoOrigen1Id, partido.partidoOrigen2Id].filter(Boolean)) {
        const origen = await this.prisma.match.findUnique({
          where: { id: origenId! },
          select: { fechaProgramada: true, horaProgramada: true },
        });

        if (origen?.fechaProgramada === diaFecha && origen.horaProgramada) {
          const horaFinOrigen = horaAMinutos(origen.horaProgramada) + 70;
          const horaInicioSlot = horaAMinutos(slot.horaInicio);
          const descansoMin = horaInicioSlot - horaFinOrigen;

          if (descansoMin < 120) {
            esValido = false;
            restriccion = `Descanso insuficiente: ${descansoMin}min (mínimo 120min)`;
            break;
          }
        }
      }

      // Verificar fase permitida en ese día
      const fasesPermitidas = (slot.disponibilidad.fasesPermitidas as string)?.split(',') || [];
      if (fasesPermitidas.length > 0 && !fasesPermitidas.includes(partido.ronda)) {
        esValido = false;
        restriccion = `Fase ${partido.ronda} no permitida este día`;
      }

      slotsValidos.push({
        ...slot,
        esValido,
        restriccion,
      });
    }

    // Separar en válidos e inválidos
    const validos = slotsValidos.filter(s => s.esValido);
    const invalidos = slotsValidos.filter(s => !s.esValido);

    return {
      success: true,
      data: {
        partido: {
          id: partido.id,
          ronda: partido.ronda,
          fechaActual: partido.fechaProgramada,
          horaActual: partido.horaProgramada,
        },
        slotsValidos: validos,
        slotsInvalidos: invalidos.slice(0, 10), // Solo mostrar primeros 10 inválidos
        totalDisponibles: validos.length,
      },
    };
  }

  /**
   * Cambia el slot de un partido
   */
  async cambiarSlot(tournamentId: string, matchId: string, nuevoSlotId: string) {
    // Obtener partido
    const partido = await this.prisma.match.findUnique({
      where: { id: matchId },
    });

    if (!partido) {
      throw new NotFoundException('Partido no encontrado');
    }

    // Obtener slot actual
    const slotActual = await this.prisma.torneoSlot.findFirst({
      where: { matchId },
    });

    // Obtener nuevo slot
    const nuevoSlot = await this.prisma.torneoSlot.findUnique({
      where: { id: nuevoSlotId },
      include: { disponibilidad: true },
    });

    if (!nuevoSlot) {
      throw new NotFoundException('Slot no encontrado');
    }

    if (nuevoSlot.estado !== 'LIBRE') {
      throw new BadRequestException('El slot seleccionado no está disponible');
    }

    // Transacción: liberar slot actual y ocupar nuevo
    await this.prisma.$transaction(async (tx) => {
      // Liberar slot actual si existe
      if (slotActual) {
        await tx.torneoSlot.update({
          where: { id: slotActual.id },
          data: { estado: 'LIBRE', matchId: null },
        });
      }

      // Ocupar nuevo slot
      await tx.torneoSlot.update({
        where: { id: nuevoSlotId },
        data: { estado: 'OCUPADO', matchId },
      });

      // Actualizar partido
      await tx.match.update({
        where: { id: matchId },
        data: {
          fechaProgramada: nuevoSlot.disponibilidad.fecha,
          horaProgramada: nuevoSlot.horaInicio,
          torneoCanchaId: nuevoSlot.torneoCanchaId,
        },
      });
    });

    return {
      success: true,
      message: 'Slot actualizado correctamente',
      data: {
        partidoId: matchId,
        nuevaFecha: nuevoSlot.disponibilidad.fecha,
        nuevaHora: nuevoSlot.horaInicio,
      },
    };
  }

  /**
   * Intercambia slots entre dos partidos
   */
  async intercambiarSlots(tournamentId: string, matchId1: string, matchId2: string) {
    // Obtener ambos partidos
    const [partido1, partido2] = await Promise.all([
      this.prisma.match.findUnique({ where: { id: matchId1 } }),
      this.prisma.match.findUnique({ where: { id: matchId2 } }),
    ]);

    if (!partido1 || !partido2) {
      throw new NotFoundException('Uno o ambos partidos no encontrados');
    }

    // Obtener slots actuales
    const [slot1, slot2] = await Promise.all([
      this.prisma.torneoSlot.findFirst({ where: { matchId: matchId1 }, include: { disponibilidad: true } }),
      this.prisma.torneoSlot.findFirst({ where: { matchId: matchId2 }, include: { disponibilidad: true } }),
    ]);

    // Si alguno no tiene slot, no se puede intercambiar
    if (!slot1 || !slot2) {
      throw new BadRequestException('Ambos partidos deben tener slots asignados para intercambiar');
    }

    // Transacción
    await this.prisma.$transaction(async (tx) => {
      // Intercambiar matchId en slots
      await tx.torneoSlot.update({
        where: { id: slot1.id },
        data: { matchId: matchId2 },
      });

      await tx.torneoSlot.update({
        where: { id: slot2.id },
        data: { matchId: matchId1 },
      });

      // Actualizar fechas en partidos
      await tx.match.update({
        where: { id: matchId1 },
        data: {
          fechaProgramada: slot2.disponibilidad.fecha,
          horaProgramada: slot2.horaInicio,
          torneoCanchaId: slot2.torneoCanchaId,
        },
      });

      await tx.match.update({
        where: { id: matchId2 },
        data: {
          fechaProgramada: slot1.disponibilidad.fecha,
          horaProgramada: slot1.horaInicio,
          torneoCanchaId: slot1.torneoCanchaId,
        },
      });
    });

    return {
      success: true,
      message: 'Slots intercambiados correctamente',
      data: {
        partido1: { id: matchId1, nuevaFecha: slot2.disponibilidad.fecha, nuevaHora: slot2.horaInicio },
        partido2: { id: matchId2, nuevaFecha: slot1.disponibilidad.fecha, nuevaHora: slot1.horaInicio },
      },
    };
  }
}

