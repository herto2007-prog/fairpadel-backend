import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAlquilerConfigDto } from './dto/create-alquiler-config.dto';
import { CreateReservaDto, ConfirmarReservaDto, CancelarReservaDto } from './dto/create-reserva.dto';
import { ReservaCanchaEstado } from '@prisma/client';

@Injectable()
export class AlquileresService {
  constructor(private prisma: PrismaService) {}

  // ============ CONFIGURACIÓN ============

  async crearConfig(createDto: CreateAlquilerConfigDto) {
    const { sedeId, ...data } = createDto;
    
    return this.prisma.alquilerConfig.upsert({
      where: { sedeId },
      update: { ...data },
      create: { sedeId, ...data },
    });
  }

  async obtenerConfig(sedeId: string) {
    const config = await this.prisma.alquilerConfig.findUnique({
      where: { sedeId },
      include: { sede: true },
    });

    if (!config) {
      throw new NotFoundException('Configuración no encontrada');
    }

    return config;
  }

  // ============ DISPONIBILIDAD ============

  async consultarDisponibilidad(sedeId: string, fecha: string, sedeCanchaId?: string) {
    // FIX: fecha es String YYYY-MM-DD, calcular día de semana local
    const diaSemana = this.getDiaSemanaFromString(fecha);

    // Obtener canchas de la sede
    const canchas = await this.prisma.sedeCancha.findMany({
      where: {
        sedeId,
        activa: true,
        ...(sedeCanchaId && { id: sedeCanchaId }),
      },
    });

    if (canchas.length === 0) {
      throw new NotFoundException('No se encontraron canchas activas');
    }

    // Obtener reservas existentes para esa fecha
    const reservasExistentes = await this.prisma.reservaCancha.findMany({
      where: {
        sedeCanchaId: { in: canchas.map(c => c.id) },
        fecha: fecha,
        estado: { in: [ReservaCanchaEstado.PENDIENTE, ReservaCanchaEstado.CONFIRMADA] },
      },
    });

    // Obtener disponibilidades configuradas
    const disponibilidades = await this.prisma.alquilerDisponibilidad.findMany({
      where: {
        sedeCanchaId: { in: canchas.map(c => c.id) },
        diaSemana,
        activo: true,
      },
    });

    // Construir horarios disponibles por cancha
    const disponibilidadPorCancha = canchas.map(cancha => {
      const disponibilidadCancha = disponibilidades.filter(d => d.sedeCanchaId === cancha.id);
      const reservasCancha = reservasExistentes.filter(r => r.sedeCanchaId === cancha.id);

      const slots = this.generarSlots(disponibilidadCancha, reservasCancha, cancha.id);

      return {
        cancha: {
          id: cancha.id,
          nombre: cancha.nombre,
          tipo: cancha.tipo,
          tieneLuz: cancha.tieneLuz,
        },
        slots,
      };
    });

    return {
      fecha,
      sedeId,
      disponibilidad: disponibilidadPorCancha,
    };
  }

  private generarSlots(
    disponibilidades: any[],
    reservas: any[],
    canchaId: string,
  ): any[] {
    const slots: any[] = [];

    for (const disp of disponibilidades) {
      let horaActual = this.parseTime(disp.horaInicio);
      const horaFin = this.parseTime(disp.horaFin);

      while (horaActual < horaFin) {
        const horaInicioStr = this.formatTime(horaActual);
        const horaFinSlot = new Date(horaActual.getTime() + 70 * 60000); // 90 min default
        const horaFinStr = this.formatTime(horaFinSlot);

        const ocupado = reservas.some(r => {
          const reservaInicio = this.parseTime(r.horaInicio);
          const reservaFin = this.parseTime(r.horaFin);
          return horaActual < reservaFin && horaFinSlot > reservaInicio;
        });

        if (!ocupado) {
          slots.push({
            horaInicio: horaInicioStr,
            horaFin: horaFinStr,
            disponible: true,
          });
        }

        horaActual = horaFinSlot;
      }
    }

    return slots;
  }

  private parseTime(timeStr: string): Date {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date;
  }

  private formatTime(date: Date): string {
    return date.toTimeString().slice(0, 5);
  }

  // ============ RESERVAS ============

  async crearReserva(userId: string | null, createDto: CreateReservaDto) {
    // Verificar que la cancha existe
    const cancha = await this.prisma.sedeCancha.findUnique({
      where: { id: createDto.sedeCanchaId },
      include: { sede: { include: { alquilerConfig: true } } },
    });

    if (!cancha || !cancha.activa) {
      throw new NotFoundException('Cancha no encontrada');
    }

    const config = cancha.sede.alquilerConfig;
    if (!config || !config.habilitado) {
      throw new BadRequestException('Los alquileres no están habilitados para esta sede');
    }

    // FIX: fecha es String YYYY-MM-DD
    const diaSemana = this.getDiaSemanaFromString(createDto.fecha);

    const disponibilidad = await this.prisma.alquilerDisponibilidad.findFirst({
      where: {
        sedeCanchaId: createDto.sedeCanchaId,
        diaSemana,
        horaInicio: { lte: createDto.horaInicio },
        horaFin: { gte: createDto.horaFin },
        activo: true,
      },
    });

    if (!disponibilidad) {
      throw new BadRequestException('Horario no disponible');
    }

    // Verificar que no haya conflicto con otra reserva
    const conflicto = await this.prisma.reservaCancha.findFirst({
      where: {
        sedeCanchaId: createDto.sedeCanchaId,
        fecha: createDto.fecha,
        estado: { in: [ReservaCanchaEstado.PENDIENTE, ReservaCanchaEstado.CONFIRMADA] },
        OR: [
          {
            horaInicio: { lte: createDto.horaInicio },
            horaFin: { gt: createDto.horaInicio },
          },
          {
            horaInicio: { lt: createDto.horaFin },
            horaFin: { gte: createDto.horaFin },
          },
        ],
      },
    });

    if (conflicto) {
      throw new BadRequestException('El horario ya está reservado');
    }

    // Crear reserva
    const estado = config.requiereAprobacion 
      ? ReservaCanchaEstado.PENDIENTE 
      : ReservaCanchaEstado.CONFIRMADA;

    return this.prisma.reservaCancha.create({
      data: {
        ...createDto,
        userId,
        estado,
        duracionMinutos: createDto.duracionMinutos || 70,
      },
      include: {
        sedeCancha: { include: { sede: true } },
        user: { select: { id: true, nombre: true, apellido: true, telefono: true } },
      },
    });
  }

  async obtenerMisReservas(userId: string) {
    return this.prisma.reservaCancha.findMany({
      where: { userId },
      include: {
        sedeCancha: { include: { sede: true } },
      },
      orderBy: { fecha: 'desc' },
    });
  }

  async obtenerReservasSede(sedeId: string, fecha?: string) {
    const where: any = {
      sedeCancha: { sedeId },
    };

    if (fecha) {
      // FIX: fecha es String YYYY-MM-DD
      where.fecha = fecha;
    }

    return this.prisma.reservaCancha.findMany({
      where,
      include: {
        sedeCancha: true,
        user: { select: { id: true, nombre: true, apellido: true, telefono: true } },
      },
      orderBy: [{ fecha: 'asc' }, { horaInicio: 'asc' }],
    });
  }

  async confirmarReserva(reservaId: string, confirmarDto: ConfirmarReservaDto, userId?: string) {
    const reserva = await this.prisma.reservaCancha.findUnique({
      where: { id: reservaId },
    });

    if (!reserva) {
      throw new NotFoundException('Reserva no encontrada');
    }

    if (reserva.estado !== ReservaCanchaEstado.PENDIENTE) {
      throw new BadRequestException('La reserva no está pendiente');
    }

    return this.prisma.reservaCancha.update({
      where: { id: reservaId },
      data: {
        estado: ReservaCanchaEstado.CONFIRMADA,
        metodoPago: confirmarDto.metodoPago,
        compromisoPago: confirmarDto.compromisoPago || false,
        pagado: confirmarDto.metodoPago !== 'EFECTIVO',
      },
    });
  }

  async cancelarReserva(reservaId: string, cancelarDto: CancelarReservaDto, userId?: string) {
    const reserva = await this.prisma.reservaCancha.findUnique({
      where: { id: reservaId },
    });

    if (!reserva) {
      throw new NotFoundException('Reserva no encontrada');
    }

    if (reserva.estado === ReservaCanchaEstado.CANCELADA) {
      throw new BadRequestException('La reserva ya está cancelada');
    }

    return this.prisma.reservaCancha.update({
      where: { id: reservaId },
      data: {
        estado: ReservaCanchaEstado.CANCELADA,
        motivoCancelacion: cancelarDto.motivo,
      },
    });
  }

  async aprobarReserva(reservaId: string) {
    const reserva = await this.prisma.reservaCancha.findUnique({
      where: { id: reservaId },
    });

    if (!reserva) {
      throw new NotFoundException('Reserva no encontrada');
    }

    return this.prisma.reservaCancha.update({
      where: { id: reservaId },
      data: { estado: ReservaCanchaEstado.CONFIRMADA },
    });
  }

  async rechazarReserva(reservaId: string, motivo?: string) {
    const reserva = await this.prisma.reservaCancha.findUnique({
      where: { id: reservaId },
    });

    if (!reserva) {
      throw new NotFoundException('Reserva no encontrada');
    }

    return this.prisma.reservaCancha.update({
      where: { id: reservaId },
      data: { 
        estado: ReservaCanchaEstado.RECHAZADA,
        motivoRechazo: motivo,
      },
    });
  }

  /**
   * Helper: Obtiene el día de la semana (0-6) desde un string YYYY-MM-DD
   * Usa mediodía Paraguay para evitar problemas de timezone
   */
  private getDiaSemanaFromString(fecha: string): number {
    const [year, month, day] = fecha.split('-').map(Number);
    // Crear fecha en hora local de Paraguay (UTC-3)
    const date = new Date(year, month - 1, day, 12, 0, 0);
    return date.getDay();
  }
}
