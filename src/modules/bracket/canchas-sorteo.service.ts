import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DateService } from '../../common/services/date.service';
import { BracketService } from './bracket.service';
import { AsignacionSlotsService } from './asignacion-slots.service';
import {
  CerrarInscripcionesSortearDto,
  SorteoMasivoResponse,
} from './dto/canchas-sorteo.dto';
import { Prisma, CategoriaEstado, FixtureVersionEstado, MatchStatus } from '@prisma/client';
import { ESTADOS_TERMINALES, esTerminal } from './match-estados';
import { MINIMO_PAREJAS_SORTEO } from './bracket.constants';

@Injectable()
export class CanchasSorteoService {
  constructor(
    private prisma: PrismaService,
    private dateService: DateService,
    private bracketService: BracketService,
    private asignacionSlots: AsignacionSlotsService,
  ) {}

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
      if (catData.inscripciones.length < MINIMO_PAREJAS_SORTEO) {
        throw new BadRequestException(
          `La categor├¡a ${catData.nombre} tiene solo ${catData.inscripciones.length} inscripciones confirmadas. M├¡nimo requerido: ${MINIMO_PAREJAS_SORTEO}`
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
      // console.log(`[Sorteo] Filtrando desde ${fechaDesde}: ${diasFiltrados.length} d├¡as disponibles (de ${diasConfig.length} total)`);
    }

    // Liberar slots de sorteos anteriores para permitir nueva asignación.
    // Libera TODOS los ocupados/reservados (incluidos huérfanos sin matchId, p.ej.
    // los que dejó programarPartidoAutomatico) EXCEPTO los de partidos ya decididos:
    // esos quedan como anclas (no se mueven), igual que en reprogramar/re-sortear.
    const partidosDecididos = await this.prisma.match.findMany({
      where: {
        tournamentId,
        estado: { in: [...ESTADOS_TERMINALES] },
        torneoCanchaId: { not: null },
        fechaProgramada: { not: null },
        horaProgramada: { not: null },
      },
      select: { torneoCanchaId: true, fechaProgramada: true, horaProgramada: true },
    });
    const slotsProtegidos = new Set(
      partidosDecididos.map(p => `${p.torneoCanchaId}|${p.fechaProgramada}|${p.horaProgramada}`),
    );
    const slotsOcupados = await this.prisma.torneoSlot.findMany({
      where: {
        disponibilidad: { tournamentId },
        estado: { in: ['RESERVADO', 'OCUPADO'] },
      },
      include: { disponibilidad: { select: { fecha: true } } },
    });
    const slotsALiberar = slotsOcupados
      .filter(s => !slotsProtegidos.has(`${s.torneoCanchaId}|${s.disponibilidad.fecha}|${s.horaInicio}`))
      .map(s => s.id);
    if (slotsALiberar.length > 0) {
      await this.prisma.torneoSlot.updateMany({
        where: { id: { in: slotsALiberar } },
        data: { estado: 'LIBRE', matchId: null },
      });
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
    const asignaciones = await this.asignacionSlots.asignarSlots(tournamentId, categoriasData, diasFiltrados);

    // Validar (NO falla si faltan slots: el sorteo guarda lo que entra y avisa)
    const validacion = await this.validarTodosLosPartidosAsignados(tournamentId, categoriasData);

    let mensaje = `Sorteo completado. ${asignaciones.totalPartidosAsignados} partidos asignados a slots.`;

    // Aviso cuantificado: cuántas franjas/horas faltan y en qué día.
    let sinProgramar: SorteoMasivoResponse['sinProgramar'];
    if (validacion.partidosSinFecha > 0) {
      const torneo = await this.prisma.tournament.findUnique({
        where: { id: tournamentId },
        // @ts-ignore - minutosPorPartido existe en el schema
        select: { minutosPorPartido: true },
      });
      const slotMin = ((torneo as any)?.minutosPorPartido as number) || 120;
      const total = validacion.partidosSinFecha;
      const horasFaltantes = Math.round(((total * slotMin) / 60) * 10) / 10;
      const hayFinales = !!(validacion.porFaseSinFecha['FINAL'] || validacion.porFaseSinFecha['SEMIS']);
      const diaFinales = diasFiltrados.length ? diasFiltrados[diasFiltrados.length - 1].fecha : null;

      // Canchas del día de finales (para sugerir horas extra concretas)
      let canchasUltimoDia = 1;
      if (diasFiltrados.length) {
        const slotsUltimo = await this.prisma.torneoSlot.findMany({
          where: { disponibilidadId: diasFiltrados[diasFiltrados.length - 1].id },
          select: { torneoCanchaId: true },
        });
        canchasUltimoDia = new Set(slotsUltimo.map(s => s.torneoCanchaId)).size || 1;
      }

      const fmtHoras = (h: number) => {
        const hh = Math.floor(h); const mm = Math.round((h - hh) * 60);
        return mm ? `${hh}h${String(mm).padStart(2, '0')}` : `${hh}h`;
      };
      const fmtFecha = (f: string | null) => (f ? f.split('-').reverse().join('/') : '');
      const detalle = Object.entries(validacion.porFaseSinFecha)
        .map(([fase, c]) => `${c} ${fase}`)
        .join(', ');

      const franjasPorCancha = Math.ceil(total / canchasUltimoDia);
      const horasExtra = (franjasPorCancha * slotMin) / 60;

      const mensajeSP = `${total} partido(s) quedaron sin horario: ${detalle}.`;
      let solucion =
        `Te faltan ${total} franja(s) (≈ ${fmtHoras(horasFaltantes)} de cancha en total). ` +
        `Con ${canchasUltimoDia} cancha(s), alcanza con extender ~${fmtHoras(horasExtra)} el horario (o sumar canchas) en el Paso 2.`;
      if (hayFinales && diaFinales) {
        solucion += ` Como son semis/finales, agregá esas franjas el último día (${fmtFecha(diaFinales)}).`;
      }

      sinProgramar = {
        total,
        porFase: validacion.porFaseSinFecha,
        slotsFaltantes: total,
        horasFaltantes,
        hayFinales,
        diaFinales,
        mensaje: mensajeSP,
        solucion,
      };
      mensaje += ` ${mensajeSP}`;
    }

    if (validacion.partidosSinCancha > 0) {
      const detalleSinCancha = Object.entries(validacion.porFase)
        .map(([fase, cantidad]) => `${cantidad} ${fase}`)
        .join(', ');
      mensaje += ` ${validacion.partidosSinCancha} partidos con fecha pero sin cancha: ${detalleSinCancha}.`;
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
      sinProgramar,
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
   * Valida que todos los partidos tienen fecha/hora asignada.
   * Permite partidos sin cancha (torneoCanchaId = null) - se asignarán manualmente en Auditoría.
   * Solo falla si el partido no tiene ni siquiera fecha programada.
   */
  private async validarTodosLosPartidosAsignados(
    tournamentId: string,
    categoriasData: Array<{ categoria: any; nombre: string; inscripciones: any[] }>,
  ): Promise<{
    partidosSinFecha: number;
    porFaseSinFecha: Record<string, number>;
    partidosSinCancha: number;
    porFase: Record<string, number>;
  }> {
    const fixtureVersionIds = categoriasData
      .map(c => c.categoria.fixtureVersionId)
      .filter(Boolean);

    if (fixtureVersionIds.length === 0) {
      return { partidosSinFecha: 0, porFaseSinFecha: {}, partidosSinCancha: 0, porFase: {} };
    }

    // Partidos SIN FECHA (no entraron por falta de franjas). YA NO es error:
    // el motor honesto deja sin horario lo que no cabe; se reporta como aviso.
    const partidosSinFecha = await this.prisma.match.findMany({
      where: { fixtureVersionId: { in: fixtureVersionIds }, esBye: false, fechaProgramada: null },
      select: { id: true, ronda: true },
    });
    const porFaseSinFecha: Record<string, number> = {};
    for (const p of partidosSinFecha) {
      porFaseSinFecha[p.ronda] = (porFaseSinFecha[p.ronda] || 0) + 1;
    }

    // Partidos CON FECHA pero SIN CANCHA (advertencia menor)
    const partidosSinCancha = await this.prisma.match.findMany({
      where: {
        fixtureVersionId: { in: fixtureVersionIds },
        esBye: false,
        fechaProgramada: { not: null },
        torneoCanchaId: null,
      },
      select: { id: true, ronda: true },
    });
    const porFaseSinCancha: Record<string, number> = {};
    for (const p of partidosSinCancha) {
      porFaseSinCancha[p.ronda] = (porFaseSinCancha[p.ronda] || 0) + 1;
    }

    return {
      partidosSinFecha: partidosSinFecha.length,
      porFaseSinFecha,
      partidosSinCancha: partidosSinCancha.length,
      porFase: porFaseSinCancha,
    };
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
    // console.log('[Sorteo] Ejecutando rollback...');

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

    // console.log('[Sorteo] Rollback completado');
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

    const partidosConResultado = partidos.filter(p => esTerminal(p.estado));
    const partidosSinResultado = partidos.filter(p => !esTerminal(p.estado));

    if (partidosSinResultado.length === 0) {
      throw new BadRequestException('No hay partidos pendientes para re-sortear');
    }

    // Liberar slots de partidos sin resultado (por tupla cancha+fecha+hora:
    // robusto haya o no matchId en el slot —los auto-programados no lo tienen).
    for (const partido of partidosSinResultado) {
      if (partido.torneoCanchaId && partido.fechaProgramada && partido.horaProgramada) {
        await this.prisma.torneoSlot.updateMany({
          where: {
            torneoCanchaId: partido.torneoCanchaId,
            horaInicio: partido.horaProgramada,
            disponibilidad: { fecha: partido.fechaProgramada },
          },
          data: { estado: 'LIBRE', matchId: null },
        });
      }
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

    const asignaciones = await this.asignacionSlots.asignarSlots(
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
   * REPROGRAMACIÓN GENERAL — reacomoda toda la agenda desde cero con el motor
   * predictivo (incluye las rondas futuras, cuyo slot es determinístico aunque
   * no se sepa el ocupante). Los partidos ya jugados son anclas: no se mueven y
   * su hora real alimenta la predicción de los que vienen después.
   */
  async reprogramarGeneral(tournamentId: string) {
    // 1. Liberar las franjas de los partidos NO jugados ya programados y limpiar
    //    su programación (por tupla cancha+fecha+hora, robusto haya o no matchId).
    const pendientes = await this.prisma.match.findMany({
      where: {
        tournamentId,
        estado: { notIn: [...ESTADOS_TERMINALES] },
        torneoCanchaId: { not: null },
        fechaProgramada: { not: null },
        horaProgramada: { not: null },
      },
      select: { id: true, torneoCanchaId: true, fechaProgramada: true, horaProgramada: true },
    });

    for (const m of pendientes) {
      await this.prisma.torneoSlot.updateMany({
        where: {
          torneoCanchaId: m.torneoCanchaId!,
          horaInicio: m.horaProgramada!,
          disponibilidad: { fecha: m.fechaProgramada! },
        },
        data: { estado: 'LIBRE', matchId: null },
      });
    }

    if (pendientes.length > 0) {
      await this.prisma.match.updateMany({
        where: { id: { in: pendientes.map((p) => p.id) } },
        data: { fechaProgramada: null, horaProgramada: null, torneoCanchaId: null },
      });
    }

    // 2. Categorías sorteadas (con fixture) → datos para el motor predictivo.
    const tcs = await this.prisma.tournamentCategory.findMany({
      where: { tournamentId, fixtureVersionId: { not: null } },
    });
    if (tcs.length === 0) {
      throw new BadRequestException('No hay categorías sorteadas para reprogramar');
    }
    const categoriasData = tcs.map((tc) => ({
      categoria: tc,
      nombre: '',
      inscripciones: [] as any[],
    }));

    const diasConfig = await this.prisma.torneoDisponibilidadDia.findMany({
      where: { tournamentId },
      orderBy: [{ fecha: 'asc' }, { horaInicio: 'asc' }],
    });

    // 3. Motor predictivo: asigna todas las posiciones (incluidas las futuras),
    //    respeta dependencias/descanso y deja sin horario lo que no entra.
    const resultado = await this.asignacionSlots.asignarSlots(
      tournamentId,
      categoriasData,
      diasConfig,
    );

    return {
      success: true,
      message: 'Agenda reprogramada correctamente',
      asignados: resultado.totalPartidosAsignados,
      sinFranja: resultado.partidosSinSlot,
      distribucionPorDia: resultado.distribucionPorDia,
    };
  }

}

