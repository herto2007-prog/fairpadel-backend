import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DateService } from '../../common/services/date.service';
import { BracketService } from './bracket.service';
import {
  ConfigurarFinalesDto,
  ConfigurarDiaJuegoDto,
  CerrarInscripcionesSortearDto,
  CalculoSlotsResponse,
  SorteoMasivoResponse,
} from './dto/canchas-sorteo.dto';
import { FaseBracket } from './dto/generate-bracket.dto';

interface SlotReserva {
  fecha: string;
  horaInicio: string;
  horaFin: string;
  torneoCanchaId: string;
  categoriaId: string;
  fase: FaseBracket;
  ordenPartido: number;
}

@Injectable()
export class CanchasSorteoService {
  constructor(
    private prisma: PrismaService,
    private dateService: DateService,
    private bracketService: BracketService,
  ) {}

  /**
   * PASO 1.a: Configurar horarios de finales
   * También crea automáticamente el día de finales con sus slots
   */
  async configurarFinales(dto: ConfigurarFinalesDto) {
    // Obtener el torneo para conocer su fecha de finales
    const torneo = await this.prisma.tournament.findUnique({
      where: { id: dto.tournamentId },
    });

    if (!torneo) {
      throw new NotFoundException('Torneo no encontrado');
    }

    if (!torneo.fechaFinales) {
      throw new BadRequestException('El torneo no tiene fecha de finales configurada');
    }

    // Actualizar configuración de finales
    await this.prisma.tournament.update({
      where: { id: dto.tournamentId },
      data: {
        horaInicioFinales: dto.horaInicio,
        horaFinFinales: dto.horaFin,
        canchasFinales: dto.canchasFinalesIds,
      },
    });

    // Crear o actualizar el día de finales automáticamente
    const fechaFinales = this.dateService.getDateOnly(torneo.fechaFinales);
    
    const disponibilidad = await this.prisma.torneoDisponibilidadDia.upsert({
      where: {
        tournamentId_fecha: {
          tournamentId: dto.tournamentId,
          fecha: torneo.fechaFinales,
        },
      },
      update: {
        horaInicio: dto.horaInicio,
        horaFin: dto.horaFin,
        minutosSlot: 90, // Duración estándar para finales
      },
      create: {
        tournamentId: dto.tournamentId,
        fecha: torneo.fechaFinales,
        horaInicio: dto.horaInicio,
        horaFin: dto.horaFin,
        minutosSlot: 90,
      },
    });

    // Generar slots para las canchas de finales
    const slotsGenerados = await this.generarSlotsParaDia(
      disponibilidad.id,
      dto.canchasFinalesIds,
      dto.horaInicio,
      dto.horaFin,
      90,
    );

    return {
      success: true,
      message: 'Configuración de finales guardada',
      data: {
        horaInicio: dto.horaInicio,
        horaFin: dto.horaFin,
        canchasFinales: dto.canchasFinalesIds,
        fechaFinales,
        diaId: disponibilidad.id,
        slotsGenerados,
      },
    };
  }

  /**
   * PASO 1.b: Configurar días de juego
   * Crea los slots (TorneoSlot) para el día configurado
   */
  async configurarDiaJuego(dto: ConfigurarDiaJuegoDto) {
    // Verificar que el torneo existe
    const torneo = await this.prisma.tournament.findUnique({
      where: { id: dto.tournamentId },
    });

    if (!torneo) {
      throw new NotFoundException('Torneo no encontrado');
    }

    // Crear o actualizar disponibilidad del día
    const fecha = this.dateService.parse(dto.fecha);
    
    const disponibilidad = await this.prisma.torneoDisponibilidadDia.upsert({
      where: {
        tournamentId_fecha: {
          tournamentId: dto.tournamentId,
          fecha: fecha,
        },
      },
      update: {
        horaInicio: dto.horaInicio,
        horaFin: dto.horaFin,
        minutosSlot: dto.minutosSlot,
      },
      create: {
        tournamentId: dto.tournamentId,
        fecha: fecha,
        horaInicio: dto.horaInicio,
        horaFin: dto.horaFin,
        minutosSlot: dto.minutosSlot,
      },
    });

    // Generar slots para cada cancha
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
        slotsGenerados,
        canchas: dto.canchasIds.length,
      },
    };
  }

  /**
   * Genera slots (TorneoSlot) para un día específico
   * El último slot puede extenderse más allá de horaFin (flexibilidad inteligente)
   */
  private async generarSlotsParaDia(
    disponibilidadId: string,
    canchasIds: string[],
    horaInicio: string,
    horaFin: string,
    minutosSlot: number,
  ): Promise<number> {
    const inicio = this.parseHora(horaInicio);
    const fin = this.parseHora(horaFin);
    const minutosTotales = (fin.getTime() - inicio.getTime()) / (1000 * 60);
    
    // Math.ceil para incluir el último slot aunque se extienda más allá del horario
    // Ej: 18:00-23:00 (300min) / 90min = 3.33 → 4 slots (el último termina a las 00:00)
    const slotsPorCancha = Math.ceil(minutosTotales / minutosSlot);

    let slotsGenerados = 0;

    for (const canchaId of canchasIds) {
      for (let i = 0; i < slotsPorCancha; i++) {
        const slotInicio = new Date(inicio.getTime() + i * minutosSlot * 60000);
        const slotFin = new Date(slotInicio.getTime() + minutosSlot * 60000);

        await this.prisma.torneoSlot.create({
          data: {
            disponibilidadId,
            torneoCanchaId: canchaId,
            horaInicio: this.formatHora(slotInicio),
            horaFin: this.formatHora(slotFin),
            estado: 'LIBRE',
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
    // Obtener información de las categorías
    const categorias = await this.prisma.tournamentCategory.findMany({
      where: {
        id: { in: categoriasIds },
        tournamentId,
      },
    });
    
    // Obtener inscripciones confirmadas para estas categorías
    const inscripciones = await this.prisma.inscripcion.findMany({
      where: {
        tournamentId,
        estado: 'CONFIRMADA',
        categoryId: { in: categorias.map(c => c.categoryId) },
      },
    });
    
    // Agrupar inscripciones por categoryId
    const inscripcionesPorCategoria = new Map<string, typeof inscripciones>();
    for (const cat of categorias) {
      inscripcionesPorCategoria.set(
        cat.id,
        inscripciones.filter(i => i.categoryId === cat.categoryId)
      );
    }

    // Obtener información de las categorías base
    const categoriasBase = await this.prisma.category.findMany({
      where: {
        id: { in: categorias.map(c => c.categoryId) },
      },
    });
    
    const categoriaMap = new Map(categoriasBase.map(c => [c.id, c]));
    
    // Calcular slots necesarios por categoría
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

    // Obtener slots disponibles (libres) del torneo
    const slotsLibres = await this.prisma.torneoSlot.findMany({
      where: {
        disponibilidad: {
          tournamentId,
        },
        estado: 'LIBRE',
      },
      include: {
        disponibilidad: true,
      },
    });

    const slotsDisponibles = slotsLibres.length;
    const slotsFaltantes = Math.max(0, totalSlotsNecesarios - slotsDisponibles);

    // Calcular duración promedio y horas
    let minutosTotales = 0;
    for (const slot of slotsLibres) {
      const inicio = this.parseHora(slot.horaInicio);
      const fin = this.parseHora(slot.horaFin);
      minutosTotales += (fin.getTime() - inicio.getTime()) / (1000 * 60);
    }
    
    const duracionPromedioMinutos = slotsDisponibles > 0 
      ? Math.round(minutosTotales / slotsDisponibles)
      : 90;

    const horasNecesarias = Math.ceil((totalSlotsNecesarios * duracionPromedioMinutos) / 60);
    const horasDisponibles = Math.ceil((slotsDisponibles * duracionPromedioMinutos) / 60);

    return {
      totalSlotsNecesarios,
      slotsDisponibles,
      slotsFaltantes,
      horasNecesarias,
      horasDisponibles,
      duracionPromedioMinutos,
      detallePorCategoria,
      valido: slotsFaltantes === 0,
      mensaje: slotsFaltantes > 0
        ? `Faltan ${slotsFaltantes} slots (${Math.ceil((slotsFaltantes * duracionPromedioMinutos) / 60)}h). Necesitas ${totalSlotsNecesarios} slots (${horasNecesarias}h) pero tienes ${slotsDisponibles} slots (${horasDisponibles}h) disponibles.`
        : undefined,
    };
  }

  /**
   * PASO 2: Cerrar inscripciones y sortear múltiples categorías
   */
  async cerrarInscripcionesYsortear(
    dto: CerrarInscripcionesSortearDto,
  ): Promise<SorteoMasivoResponse> {
    const { tournamentId, categoriasIds } = dto;

    // 1. Verificar que hay suficientes slots
    const calculo = await this.calcularSlotsNecesarios(tournamentId, categoriasIds);
    
    if (!calculo.valido) {
      throw new BadRequestException({
        success: false,
        message: calculo.mensaje,
        detalle: calculo,
      });
    }

    // 2. Obtener slots disponibles ordenados por fecha/hora
    const slotsDisponibles = await this.obtenerSlotsDisponiblesOrdenados(tournamentId);

    // 3. Procesar cada categoría
    const categoriasSorteadas = [];
    const distribucionPorDia: Record<string, { slots: number; categorias: Set<string> }> = {};
    let slotIndex = 0;

    // Obtener todas las inscripciones confirmadas para todas las categorías
    const todasInscripciones = await this.prisma.inscripcion.findMany({
      where: {
        tournamentId,
        estado: 'CONFIRMADA',
      },
    });
    
    for (const categoriaInfo of calculo.detallePorCategoria) {
      const categoria = await this.prisma.tournamentCategory.findUnique({
        where: { id: categoriaInfo.categoriaId },
      });

      if (!categoria) continue;
      
      // Obtener inscripciones para esta categoría
      const inscripcionesCategoria = todasInscripciones.filter(
        i => i.categoryId === categoria.categoryId
      );

      // Cerrar inscripciones de la categoría
      await this.prisma.tournamentCategory.update({
        where: { id: categoria.id },
        data: { estado: 'INSCRIPCIONES_CERRADAS' },
      });

      // Crear objeto con inscripciones para compatibilidad
      const categoriaConInscripciones = {
        ...categoria,
        inscripciones: inscripcionesCategoria,
      };
      
      // Reservar slots para esta categoría
      const slotsReservados = await this.reservarSlotsParaCategoria(
        categoriaConInscripciones,
        categoriaInfo.nombre,
        slotsDisponibles,
        slotIndex,
        distribucionPorDia,
      );

      slotIndex += slotsReservados.length;

      categoriasSorteadas.push({
        categoriaId: categoria.id,
        nombre: categoriaInfo.nombre,
        fixtureVersionId: '', // Se llena después del sorteo
        totalPartidos: categoriaInfo.slotsNecesarios,
        slotsReservados: slotsReservados.length,
      });
    }

    // 4. Generar distribución por día para la respuesta
    const distribucionResponse = Object.entries(distribucionPorDia).map(
      ([fecha, info]) => ({
        fecha,
        slotsReservados: info.slots,
        categorias: Array.from(info.categorias),
      }),
    );

    return {
      success: true,
      message: `Se sortearon ${categoriasSorteadas.length} categorías con ${slotIndex} slots reservados`,
      categoriasSorteadas,
      slotsTotalesReservados: slotIndex,
      distribucionPorDia: distribucionResponse,
    };
  }

  /**
   * Obtiene slots disponibles ordenados por fecha y hora
   */
  private async obtenerSlotsDisponiblesOrdenados(tournamentId: string) {
    return this.prisma.torneoSlot.findMany({
      where: {
        disponibilidad: {
          tournamentId,
        },
        estado: 'LIBRE',
      },
      include: {
        disponibilidad: true,
        torneoCancha: {
          include: {
            sedeCancha: true,
          },
        },
      },
      orderBy: [
        { disponibilidad: { fecha: 'asc' } },
        { horaInicio: 'asc' },
      ],
    });
  }

  /**
   * Reserva slots para una categoría específica
   */
  private async reservarSlotsParaCategoria(
    categoria: { id: string; tournamentId: string; categoryId: string; inscripciones: any[] },
    nombreCategoria: string,
    slotsDisponibles: any[],
    startIndex: number,
    distribucionPorDia: Record<string, { slots: number; categorias: Set<string> }>,
  ): Promise<SlotReserva[]> {
    const parejas = categoria.inscripciones.length;
    const calculo = this.bracketService.calcularSlotsNecesarios(parejas);
    
    const slotsReservados: SlotReserva[] = [];
    let slotIndex = startIndex;

    // Reservar slots para cada fase
    for (const faseInfo of calculo.detallePorFase) {
      for (let i = 0; i < faseInfo.partidos; i++) {
        if (slotIndex >= slotsDisponibles.length) {
          throw new BadRequestException('No hay suficientes slots disponibles');
        }

        const slot = slotsDisponibles[slotIndex];
        const fecha = slot.disponibilidad.fecha.toISOString().split('T')[0];

        slotsReservados.push({
          fecha,
          horaInicio: slot.horaInicio,
          horaFin: slot.horaFin,
          torneoCanchaId: slot.torneoCanchaId,
          categoriaId: categoria.id,
          fase: faseInfo.fase as FaseBracket,
          ordenPartido: i + 1,
        });

        // Marcar slot como reservado
        await this.prisma.torneoSlot.update({
          where: { id: slot.id },
          data: { estado: 'RESERVADO' },
        });

        // Actualizar distribución por día
        if (!distribucionPorDia[fecha]) {
          distribucionPorDia[fecha] = { slots: 0, categorias: new Set() };
        }
        distribucionPorDia[fecha].slots++;
        distribucionPorDia[fecha].categorias.add(nombreCategoria);

        slotIndex++;
      }
    }

    return slotsReservados;
  }

  // Helper: Parsear hora string a Date
  private parseHora(hora: string): Date {
    return new Date(`2000-01-01T${hora}`);
  }

  // Helper: Formatear Date a hora string
  private formatHora(fecha: Date): string {
    return fecha.toTimeString().slice(0, 5);
  }

  /**
   * Obtiene las canchas asignadas a un torneo
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
      canchas: torneoCanchas.map((tc) => ({
        id: tc.id, // ID de TorneoCancha (usado para asignación)
        nombre: tc.sedeCancha.nombre,
        tipo: tc.sedeCancha.tipo,
        iluminacion: tc.sedeCancha.tieneLuz,
        sede: tc.sedeCancha.sede,
      })),
    };
  }

  /**
   * Obtiene la configuración completa de canchas y sorteo de un torneo
   */
  async obtenerConfiguracion(tournamentId: string) {
    const [dias, torneo] = await Promise.all([
      this.prisma.torneoDisponibilidadDia.findMany({
        where: { tournamentId },
        include: {
          _count: { select: { slots: { where: { estado: 'LIBRE' } } } },
          slots: {
            select: { torneoCanchaId: true },
            distinct: ['torneoCanchaId'],
            where: { estado: 'LIBRE' },
          },
        },
        orderBy: { fecha: 'asc' },
      }),
      this.prisma.tournament.findUnique({
        where: { id: tournamentId },
        select: {
          horaInicioFinales: true,
          horaFinFinales: true,
          canchasFinales: true,
        },
      }),
    ]);

    return {
      success: true,
      data: {
        dias: dias.map((d) => ({
          id: d.id,
          fecha: d.fecha,
          horaInicio: d.horaInicio,
          horaFin: d.horaFin,
          minutosSlot: d.minutosSlot,
          slotsLibres: d._count.slots,
          canchas: d.slots.length,
          canchasIds: d.slots.map((s) => s.torneoCanchaId),
        })),
        finales: torneo?.horaInicioFinales
          ? {
              horaInicio: torneo.horaInicioFinales,
              horaFin: torneo.horaFinFinales,
              canchasIds: torneo.canchasFinales || [],
            }
          : null,
      },
    };
  }

  /**
   * Elimina un día de juego y todos sus slots asociados
   */
  async eliminarDia(diaId: string) {
    // Verificar que el día existe
    const dia = await this.prisma.torneoDisponibilidadDia.findUnique({
      where: { id: diaId },
      include: {
        slots: {
          where: { estado: 'OCUPADO' },
        },
      },
    });

    if (!dia) {
      throw new NotFoundException('Día no encontrado');
    }

    // Verificar que no hay slots ocupados
    if (dia.slots.length > 0) {
      throw new BadRequestException(
        `No se puede eliminar el día porque tiene ${dia.slots.length} slot(s) ocupado(s) con partidos programados`
      );
    }

    // Eliminar el día (cascada eliminará los slots libres)
    await this.prisma.torneoDisponibilidadDia.delete({
      where: { id: diaId },
    });

    return {
      success: true,
      message: 'Día eliminado correctamente',
    };
  }
}
