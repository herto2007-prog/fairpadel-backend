import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BracketService } from './bracket.service';
import { horaAMinutos } from '../../common/utils/time-helpers';
import { obtenerFasesParaDia } from './fases-dia.util';
import { planDiasPorFormato } from './presets-agenda';
import {
  ConfigurarFinalesDto,
  ConfigurarDiaJuegoDto,
  AplicarPresetDto,
  CalculoSlotsResponse,
} from './dto/canchas-sorteo.dto';

/**
 * Configuración del calendario del torneo: horarios de finales, días de
 * juego, generación de slots, canchas y configuración general.
 * Extraído tal cual de CanchasSorteoService (refactor de archivos monstruo);
 * la lógica no cambió.
 */
@Injectable()
export class TorneoCalendarioService {
  constructor(
    private prisma: PrismaService,
    private bracketService: BracketService,
  ) {}

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
      obtenerFasesParaDia(fecha).join(',');
    
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
   * PASO 1.b (preset): aplica un "paquete predeterminado" de agenda por formato.
   * Autogenera los días (ventana + fasesPermitidas) según el formato y reemplaza
   * los días existentes. Reusa configurarDiaJuego (que genera los slots).
   */
  async aplicarPreset(dto: AplicarPresetDto) {
    const torneo = await this.prisma.tournament.findUnique({ where: { id: dto.tournamentId } });
    if (!torneo) throw new NotFoundException('Torneo no encontrado');

    const canchas = await this.prisma.torneoCancha.findMany({
      where: { tournamentId: dto.tournamentId, activa: true },
      select: { id: true },
    });
    if (canchas.length === 0) {
      throw new BadRequestException('Primero asigná al menos una cancha al torneo');
    }
    const canchasIds = canchas.map((c) => c.id);

    const minutosSlot = dto.minutosSlot ?? 90;
    const plan = planDiasPorFormato(dto.formato, dto.fechas, minutosSlot);
    if (plan.length === 0) throw new BadRequestException('No hay fechas válidas');

    // Reemplazar los días existentes (eliminarDia bloquea si ya hay partidos programados).
    const diasExistentes = await this.prisma.torneoDisponibilidadDia.findMany({
      where: { tournamentId: dto.tournamentId },
      select: { id: true },
    });
    for (const d of diasExistentes) await this.eliminarDia(d.id);

    let totalSlots = 0;
    const dias: { fecha: string; horaInicio: string; horaFin: string; fasesPermitidas: string[] }[] = [];
    for (const p of plan) {
      const r = await this.configurarDiaJuego({
        tournamentId: dto.tournamentId,
        fecha: p.fecha,
        horaInicio: p.horaInicio,
        horaFin: p.horaFin,
        minutosSlot: p.minutosSlot,
        canchasIds,
        fasesPermitidas: p.fasesPermitidas,
      } as ConfigurarDiaJuegoDto);
      totalSlots += (r.data?.slotsGenerados as number) || 0;
      dias.push({ fecha: p.fecha, horaInicio: p.horaInicio, horaFin: p.horaFin, fasesPermitidas: p.fasesPermitidas });
    }

    return {
      success: true,
      message: `Agenda '${dto.formato}' aplicada: ${dias.length} día(s), ${totalSlots} slots`,
      data: { formato: dto.formato, dias, totalSlots, canchas: canchasIds.length },
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
   * Estima la capacidad necesaria para una cantidad ESPERADA de parejas por
   * categoría (planificación antes de tener inscriptos). Reusa el cálculo de
   * partidos por bracket y lo multiplica por la cantidad de categorías.
   */
  async estimarCapacidad(tournamentId: string, parejasPorCategoria: number) {
    const cats = Math.max(1, await this.prisma.tournamentCategory.count({ where: { tournamentId } }));
    const n = Math.max(4, Math.floor(parejasPorCategoria) || 0);
    const porCat = this.bracketService.calcularSlotsNecesarios(n);
    const partidos = cats * porCat.totalPartidos;
    return {
      parejasPorCategoria: n,
      categorias: cats,
      partidosPorCategoria: porCat.totalPartidos,
      partidos,
      horasNecesarias: Math.ceil(partidos * 1.5),
    };
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
}
