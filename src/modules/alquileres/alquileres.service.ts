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

  async consultarDisponibilidad(sedeId: string, fecha: string, sedeCanchaId?: string, duracionMinutos?: number) {
    // FIX: fecha es String YYYY-MM-DD, calcular día de semana local
    const diaSemana = this.getDiaSemanaFromString(fecha);
    const duracion = duracionMinutos || 90; // Default 90 minutos

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

      const slots = this.generarSlots(disponibilidadCancha, reservasCancha, cancha.id, duracion);

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
      duracionMinutos: duracion,
      disponibilidad: disponibilidadPorCancha,
    };
  }

  private generarSlots(
    disponibilidades: any[],
    reservas: any[],
    canchaId: string,
    duracionMinutos: number = 90,
  ): any[] {
    const slots: any[] = [];
    
    console.log(`[DEBUG generarSlots] canchaId: ${canchaId}, disponibilidades: ${disponibilidades.length}, reservas: ${reservas.length}`);
    console.log(`[DEBUG] disponibilidades IDs: ${disponibilidades.map(d => d.sedeCanchaId).join(', ')}`);

    for (const disp of disponibilidades) {
      let horaActual = this.parseTime(disp.horaInicio);
      const horaFin = this.parseTime(disp.horaFin);

      while (horaActual < horaFin) {
        const horaInicioStr = this.formatTime(horaActual);
        const horaFinSlot = new Date(horaActual.getTime() + duracionMinutos * 60000);
        const horaFinStr = this.formatTime(horaFinSlot);

        // Si el slot excede el horario de cierre, no agregar
        if (horaFinSlot > horaFin) break;

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
    
    console.log(`[DEBUG generarSlots] Slots generados: ${slots.length}`);

    return slots;
  }

  /**
   * Consulta disponibilidad de TODAS las sedes con alquileres habilitados
   * Similar a deportes42 - vista unificada
   */
  async consultarDisponibilidadGlobal(params: {
    fecha: string;
    duracionMinutos: number;
    horaDesde?: string;
    horaHasta?: string;
  }) {
    const { fecha, duracionMinutos, horaDesde, horaHasta } = params;
    const diaSemana = this.getDiaSemanaFromString(fecha);

    // Obtener todas las sedes con suscripción activa (pagada)
    const sedes = await this.prisma.sede.findMany({
      where: {
        activa: true,
        alquilerConfig: {
          suscripcionActiva: true,
        },
      },
      include: {
        canchas: {
          where: { activa: true },
        },
        alquilerConfig: true,
      },
    });
    
    // DEBUG: Log para verificar qué se está encontrando
    console.log(`[DEBUG disponibilidad-global] Fecha: ${fecha}, DiaSemana: ${diaSemana}`);
    console.log(`[DEBUG] Sedes encontradas con suscripcionActiva=true: ${sedes.length}`);
    sedes.forEach(s => {
      console.log(`[DEBUG] Sede: ${s.nombre}, canchas: ${s.canchas.length}, suscripcionActiva: ${s.alquilerConfig?.suscripcionActiva}`);
    });

    // Obtener todas las reservas para la fecha
    const todasCanchasIds = sedes.flatMap(s => s.canchas.map(c => c.id));
    
    const reservasExistentes = await this.prisma.reservaCancha.findMany({
      where: {
        sedeCanchaId: { in: todasCanchasIds },
        fecha: fecha,
        estado: { in: [ReservaCanchaEstado.PENDIENTE, ReservaCanchaEstado.CONFIRMADA] },
      },
    });

    // Obtener disponibilidades para el día
    const disponibilidades = await this.prisma.alquilerDisponibilidad.findMany({
      where: {
        sedeCanchaId: { in: todasCanchasIds },
        diaSemana,
        activo: true,
      },
    });
    
    console.log(`[DEBUG] IDs de canchas buscadas: ${todasCanchasIds.join(', ')}`);
    console.log(`[DEBUG] Disponibilidades encontradas para dia ${diaSemana}: ${disponibilidades.length}`);

    // NOTA: Los precios no se gestionan en la plataforma
    // El dueño cobra directamente al jugador

    // Construir respuesta por sede
    const sedesConDisponibilidad = await Promise.all(
      sedes.map(async (sede) => {
        const canchasSede = sede.canchas;
        const canchasConHorarios = canchasSede.map(cancha => {
          const disponibilidadCancha = disponibilidades.filter(d => d.sedeCanchaId === cancha.id);
          const reservasCancha = reservasExistentes.filter(r => r.sedeCanchaId === cancha.id);
          
          console.log(`[DEBUG] Cancha ${cancha.nombre} (${cancha.id}): ${disponibilidadCancha.length} disponibilidades, ${reservasCancha.length} reservas`);

          let slots = this.generarSlots(disponibilidadCancha, reservasCancha, cancha.id, duracionMinutos);

          // Filtrar por rango horario si se especificó
          if (horaDesde) {
            slots = slots.filter(s => s.horaInicio >= horaDesde);
          }
          if (horaHasta) {
            slots = slots.filter(s => s.horaInicio <= horaHasta);
          }

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

        // Extraer horarios únicos de todas las canchas
        const todosHorarios = canchasConHorarios.flatMap(c => c.slots.map(s => s.horaInicio));
        const horariosUnicos = [...new Set(todosHorarios)].sort();

        // Contar canchas disponibles
        const canchasConSlots = canchasConHorarios.filter(c => c.slots.length > 0).length;

        return {
          sede: {
            id: sede.id,
            nombre: sede.nombre,
            ciudad: sede.ciudad,
            logoUrl: sede.logoUrl,
            direccion: sede.direccion,
          },
          canchasDisponibles: canchasConSlots,
          totalCanchas: canchasSede.length,
          horarios: horariosUnicos.slice(0, 8), // Primeros 8 horarios para mostrar
          totalHorarios: horariosUnicos.length,
          canchas: canchasConHorarios,
        };
      })
    );

    // Filtrar solo sedes con disponibilidad
    const sedesFiltradas = sedesConDisponibilidad.filter(s => s.canchasDisponibles > 0);
    
    console.log(`[DEBUG] Sedes con slots disponibles: ${sedesFiltradas.length}`);
    sedesFiltradas.forEach(s => console.log(`[DEBUG] -> ${s.sede.nombre}: ${s.canchasDisponibles} canchas`));

    return {
      fecha,
      duracionMinutos,
      totalSedes: sedesFiltradas.length,
      sedes: sedesFiltradas,
    };
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

  // ============ GESTIÓN DE DISPONIBILIDADES (ENCARGADO) ============

  async obtenerDisponibilidadesSede(sedeId: string) {
    // Obtener canchas de la sede con sus disponibilidades
    const canchas = await this.prisma.sedeCancha.findMany({
      where: { sedeId, activa: true },
      include: {
        alquilerDisponibilidades: {
          orderBy: [{ diaSemana: 'asc' }, { horaInicio: 'asc' }],
        },
      },
      orderBy: { nombre: 'asc' },
    });

    return canchas.map(c => ({
      cancha: {
        id: c.id,
        nombre: c.nombre,
        tipo: c.tipo,
      },
      disponibilidades: c.alquilerDisponibilidades,
    }));
  }

  async crearDisponibilidad(createDto: {
    sedeCanchaId: string;
    diaSemana: number;
    horaInicio: string;
    horaFin: string;
    activo?: boolean;
  }) {
    // Verificar que la cancha existe
    const cancha = await this.prisma.sedeCancha.findUnique({
      where: { id: createDto.sedeCanchaId },
    });

    if (!cancha) {
      throw new NotFoundException('Cancha no encontrada');
    }

    // Verificar que no exista una disponibilidad para el mismo día y cancha
    const existente = await this.prisma.alquilerDisponibilidad.findFirst({
      where: {
        sedeCanchaId: createDto.sedeCanchaId,
        diaSemana: createDto.diaSemana,
      },
    });

    if (existente) {
      throw new BadRequestException('Ya existe una disponibilidad para este día y cancha. Actualice la existente.');
    }

    return this.prisma.alquilerDisponibilidad.create({
      data: createDto,
    });
  }

  async actualizarDisponibilidad(
    id: string,
    updateDto: {
      horaInicio?: string;
      horaFin?: string;
      activo?: boolean;
    },
  ) {
    const disponibilidad = await this.prisma.alquilerDisponibilidad.findUnique({
      where: { id },
    });

    if (!disponibilidad) {
      throw new NotFoundException('Disponibilidad no encontrada');
    }

    return this.prisma.alquilerDisponibilidad.update({
      where: { id },
      data: updateDto,
    });
  }

  async eliminarDisponibilidad(id: string) {
    const disponibilidad = await this.prisma.alquilerDisponibilidad.findUnique({
      where: { id },
    });

    if (!disponibilidad) {
      throw new NotFoundException('Disponibilidad no encontrada');
    }

    return this.prisma.alquilerDisponibilidad.delete({
      where: { id },
    });
  }

  // ============ GESTIÓN DE BLOQUEOS (ENCARGADO) ============

  async obtenerBloqueosSede(
    sedeId: string,
    fechaDesde?: string,
    fechaHasta?: string,
  ) {
    const where: any = { sedeId };

    if (fechaDesde || fechaHasta) {
      where.OR = [
        {
          fechaInicio: {
            gte: fechaDesde,
            lte: fechaHasta,
          },
        },
        {
          fechaFin: {
            gte: fechaDesde,
            lte: fechaHasta,
          },
        },
      ];
    }

    return this.prisma.alquilerBloqueo.findMany({
      where,
      include: {
        sedeCancha: {
          select: { id: true, nombre: true },
        },
      },
      orderBy: { fechaInicio: 'desc' },
    });
  }

  async crearBloqueo(createDto: {
    sedeId: string;
    sedeCanchaId?: string;
    fechaInicio: string;
    fechaFin?: string;
    motivo?: string;
  }) {
    // Verificar que la sede existe
    const sede = await this.prisma.sede.findUnique({
      where: { id: createDto.sedeId },
    });

    if (!sede) {
      throw new NotFoundException('Sede no encontrada');
    }

    // Si se especifica cancha, verificar que pertenece a la sede
    if (createDto.sedeCanchaId) {
      const cancha = await this.prisma.sedeCancha.findFirst({
        where: { id: createDto.sedeCanchaId, sedeId: createDto.sedeId },
      });

      if (!cancha) {
        throw new NotFoundException('Cancha no encontrada en esta sede');
      }
    }

    return this.prisma.alquilerBloqueo.create({
      data: {
        ...createDto,
        fechaFin: createDto.fechaFin || createDto.fechaInicio,
      },
    });
  }

  async actualizarBloqueo(
    id: string,
    updateDto: {
      fechaInicio?: string;
      fechaFin?: string;
      motivo?: string;
    },
  ) {
    const bloqueo = await this.prisma.alquilerBloqueo.findUnique({
      where: { id },
    });

    if (!bloqueo) {
      throw new NotFoundException('Bloqueo no encontrado');
    }

    return this.prisma.alquilerBloqueo.update({
      where: { id },
      data: updateDto,
    });
  }

  async eliminarBloqueo(id: string) {
    const bloqueo = await this.prisma.alquilerBloqueo.findUnique({
      where: { id },
    });

    if (!bloqueo) {
      throw new NotFoundException('Bloqueo no encontrado');
    }

    return this.prisma.alquilerBloqueo.delete({
      where: { id },
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
