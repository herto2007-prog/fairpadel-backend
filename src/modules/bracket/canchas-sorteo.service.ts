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
   * - 4 horas de descanso entre fases del mismo d├¡a
   * - 4 horas de descanso entre partidos de la misma pareja
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
   * 3. Descanso de 3h solo si es mismo dia (dia diferente = siempre valido)
   * 4. BYE ignorados (no reciben slots)
   */
  private async asignarSlots(
    tournamentId: string,
    categoriasData: Array<{ categoria: any; nombre: string; inscripciones: any[] }>,
    diasConfig: any[],
  ): Promise<{ totalPartidosAsignados: number; distribucionPorDia: Record<string, number> }> {
    const distribucionPorDia: Record<string, number> = {};
    const ultimoPartidoPorPareja = new Map<string, { fecha: string; horaFin: string }>();
    const partidosAsignados = new Set<string>();

    // 1. ORDENAR CATEGORIAS: 
    // - Primero las que tienen repechaje (mas inscriptos primero)
    // - Luego las que no tienen repechaje (mas inscriptos primero)
    const categoriasOrdenadas = [...categoriasData].sort((a, b) => {
      const aTieneRepechaje = ((a as any).bracketConfig?.partidosRepechaje || 0) > 0;
      const bTieneRepechaje = ((b as any).bracketConfig?.partidosRepechaje || 0) > 0;
      
      // Si A tiene repechaje y B no, A va primero
      if (aTieneRepechaje && !bTieneRepechaje) return -1;
      // Si B tiene repechaje y A no, B va primero
      if (!aTieneRepechaje && bTieneRepechaje) return 1;
      
      // Si ambas tienen o no tienen repechaje, ordenar por cantidad (mayor primero)
      return b.inscripciones.length - a.inscripciones.length;
    });

    // 2. PROCESAR CADA DIA
    for (let diaIndex = 0; diaIndex < diasConfig.length; diaIndex++) {
      const dia = diasConfig[diaIndex];
      const fasesPermitidas = (dia.fasesPermitidas as string)?.split(',') as FaseBracket[] || 
        this.obtenerFasesParaDia(dia.fecha);

      if (fasesPermitidas.length === 0) continue;

      const slotsDelDia = await this.prisma.torneoSlot.findMany({
        where: { disponibilidadId: dia.id, estado: 'LIBRE' },
        orderBy: { horaInicio: 'asc' },
      });

      if (slotsDelDia.length === 0) continue;

      const slotsUsados = new Set<number>();

      // NUEVO: Buscar partidos de días anteriores con fecha pero SIN cancha (pendientes)
      // Estos partidos "flotan" y se intentan asignar en el día actual si hay slots libres
      const partidosPendientesDiasAnteriores = await this.prisma.match.findMany({
        where: {
          fixtureVersionId: { in: categoriasData.map(c => c.categoria.fixtureVersionId).filter(Boolean) },
          ronda: { in: fasesPermitidas },
          fechaProgramada: { not: null }, // Ya tiene fecha
          torneoCanchaId: null, // Pero no tiene cancha
          esBye: false,
        },
        select: {
          id: true,
          ronda: true,
          inscripcion1Id: true,
          inscripcion2Id: true,
          fechaProgramada: true,
          horaProgramada: true,
        },
      });

      // Intentar mover partidos pendientes al día actual primero
      for (const partidoPendiente of partidosPendientesDiasAnteriores) {
        // Buscar slot disponible para este partido
        for (let i = 0; i < slotsDelDia.length; i++) {
          if (slotsUsados.has(i)) continue;
          
          const slot = slotsDelDia[i];
          const insc1 = partidoPendiente.inscripcion1Id;
          const insc2 = partidoPendiente.inscripcion2Id;

          // Verificar descanso desde el último partido de cada pareja
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

          // Mover partido al día actual
          slotsUsados.add(i);
          
          await this.prisma.torneoSlot.update({
            where: { id: slot.id },
            data: { estado: 'OCUPADO', matchId: partidoPendiente.id },
          });

          await this.prisma.match.update({
            where: { id: partidoPendiente.id },
            data: {
              fechaProgramada: dia.fecha,
              horaProgramada: slot.horaInicio,
              torneoCanchaId: slot.torneoCanchaId,
            },
          });

          // Actualizar último partido por pareja
          if (insc1) {
            ultimoPartidoPorPareja.set(insc1, { fecha: dia.fecha, horaFin: slot.horaFin });
          }
          if (insc2) {
            ultimoPartidoPorPareja.set(insc2, { fecha: dia.fecha, horaFin: slot.horaFin });
          }

          partidosAsignados.add(partidoPendiente.id);
          distribucionPorDia[dia.fecha] = (distribucionPorDia[dia.fecha] || 0) + 1;
          break; // Slot asignado, pasar al siguiente partido pendiente
        }
      }

      // 3. ASIGNAR POR FASE (estricto): Toda la fase N antes que cualquier fase N+1
      for (const fase of fasesPermitidas) {
        // Repetir hasta que no haya mas partidos de esta fase para asignar
        let huboAsignacionesEnEstaFase = true;
        
        while (huboAsignacionesEnEstaFase) {
          huboAsignacionesEnEstaFase = false;

          for (const catData of categoriasOrdenadas) {
            // Buscar primer partido de esta fase/categoria sin asignar (y no BYE)
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
                partidoSiguienteId: true,
                partidoPerdedorSiguienteId: true,
              },
            });

            if (!partido) continue;

            // 4. BUSCAR PRIMER SLOT QUE CUMPLA DESCANSO
            let slotAsignado = false;
            let horaAsignada: string | null = null;
            
            for (let i = 0; i < slotsDelDia.length; i++) {
              if (slotsUsados.has(i)) continue;
              
              const slot = slotsDelDia[i];
              const insc1 = partido.inscripcion1Id;
              const insc2 = partido.inscripcion2Id;

              // Verificar descanso 3h (solo si mismo dia)
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

              // 5. ASIGNAR SLOT CON CANCHA
              slotsUsados.add(i);
              horaAsignada = slot.horaInicio;
              
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

              // Registrar ultimo partido por pareja
              if (insc1) {
                ultimoPartidoPorPareja.set(insc1, { fecha: dia.fecha, horaFin: slot.horaFin });
              }
              if (insc2) {
                ultimoPartidoPorPareja.set(insc2, { fecha: dia.fecha, horaFin: slot.horaFin });
              }

              partidosAsignados.add(partido.id);
              distribucionPorDia[dia.fecha] = (distribucionPorDia[dia.fecha] || 0) + 1;
              huboAsignacionesEnEstaFase = true;
              slotAsignado = true;
              break;
            }

            // Si no hay slot disponible en este día, el partido queda pendiente
            // Se intentará en el siguiente día (flujo normal del for de días)
            // o al final se asignará fecha estimada para Auditoría
          }
        }
      }
    }

    // NUEVO: Al final de todos los días, buscar partidos que quedaron SIN CANCHA
    // y asignarles fecha estimada del último día para que vayan a Auditoría
    const partidosSinCancha = await this.prisma.match.findMany({
      where: {
        fixtureVersionId: { in: categoriasData.map(c => c.categoria.fixtureVersionId).filter(Boolean) },
        fechaProgramada: null, // Nunca se les asignó fecha (no cupieron en ningún día)
        esBye: false,
      },
      select: {
        id: true,
        ronda: true,
      },
    });

    if (partidosSinCancha.length > 0 && diasConfig.length > 0) {
      const ultimoDia = diasConfig[diasConfig.length - 1];
      // Asignar fecha del último día + hora 23:00 (final del día)
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
   * Busca y asigna un slot v├ílido para un partido
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
}
