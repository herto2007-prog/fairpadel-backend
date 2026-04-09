import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAlquilerConfigDto } from './dto/create-alquiler-config.dto';
import { CreateReservaDto, ConfirmarReservaDto, CancelarReservaDto } from './dto/create-reserva.dto';
import { ReservaCanchaEstado } from '@prisma/client';
import { NotificacionesWhatsAppService } from '../notificaciones/notificaciones-whatsapp.service';

@Injectable()
export class AlquileresService {
  constructor(
    private prisma: PrismaService,
    private notificacionesWhatsApp: NotificacionesWhatsAppService,
  ) {}

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

    // Obtener horarios ocupados por torneos para esa fecha
    const horariosTorneo = await this.obtenerHorariosOcupadosPorTorneo(sedeId, fecha);

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

      const horariosTorneoCancha = horariosTorneo.filter(h => h.sedeCanchaId === cancha.id);
      const slots = this.generarSlots(disponibilidadCancha, reservasCancha, horariosTorneoCancha, cancha.id, duracion);

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

  /**
   * Obtiene los horarios ocupados por torneos para una sede y fecha específica
   * Usando consultas separadas para evitar problemas de tipado con Prisma
   */
  private async obtenerHorariosOcupadosPorTorneo(sedeId: string, fecha: string): Promise<{ sedeCanchaId: string; horaInicio: string; horaFin: string }[]> {
    // 1. Obtener IDs de torneos que tienen esta sede
    const torneoSedes = await this.prisma.torneoSede.findMany({
      where: { sedeId },
      select: { tournamentId: true },
    });
    const torneoIds = torneoSedes.map(ts => ts.tournamentId);
    if (torneoIds.length === 0) return [];

    // 2. Obtener disponibilidades con slots para la fecha
    const disponibilidades = await this.prisma.torneoDisponibilidadDia.findMany({
      where: { 
        tournamentId: { in: torneoIds },
        fecha,
        activo: true,
      },
      include: { slots: true },
    });

    // 3. Obtener las canchas de torneo para mapear torneoCanchaId -> sedeCanchaId
    const torneoCanchas = await this.prisma.torneoCancha.findMany({
      where: { tournamentId: { in: torneoIds } },
      select: { id: true, sedeCanchaId: true },
    });
    const canchaMap = new Map(torneoCanchas.map(tc => [tc.id, tc.sedeCanchaId]));

    // 4. Construir la lista de horarios ocupados
    const horariosOcupados: { sedeCanchaId: string; horaInicio: string; horaFin: string }[] = [];
    for (const disp of disponibilidades) {
      for (const slot of disp.slots) {
        const sedeCanchaId = canchaMap.get(slot.torneoCanchaId);
        if (sedeCanchaId) {
          horariosOcupados.push({
            sedeCanchaId,
            horaInicio: slot.horaInicio,
            horaFin: slot.horaFin,
          });
        }
      }
    }

    return horariosOcupados;
  }

  /**
   * Obtiene los horarios ocupados por torneos para múltiples sedes y fecha específica
   */
  private async obtenerHorariosOcupadosPorTorneoGlobal(sedesIds: string[], fecha: string): Promise<{ sedeCanchaId: string; horaInicio: string; horaFin: string }[]> {
    // 1. Obtener IDs de torneos que tienen estas sedes
    const torneoSedes = await this.prisma.torneoSede.findMany({
      where: { sedeId: { in: sedesIds } },
      select: { tournamentId: true },
    });
    const torneoIds = torneoSedes.map(ts => ts.tournamentId);
    if (torneoIds.length === 0) return [];

    // 2. Obtener disponibilidades con slots para la fecha
    const disponibilidades = await this.prisma.torneoDisponibilidadDia.findMany({
      where: { 
        tournamentId: { in: torneoIds },
        fecha,
        activo: true,
      },
      include: { slots: true },
    });

    // 3. Obtener las canchas de torneo para mapear torneoCanchaId -> sedeCanchaId
    const torneoCanchas = await this.prisma.torneoCancha.findMany({
      where: { tournamentId: { in: torneoIds } },
      select: { id: true, sedeCanchaId: true },
    });
    const canchaMap = new Map(torneoCanchas.map(tc => [tc.id, tc.sedeCanchaId]));

    // 4. Construir la lista de horarios ocupados
    const horariosOcupados: { sedeCanchaId: string; horaInicio: string; horaFin: string }[] = [];
    for (const disp of disponibilidades) {
      for (const slot of disp.slots) {
        const sedeCanchaId = canchaMap.get(slot.torneoCanchaId);
        if (sedeCanchaId) {
          horariosOcupados.push({
            sedeCanchaId,
            horaInicio: slot.horaInicio,
            horaFin: slot.horaFin,
          });
        }
      }
    }

    return horariosOcupados;
  }

  private generarSlots(
    disponibilidades: any[],
    reservas: any[],
    horariosTorneo: { sedeCanchaId: string; horaInicio: string; horaFin: string }[],
    canchaId: string,
    duracionMinutos: number = 90,
  ): any[] {
    const slots: any[] = [];

    for (const disp of disponibilidades) {
      // Usar minutos desde medianoche (evita Date objects)
      let minutosActual = this.parseTimeToMinutes(disp.horaInicio);
      let minutosFin = this.parseTimeToMinutes(disp.horaFin);
      
      // Si horaFin es 00:00, interpretar como 24:00 (medianoche del día siguiente)
      // Esto permite franjas como 22:00-00:00
      if (minutosFin === 0 && disp.horaFin === '00:00') {
        minutosFin = 24 * 60; // 1440 minutos
      }

      while (minutosActual < minutosFin) {
        const slotInicioStr = this.formatTimeFromMinutes(minutosActual);
        const minutosSlotFin = minutosActual + duracionMinutos;
        const slotFinStr = this.formatTimeFromMinutes(minutosSlotFin);

        // Si el slot excede el horario de cierre, no agregar
        if (minutosSlotFin > minutosFin) break;

        // Verificar si hay conflicto con reservas existentes
        const ocupadoPorReserva = reservas.some(r => {
          const reservaInicio = this.parseTimeToMinutes(r.horaInicio);
          const reservaFin = this.parseTimeToMinutes(r.horaFin);
          return minutosActual < reservaFin && minutosSlotFin > reservaInicio;
        });

        // Verificar si hay conflicto con torneo
        const ocupadoPorTorneo = horariosTorneo.some(h => {
          const torneoInicio = this.parseTimeToMinutes(h.horaInicio);
          const torneoFin = this.parseTimeToMinutes(h.horaFin);
          return minutosActual < torneoFin && minutosSlotFin > torneoInicio;
        });

        const ocupado = ocupadoPorReserva || ocupadoPorTorneo;

        if (!ocupado) {
          slots.push({
            horaInicio: slotInicioStr,
            horaFin: slotFinStr,
            disponible: true,
          });
        }

        minutosActual = minutosSlotFin;
      }
    }

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

    // Obtener todas las reservas para la fecha
    const todasCanchasIds = sedes.flatMap(s => s.canchas.map(c => c.id));
    
    const reservasExistentes = await this.prisma.reservaCancha.findMany({
      where: {
        sedeCanchaId: { in: todasCanchasIds },
        fecha: fecha,
        estado: { in: [ReservaCanchaEstado.PENDIENTE, ReservaCanchaEstado.CONFIRMADA] },
      },
    });

    // Obtener horarios ocupados por torneos para todas las sedes
    const todasSedesIds = sedes.map(s => s.id);
    const horariosTorneo = await this.obtenerHorariosOcupadosPorTorneoGlobal(todasSedesIds, fecha);

    // Obtener disponibilidades para el día
    const disponibilidades = await this.prisma.alquilerDisponibilidad.findMany({
      where: {
        sedeCanchaId: { in: todasCanchasIds },
        diaSemana,
        activo: true,
      },
    });

    // NOTA: Los precios no se gestionan en la plataforma
    // El dueño cobra directamente al jugador

    // Construir respuesta por sede
    const sedesConDisponibilidad = await Promise.all(
      sedes.map(async (sede) => {
        const canchasSede = sede.canchas;
        const canchasConHorarios = canchasSede.map(cancha => {
          const disponibilidadCancha = disponibilidades.filter(d => d.sedeCanchaId === cancha.id);
          const reservasCancha = reservasExistentes.filter(r => r.sedeCanchaId === cancha.id);

          const horariosTorneoCancha = horariosTorneo.filter(h => h.sedeCanchaId === cancha.id);
          let slots = this.generarSlots(disponibilidadCancha, reservasCancha, horariosTorneoCancha, cancha.id, duracionMinutos);

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

    return {
      fecha,
      duracionMinutos,
      totalSedes: sedesFiltradas.length,
      sedes: sedesFiltradas,
    };
  }

  /**
   * Convierte string HH:MM a minutos desde medianoche
   * Sin usar Date (evita bugs de timezone en servidor)
   */
  private parseTimeToMinutes(timeStr: string): number {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * Convierte minutos desde medianoche a string HH:MM
   */
  private formatTimeFromMinutes(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }

  // Métodos legacy mantenidos para compatibilidad (deprecados)
  private parseTime(timeStr: string): Date {
    return new Date(`1970-01-01T${timeStr}:00`);
  }

  private formatTime(date: Date): string {
    return date.toTimeString().slice(0, 5);
  }

  // ============ RESERVAS ============

  async crearReserva(userId: string | null, createDto: CreateReservaDto) {
    console.log(`[DEBUG crearReserva] Iniciando reserva:`, {
      userId,
      sedeCanchaId: createDto.sedeCanchaId,
      fecha: createDto.fecha,
      horaInicio: createDto.horaInicio,
      horaFin: createDto.horaFin,
      duracionMinutos: createDto.duracionMinutos,
    });

    // Verificar que la cancha existe
    const cancha = await this.prisma.sedeCancha.findUnique({
      where: { id: createDto.sedeCanchaId },
      include: { sede: { include: { alquilerConfig: true } } },
    });

    console.log(`[DEBUG crearReserva] Cancha encontrada:`, {
      canchaId: cancha?.id,
      activa: cancha?.activa,
      alquilerConfig: cancha?.sede?.alquilerConfig ? 'existe' : 'no existe',
      habilitado: cancha?.sede?.alquilerConfig?.habilitado,
    });

    if (!cancha || !cancha.activa) {
      console.log(`[DEBUG crearReserva] ERROR: Cancha no encontrada o inactiva`);
      throw new NotFoundException('Cancha no encontrada');
    }

    const config = cancha.sede.alquilerConfig;
    if (!config || !config.habilitado) {
      console.log(`[DEBUG crearReserva] ERROR: Alquileres no habilitados`);
      throw new BadRequestException('Los alquileres no están habilitados para esta sede');
    }

    // FIX: fecha es String YYYY-MM-DD
    const diaSemana = this.getDiaSemanaFromString(createDto.fecha);
    console.log(`[DEBUG crearReserva] DiaSemana calculado: ${diaSemana}`);

    // Buscar disponibilidad que cubra el horario solicitado
    // Considerar que horaFin = '00:00' significa medianoche (24:00)
    const disponibilidades = await this.prisma.alquilerDisponibilidad.findMany({
      where: {
        sedeCanchaId: createDto.sedeCanchaId,
        diaSemana,
        horaInicio: { lte: createDto.horaInicio },
        activo: true,
      },
    });

    // Filtrar manualmente considerando que 00:00 = 24:00
    const disponibilidad = disponibilidades.find(d => {
      const finEsMedianoche = d.horaFin === '00:00';
      if (finEsMedianoche) return true; // 00:00 cubre cualquier horaFin
      return d.horaFin >= createDto.horaFin;
    });

    console.log(`[DEBUG crearReserva] Disponibilidad encontrada:`, disponibilidad ? {
      id: disponibilidad.id,
      horaInicio: disponibilidad.horaInicio,
      horaFin: disponibilidad.horaFin,
      activo: disponibilidad.activo,
    } : 'NO ENCONTRADA');
    console.log(`[DEBUG crearReserva] Total disponibilidades revisadas: ${disponibilidades.length}`);

    if (!disponibilidad) {
      console.log(`[DEBUG crearReserva] ERROR: No hay disponibilidad para el horario solicitado`);
      throw new BadRequestException('Horario no disponible');
    }

    // Verificar que no haya conflicto con otra reserva
    // Usar comparacion de minutos para evitar problemas con 00:00
    const reservasExistentes = await this.prisma.reservaCancha.findMany({
      where: {
        sedeCanchaId: createDto.sedeCanchaId,
        fecha: createDto.fecha,
        estado: { in: [ReservaCanchaEstado.PENDIENTE, ReservaCanchaEstado.CONFIRMADA] },
      },
    });

    const inicioMin = this.parseTimeToMinutes(createDto.horaInicio);
    const finMin = this.parseTimeToMinutes(createDto.horaFin);
    // Si horaFin es 00:00, tratar como 24:00 (1440 minutos)
    const finMinAjustado = finMin === 0 && createDto.horaFin === '00:00' ? 24 * 60 : finMin;

    const conflicto = reservasExistentes.find(r => {
      const rInicio = this.parseTimeToMinutes(r.horaInicio);
      let rFin = this.parseTimeToMinutes(r.horaFin);
      // Si la reserva existente termina a medianoche
      if (rFin === 0 && r.horaFin === '00:00') rFin = 24 * 60;
      
      // Hay solapamiento si:
      // (inicioReserva < finExistente) AND (finReserva > inicioExistente)
      return inicioMin < rFin && finMinAjustado > rInicio;
    });

    console.log(`[DEBUG crearReserva] Conflicto encontrado:`, conflicto ? {
      reservaId: conflicto.id,
      horaInicio: conflicto.horaInicio,
      horaFin: conflicto.horaFin,
      estado: conflicto.estado,
    } : 'NINGUNO');
    console.log(`[DEBUG crearReserva] Reservas existentes revisadas: ${reservasExistentes.length}`);

    if (conflicto) {
      console.log(`[DEBUG crearReserva] ERROR: Horario ya reservado`);
      throw new BadRequestException('El horario ya está reservado');
    }

    // Crear reserva - SIEMPRE CONFIRMADA (no requiere aprobacion del dueño)
    const estado = ReservaCanchaEstado.CONFIRMADA;

    console.log(`[DEBUG crearReserva] Creando reserva CONFIRMADA automaticamente`);

    // Determinar si fue creado por encargado: si tiene datos externos es manual
    const creadoPorEncargado = !!createDto.nombreExterno || !!createDto.telefonoExterno;

    const reserva = await this.prisma.reservaCancha.create({
      data: {
        ...createDto,
        userId,
        estado,
        duracionMinutos: createDto.duracionMinutos || 70,
        creadoPorEncargado,
      },
      include: {
        sedeCancha: { include: { sede: true } },
        user: { select: { id: true, nombre: true, apellido: true, telefono: true } },
      },
    });

    console.log(`[DEBUG crearReserva] Reserva creada exitosamente: ${reserva.id}`);
    return reserva;
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

  // ============ ESTADÍSTICAS ============

  async obtenerEstadisticas(sedeId: string, mes?: string) {
    // Determinar rango de fechas
    const ahora = new Date();
    const año = mes ? parseInt(mes.split('-')[0]) : ahora.getFullYear();
    const mesNum = mes ? parseInt(mes.split('-')[1]) : ahora.getMonth() + 1;
    
    // Fecha inicio y fin del mes
    const fechaInicio = `${año}-${String(mesNum).padStart(2, '0')}-01`;
    const ultimoDia = new Date(año, mesNum, 0).getDate();
    const fechaFin = `${año}-${String(mesNum).padStart(2, '0')}-${ultimoDia}`;
    
    // Mes anterior para comparativa
    const mesAnterior = mesNum === 1 ? 12 : mesNum - 1;
    const añoAnterior = mesNum === 1 ? año - 1 : año;
    const fechaInicioAnt = `${añoAnterior}-${String(mesAnterior).padStart(2, '0')}-01`;
    const ultimoDiaAnt = new Date(añoAnterior, mesAnterior, 0).getDate();
    const fechaFinAnt = `${añoAnterior}-${String(mesAnterior).padStart(2, '0')}-${ultimoDiaAnt}`;

    // Obtener canchas de la sede
    const canchas = await this.prisma.sedeCancha.findMany({
      where: { sedeId, activa: true },
      select: { id: true, nombre: true },
    });

    // Obtener reservas del mes actual
    const reservasMes = await this.prisma.reservaCancha.findMany({
      where: {
        sedeCancha: { sedeId },
        fecha: { gte: fechaInicio, lte: fechaFin },
      },
      include: {
        sedeCancha: { select: { id: true, nombre: true } },
        user: { select: { id: true, nombre: true, apellido: true } },
      },
    });

    // Obtener reservas del mes anterior para comparativa
    const reservasMesAnt = await this.prisma.reservaCancha.findMany({
      where: {
        sedeCancha: { sedeId },
        fecha: { gte: fechaInicioAnt, lte: fechaFinAnt },
      },
    });

    // Calcular métricas
    const totalReservas = reservasMes.length;
    const totalReservasAnt = reservasMesAnt.length;
    const variacionReservas = totalReservasAnt > 0 
      ? Math.round(((totalReservas - totalReservasAnt) / totalReservasAnt) * 100)
      : 0;

    // Reservas por estado
    const confirmadas = reservasMes.filter(r => r.estado === 'CONFIRMADA').length;
    const pendientes = reservasMes.filter(r => r.estado === 'PENDIENTE').length;
    const canceladas = reservasMes.filter(r => r.estado === 'CANCELADA').length;
    const rechazadas = reservasMes.filter(r => r.estado === 'RECHAZADA').length;

    // Tasa de cancelación
    const tasaCancelacion = totalReservas > 0 
      ? Math.round((canceladas / totalReservas) * 100)
      : 0;

    // Horas totales alquiladas (solo confirmadas y pendientes)
    const horasAlquiladas = reservasMes
      .filter(r => r.estado === 'CONFIRMADA' || r.estado === 'PENDIENTE')
      .reduce((sum, r) => sum + (r.duracionMinutos || 60) / 60, 0);

    // Reservas por cancha
    const reservasPorCancha = canchas.map(c => {
      const reservasCancha = reservasMes.filter(r => r.sedeCanchaId === c.id);
      return {
        canchaId: c.id,
        canchaNombre: c.nombre,
        total: reservasCancha.length,
        confirmadas: reservasCancha.filter(r => r.estado === 'CONFIRMADA').length,
        horas: reservasCancha
          .filter(r => r.estado === 'CONFIRMADA' || r.estado === 'PENDIENTE')
          .reduce((sum, r) => sum + (r.duracionMinutos || 60) / 60, 0),
      };
    });

    // Horarios más ocupados (top 5)
    const horariosCount: Record<string, number> = {};
    reservasMes
      .filter(r => r.estado === 'CONFIRMADA' || r.estado === 'PENDIENTE')
      .forEach(r => {
        const hora = r.horaInicio.substring(0, 2); // "14:00" → "14"
        horariosCount[hora] = (horariosCount[hora] || 0) + 1;
      });
    
    const horariosTop = Object.entries(horariosCount)
      .map(([hora, count]) => ({ hora: `${hora}:00`, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Días de la semana con más reservas
    const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const diasCount: Record<number, number> = {};
    reservasMes
      .filter(r => r.estado === 'CONFIRMADA' || r.estado === 'PENDIENTE')
      .forEach(r => {
        const dia = this.getDiaSemanaFromString(r.fecha);
        diasCount[dia] = (diasCount[dia] || 0) + 1;
      });
    
    const diasTop = Object.entries(diasCount)
      .map(([dia, count]) => ({ dia: diasSemana[parseInt(dia)], count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    // Clientes más frecuentes (solo reservas confirmadas/pendientes)
    const clientesCount: Record<string, { nombre: string; count: number }> = {};
    reservasMes
      .filter(r => (r.estado === 'CONFIRMADA' || r.estado === 'PENDIENTE') && r.user)
      .forEach(r => {
        const key = r.user!.id;
        if (!clientesCount[key]) {
          clientesCount[key] = {
            nombre: `${r.user!.nombre} ${r.user!.apellido}`,
            count: 0,
          };
        }
        clientesCount[key].count++;
      });
    
    // También incluir reservas manuales (creadoPorEncargado)
    reservasMes
      .filter(r => (r.estado === 'CONFIRMADA' || r.estado === 'PENDIENTE') && r.creadoPorEncargado && r.nombreExterno)
      .forEach(r => {
        const key = `manual-${r.nombreExterno}`;
        if (!clientesCount[key]) {
          clientesCount[key] = {
            nombre: r.nombreExterno!,
            count: 0,
          };
        }
        clientesCount[key].count++;
      });

    const clientesTop = Object.values(clientesCount)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      periodo: { mes: mesNum, año, fechaInicio, fechaFin },
      resumen: {
        totalReservas,
        variacionReservas,
        confirmadas,
        pendientes,
        canceladas,
        rechazadas,
        tasaCancelacion,
        horasAlquiladas: Math.round(horasAlquiladas),
      },
      reservasPorCancha,
      horariosTop,
      diasTop,
      clientesTop,
    };
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
