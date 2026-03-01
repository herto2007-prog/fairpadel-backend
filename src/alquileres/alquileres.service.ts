import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { HabilitarAlquilerDto, ActualizarAlquilerConfigDto } from './dto/alquiler-config.dto';
import { ConfigurarPreciosDto } from './dto/alquiler-precio.dto';
import { ConfigurarDisponibilidadDto } from './dto/alquiler-disponibilidad.dto';
import { CrearBloqueoAlquilerDto } from './dto/alquiler-bloqueo.dto';
import {
  CrearReservaCanchaDto,
  CrearReservaManualDto,
  RechazarReservaCanchaDto,
  MarcarPagoCanchaDto,
} from './dto/reserva-cancha.dto';

@Injectable()
export class AlquileresService {
  private readonly logger = new Logger(AlquileresService.name);

  constructor(
    private prisma: PrismaService,
    private notificacionesService: NotificacionesService,
  ) {}

  // ════════════════════════════════════════════════════════
  // HELPERS
  // ════════════════════════════════════════════════════════

  private parseHoraToMinutes(hora: string): number {
    const [h, m] = hora.split(':').map(Number);
    return h * 60 + m;
  }

  private minutesToHora(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  }

  private determinarFranja(hora: string): string {
    const mins = this.parseHoraToMinutes(hora);
    if (mins < 720) return 'MANANA';       // < 12:00
    if (mins < 1080) return 'TARDE';       // < 18:00
    return 'NOCHE';
  }

  private determinarTipoDia(fecha: Date): string {
    const day = fecha.getDay(); // 0=dom, 6=sab
    if (day === 0) return 'DOMINGO';
    if (day === 6) return 'SABADO';
    return 'SEMANA';
  }

  private async validarEncargado(sedeId: string, userId: string): Promise<void> {
    const config = await this.prisma.alquilerConfig.findUnique({
      where: { sedeId },
    });
    if (!config || config.encargadoId !== userId) {
      throw new ForbiddenException('No sos el encargado de esta sede');
    }
  }

  private async validarEncargadoOAdmin(sedeId: string, userId: string, roles: string[]): Promise<void> {
    if (roles.includes('admin')) return;
    await this.validarEncargado(sedeId, userId);
  }

  private async obtenerPrecioSlot(
    sedeId: string,
    tipoCancha: string,
    fecha: Date,
    horaInicio: string,
  ): Promise<number> {
    const franja = this.determinarFranja(horaInicio);
    const tipoDia = this.determinarTipoDia(fecha);

    const precio = await this.prisma.alquilerPrecio.findUnique({
      where: {
        sedeId_tipoCancha_tipoDia_franja: {
          sedeId,
          tipoCancha: tipoCancha as any,
          tipoDia: tipoDia as any,
          franja: franja as any,
        },
      },
    });

    return precio?.precio ?? 0;
  }

  // ════════════════════════════════════════════════════════
  // CONFIG (Admin)
  // ════════════════════════════════════════════════════════

  async habilitarAlquiler(dto: HabilitarAlquilerDto) {
    // Validar que la sede existe
    const sede = await this.prisma.sede.findUnique({ where: { id: dto.sedeId } });
    if (!sede) throw new NotFoundException('Sede no encontrada');

    // Si hay encargado, asignar rol
    if (dto.encargadoId) {
      await this.asignarRolEncargado(dto.encargadoId);
    }

    const config = await this.prisma.alquilerConfig.upsert({
      where: { sedeId: dto.sedeId },
      update: {
        habilitado: true,
        encargadoId: dto.encargadoId ?? undefined,
        requiereAprobacion: dto.requiereAprobacion ?? true,
        duracionSlotMinutos: dto.duracionSlotMinutos ?? 90,
        anticipacionMaxDias: dto.anticipacionMaxDias ?? 14,
        cancelacionMinHoras: dto.cancelacionMinHoras ?? 4,
        mensajeBienvenida: dto.mensajeBienvenida ?? undefined,
      },
      create: {
        sedeId: dto.sedeId,
        encargadoId: dto.encargadoId,
        habilitado: true,
        requiereAprobacion: dto.requiereAprobacion ?? true,
        duracionSlotMinutos: dto.duracionSlotMinutos ?? 90,
        anticipacionMaxDias: dto.anticipacionMaxDias ?? 14,
        cancelacionMinHoras: dto.cancelacionMinHoras ?? 4,
        mensajeBienvenida: dto.mensajeBienvenida,
      },
      include: { sede: true, encargado: { select: { id: true, nombre: true, apellido: true, documento: true } } },
    });

    return config;
  }

  async deshabilitarAlquiler(sedeId: string) {
    const config = await this.prisma.alquilerConfig.findUnique({ where: { sedeId } });
    if (!config) throw new NotFoundException('Configuracion de alquiler no encontrada');

    return this.prisma.alquilerConfig.update({
      where: { sedeId },
      data: { habilitado: false },
    });
  }

  async obtenerConfig(sedeId: string) {
    const config = await this.prisma.alquilerConfig.findUnique({
      where: { sedeId },
      include: {
        sede: { select: { id: true, nombre: true, ciudad: true } },
        encargado: { select: { id: true, nombre: true, apellido: true, documento: true, telefono: true } },
      },
    });
    if (!config) throw new NotFoundException('Configuracion no encontrada');
    return config;
  }

  async actualizarConfig(sedeId: string, dto: ActualizarAlquilerConfigDto, userId: string, roles: string[]) {
    await this.validarEncargadoOAdmin(sedeId, userId, roles);

    // Si cambia encargado, asignar rol al nuevo
    if (dto.encargadoId) {
      await this.asignarRolEncargado(dto.encargadoId);
    }

    return this.prisma.alquilerConfig.update({
      where: { sedeId },
      data: {
        ...(dto.encargadoId !== undefined && { encargadoId: dto.encargadoId }),
        ...(dto.requiereAprobacion !== undefined && { requiereAprobacion: dto.requiereAprobacion }),
        ...(dto.duracionSlotMinutos !== undefined && { duracionSlotMinutos: dto.duracionSlotMinutos }),
        ...(dto.anticipacionMaxDias !== undefined && { anticipacionMaxDias: dto.anticipacionMaxDias }),
        ...(dto.cancelacionMinHoras !== undefined && { cancelacionMinHoras: dto.cancelacionMinHoras }),
        ...(dto.mensajeBienvenida !== undefined && { mensajeBienvenida: dto.mensajeBienvenida }),
      },
      include: { encargado: { select: { id: true, nombre: true, apellido: true } } },
    });
  }

  private async asignarRolEncargado(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario encargado no encontrado');

    const role = await this.prisma.role.findUnique({ where: { nombre: 'encargado' } });
    if (!role) return;

    await this.prisma.userRole.upsert({
      where: { userId_roleId: { userId, roleId: role.id } },
      update: {},
      create: { userId, roleId: role.id },
    });
  }

  // ════════════════════════════════════════════════════════
  // PRECIOS (Encargado/Admin)
  // ════════════════════════════════════════════════════════

  async configurarPrecios(sedeId: string, dto: ConfigurarPreciosDto, userId: string, roles: string[]) {
    await this.validarEncargadoOAdmin(sedeId, userId, roles);

    await this.prisma.$transaction([
      this.prisma.alquilerPrecio.deleteMany({ where: { sedeId } }),
      this.prisma.alquilerPrecio.createMany({
        data: dto.precios.map((p) => ({
          sedeId,
          tipoCancha: p.tipoCancha as any,
          tipoDia: p.tipoDia as any,
          franja: p.franja as any,
          precio: p.precio,
        })),
      }),
    ]);

    return this.prisma.alquilerPrecio.findMany({ where: { sedeId } });
  }

  async obtenerPrecios(sedeId: string) {
    return this.prisma.alquilerPrecio.findMany({ where: { sedeId } });
  }

  // ════════════════════════════════════════════════════════
  // DISPONIBILIDAD (Encargado/Admin)
  // ════════════════════════════════════════════════════════

  async configurarDisponibilidad(sedeId: string, dto: ConfigurarDisponibilidadDto, userId: string, roles: string[]) {
    await this.validarEncargadoOAdmin(sedeId, userId, roles);

    // Validar que todas las canchas pertenecen a esta sede
    const canchaIds = [...new Set(dto.slots.map((s) => s.sedeCanchaId))];
    const canchas = await this.prisma.sedeCancha.findMany({
      where: { id: { in: canchaIds }, sedeId, activa: true },
    });
    if (canchas.length !== canchaIds.length) {
      throw new BadRequestException('Algunas canchas no pertenecen a esta sede o estan inactivas');
    }

    // Validar horarios
    for (const slot of dto.slots) {
      if (this.parseHoraToMinutes(slot.horaInicio) >= this.parseHoraToMinutes(slot.horaFin)) {
        throw new BadRequestException(`horaInicio debe ser menor que horaFin: ${slot.horaInicio}-${slot.horaFin}`);
      }
    }

    // Transaction: delete all + create new
    await this.prisma.$transaction([
      this.prisma.alquilerDisponibilidad.deleteMany({
        where: { sedeCancha: { sedeId } },
      }),
      this.prisma.alquilerDisponibilidad.createMany({
        data: dto.slots.map((s) => ({
          sedeCanchaId: s.sedeCanchaId,
          diaSemana: s.diaSemana,
          horaInicio: s.horaInicio,
          horaFin: s.horaFin,
        })),
      }),
    ]);

    return this.obtenerDisponibilidad(sedeId);
  }

  async obtenerDisponibilidad(sedeId: string) {
    return this.prisma.alquilerDisponibilidad.findMany({
      where: { sedeCancha: { sedeId } },
      include: { sedeCancha: { select: { id: true, nombre: true, tipo: true } } },
      orderBy: [{ sedeCanchaId: 'asc' }, { diaSemana: 'asc' }, { horaInicio: 'asc' }],
    });
  }

  // ════════════════════════════════════════════════════════
  // BLOQUEOS (Encargado/Admin)
  // ════════════════════════════════════════════════════════

  async crearBloqueo(sedeId: string, dto: CrearBloqueoAlquilerDto, userId: string, roles: string[]) {
    await this.validarEncargadoOAdmin(sedeId, userId, roles);

    if (dto.sedeCanchaId) {
      const cancha = await this.prisma.sedeCancha.findFirst({
        where: { id: dto.sedeCanchaId, sedeId },
      });
      if (!cancha) throw new BadRequestException('Cancha no pertenece a esta sede');
    }

    return this.prisma.alquilerBloqueo.create({
      data: {
        sedeId,
        sedeCanchaId: dto.sedeCanchaId,
        fechaInicio: new Date(dto.fechaInicio),
        fechaFin: new Date(dto.fechaFin),
        motivo: dto.motivo,
      },
      include: { sedeCancha: { select: { id: true, nombre: true } } },
    });
  }

  async eliminarBloqueo(sedeId: string, bloqueoId: string, userId: string, roles: string[]) {
    await this.validarEncargadoOAdmin(sedeId, userId, roles);

    const bloqueo = await this.prisma.alquilerBloqueo.findFirst({
      where: { id: bloqueoId, sedeId },
    });
    if (!bloqueo) throw new NotFoundException('Bloqueo no encontrado');

    return this.prisma.alquilerBloqueo.delete({ where: { id: bloqueoId } });
  }

  async obtenerBloqueos(sedeId: string) {
    return this.prisma.alquilerBloqueo.findMany({
      where: { sedeId },
      include: { sedeCancha: { select: { id: true, nombre: true } } },
      orderBy: { fechaInicio: 'asc' },
    });
  }

  // ════════════════════════════════════════════════════════
  // PÚBLICO
  // ════════════════════════════════════════════════════════

  async obtenerCiudadesConAlquiler(): Promise<string[]> {
    const sedes = await this.prisma.sede.findMany({
      where: { activo: true, alquilerConfig: { habilitado: true } },
      select: { ciudad: true },
      distinct: ['ciudad'],
      orderBy: { ciudad: 'asc' },
    });
    return sedes.map((s) => s.ciudad);
  }

  async buscarDisponibilidad(ciudad: string, fechaStr: string, horaInicioStr: string) {
    const fecha = new Date(fechaStr + 'T00:00:00');
    const diaSemana = fecha.getDay();
    const horaInicioMins = this.parseHoraToMinutes(horaInicioStr);
    const tipoDia = this.determinarTipoDia(fecha);
    const franja = this.determinarFranja(horaInicioStr);

    // 1. All rental-enabled sedes in city (single query with includes)
    const sedes = await this.prisma.sede.findMany({
      where: {
        ciudad: { equals: ciudad, mode: 'insensitive' },
        activo: true,
        alquilerConfig: { habilitado: true },
      },
      include: {
        alquilerConfig: true,
        canchas: { where: { activa: true } },
        alquilerPrecios: true,
      },
    });

    if (sedes.length === 0) {
      return { ciudad, fecha: fechaStr, horaInicio: horaInicioStr, sedes: [] };
    }

    const sedeIds = sedes.map((s) => s.id);
    const allCanchaIds = sedes.flatMap((s) => s.canchas.map((c) => c.id));

    // 2-5. Batch queries in parallel (no N+1)
    const [disponibilidades, bloqueos, torneoBlocks, reservas] = await Promise.all([
      this.prisma.alquilerDisponibilidad.findMany({
        where: { sedeCanchaId: { in: allCanchaIds }, diaSemana, activo: true },
      }),
      this.prisma.alquilerBloqueo.findMany({
        where: { sedeId: { in: sedeIds }, fechaInicio: { lte: fecha }, fechaFin: { gte: fecha } },
      }),
      this.prisma.torneoCanchaHorario.findMany({
        where: {
          fecha,
          torneoCancha: {
            sedeCanchaId: { in: allCanchaIds },
            tournament: {
              categorias: {
                some: {
                  estado: { in: ['INSCRIPCIONES_CERRADAS', 'FIXTURE_BORRADOR', 'SORTEO_REALIZADO', 'EN_CURSO'] },
                },
              },
            },
          },
        },
        include: { torneoCancha: { select: { sedeCanchaId: true } } },
      }),
      this.prisma.reservaCancha.findMany({
        where: {
          sedeCanchaId: { in: allCanchaIds },
          fecha,
          estado: { in: ['PENDIENTE', 'CONFIRMADA'] },
        },
      }),
    ]);

    // 6. Compute per-sede availability
    const results = sedes.map((sede) => {
      const config = sede.alquilerConfig!;
      const slotDuration = config.duracionSlotMinutos;
      const horaFinMins = horaInicioMins + slotDuration;
      const horaFinStr = this.minutesToHora(horaFinMins);

      const canchasDisponibles: any[] = [];
      let canchasOcupadas = 0;

      for (const cancha of sede.canchas) {
        // Check availability rule covers this time
        const dispRule = disponibilidades.find(
          (d) =>
            d.sedeCanchaId === cancha.id &&
            this.parseHoraToMinutes(d.horaInicio) <= horaInicioMins &&
            this.parseHoraToMinutes(d.horaFin) >= horaFinMins,
        );
        if (!dispRule) { canchasOcupadas++; continue; }

        // Check bloqueos
        const isBlocked = bloqueos.some(
          (b) => b.sedeId === sede.id && (!b.sedeCanchaId || b.sedeCanchaId === cancha.id),
        );
        if (isBlocked) { canchasOcupadas++; continue; }

        // Check tournament blocks
        const isTourneyBlocked = torneoBlocks.some((tb) => {
          if (tb.torneoCancha.sedeCanchaId !== cancha.id) return false;
          const tbStart = this.parseHoraToMinutes(tb.horaInicio);
          const tbEnd = this.parseHoraToMinutes(tb.horaFin);
          return horaInicioMins < tbEnd && horaFinMins > tbStart;
        });
        if (isTourneyBlocked) { canchasOcupadas++; continue; }

        // Check existing reservations
        const isReserved = reservas.some((r) => {
          if (r.sedeCanchaId !== cancha.id) return false;
          const rStart = this.parseHoraToMinutes(r.horaInicio);
          const rEnd = this.parseHoraToMinutes(r.horaFin);
          return horaInicioMins < rEnd && horaFinMins > rStart;
        });
        if (isReserved) { canchasOcupadas++; continue; }

        // Get price
        const precioObj = sede.alquilerPrecios.find(
          (p) => p.tipoCancha === cancha.tipo && p.tipoDia === tipoDia && p.franja === franja,
        );

        canchasDisponibles.push({
          canchaId: cancha.id,
          canchaNombre: cancha.nombre,
          canchaTipo: cancha.tipo,
          precio: precioObj?.precio ?? 0,
          horaFin: horaFinStr,
        });
      }

      return {
        id: sede.id,
        nombre: sede.nombre,
        ciudad: sede.ciudad,
        direccion: sede.direccion,
        telefono: sede.telefono,
        logoUrl: sede.logoUrl,
        imagenFondo: sede.imagenFondo,
        mapsUrl: sede.mapsUrl,
        config: {
          duracionSlotMinutos: slotDuration,
          requiereAprobacion: config.requiereAprobacion,
          mensajeBienvenida: config.mensajeBienvenida,
        },
        canchasDisponibles,
        canchasOcupadas,
      };
    });

    // Filter & sort: only sedes with available courts, most courts first
    const sedesConDisponibilidad = results
      .filter((s) => s.canchasDisponibles.length > 0)
      .sort((a, b) => b.canchasDisponibles.length - a.canchasDisponibles.length || a.nombre.localeCompare(b.nombre));

    return {
      ciudad,
      fecha: fechaStr,
      horaInicio: horaInicioStr,
      sedes: sedesConDisponibilidad,
    };
  }

  async obtenerSedesConAlquiler(filters?: { ciudad?: string; nombre?: string }) {
    const where: any = {
      activo: true,
      alquilerConfig: { habilitado: true },
    };
    if (filters?.ciudad) {
      where.ciudad = { contains: filters.ciudad, mode: 'insensitive' };
    }
    if (filters?.nombre) {
      where.nombre = { contains: filters.nombre, mode: 'insensitive' };
    }

    const sedes = await this.prisma.sede.findMany({
      where,
      include: {
        canchas: { where: { activa: true }, select: { id: true, nombre: true, tipo: true } },
        alquilerConfig: { select: { duracionSlotMinutos: true, requiereAprobacion: true, mensajeBienvenida: true } },
        alquilerPrecios: { select: { precio: true, tipoCancha: true } },
      },
      orderBy: { nombre: 'asc' },
    });

    return sedes.map((sede) => {
      const precios = sede.alquilerPrecios.map((p) => p.precio).filter((p) => p > 0);
      const tiposCanchas = [...new Set(sede.canchas.map((c) => c.tipo))];
      return {
        id: sede.id,
        nombre: sede.nombre,
        ciudad: sede.ciudad,
        direccion: sede.direccion,
        telefono: sede.telefono,
        logoUrl: sede.logoUrl,
        imagenFondo: sede.imagenFondo,
        canchasCount: sede.canchas.length,
        precioMin: precios.length > 0 ? Math.min(...precios) : 0,
        precioMax: precios.length > 0 ? Math.max(...precios) : 0,
        tiposCanchas,
        config: sede.alquilerConfig,
      };
    });
  }

  async obtenerSedeAlquilerDetalle(sedeId: string) {
    const sede = await this.prisma.sede.findUnique({
      where: { id: sedeId },
      include: {
        canchas: { where: { activa: true }, orderBy: { nombre: 'asc' } },
        alquilerConfig: {
          include: { encargado: { select: { id: true, nombre: true, apellido: true } } },
        },
        alquilerPrecios: true,
      },
    });

    if (!sede) throw new NotFoundException('Sede no encontrada');
    if (!sede.alquilerConfig?.habilitado) {
      throw new NotFoundException('Esta sede no tiene alquiler habilitado');
    }

    return sede;
  }

  async obtenerDisponibilidadDia(sedeId: string, fechaStr: string) {
    const fecha = new Date(fechaStr + 'T00:00:00');
    const diaSemana = fecha.getDay(); // 0=dom..6=sab

    // Get sede config
    const config = await this.prisma.alquilerConfig.findUnique({ where: { sedeId } });
    if (!config || !config.habilitado) {
      throw new NotFoundException('Alquiler no habilitado para esta sede');
    }

    // Get active courts
    const canchas = await this.prisma.sedeCancha.findMany({
      where: { sedeId, activa: true },
      orderBy: { nombre: 'asc' },
    });

    // Get availability for this day of week
    const disponibilidades = await this.prisma.alquilerDisponibilidad.findMany({
      where: { sedeCancha: { sedeId }, diaSemana, activo: true },
    });

    // Get blocks for this date
    const bloqueos = await this.prisma.alquilerBloqueo.findMany({
      where: {
        sedeId,
        fechaInicio: { lte: fecha },
        fechaFin: { gte: fecha },
      },
    });

    // Get tournament blocks for active tournaments
    const torneoCanchaHorarios = await this.prisma.torneoCanchaHorario.findMany({
      where: {
        fecha,
        torneoCancha: {
          sedeCancha: { sedeId },
          tournament: {
            categorias: {
              some: {
                estado: { in: ['INSCRIPCIONES_CERRADAS', 'FIXTURE_BORRADOR', 'SORTEO_REALIZADO', 'EN_CURSO'] },
              },
            },
          },
        },
      },
      include: { torneoCancha: { select: { sedeCanchaId: true } } },
    });

    // Get existing reservations for this date
    const reservas = await this.prisma.reservaCancha.findMany({
      where: {
        sedeCancha: { sedeId },
        fecha,
        estado: { in: ['PENDIENTE', 'CONFIRMADA'] },
      },
    });

    // Get prices
    const precios = await this.prisma.alquilerPrecio.findMany({ where: { sedeId } });

    const tipoDia = this.determinarTipoDia(fecha);
    const slotDuration = config.duracionSlotMinutos;

    // Build slots for each court
    const result = canchas.map((cancha) => {
      const canchaDisp = disponibilidades.filter((d) => d.sedeCanchaId === cancha.id);
      const canchaBloqueos = bloqueos.filter(
        (b) => !b.sedeCanchaId || b.sedeCanchaId === cancha.id,
      );
      const canchaTorneoBlocks = torneoCanchaHorarios.filter(
        (th) => th.torneoCancha.sedeCanchaId === cancha.id,
      );
      const canchaReservas = reservas.filter((r) => r.sedeCanchaId === cancha.id);

      // Generate time slots
      const slots: any[] = [];

      for (const disp of canchaDisp) {
        const inicio = this.parseHoraToMinutes(disp.horaInicio);
        const fin = this.parseHoraToMinutes(disp.horaFin);

        for (let t = inicio; t + slotDuration <= fin; t += slotDuration) {
          const slotInicio = this.minutesToHora(t);
          const slotFin = this.minutesToHora(t + slotDuration);

          // Check if blocked
          const bloqueado = canchaBloqueos.length > 0;

          // Check if tournament blocked
          const torneoBlock = canchaTorneoBlocks.some((th) => {
            const thInicio = this.parseHoraToMinutes(th.horaInicio);
            const thFin = this.parseHoraToMinutes(th.horaFin);
            return t < thFin && t + slotDuration > thInicio;
          });

          // Check if already reserved
          const reservado = canchaReservas.some((r) => {
            const rInicio = this.parseHoraToMinutes(r.horaInicio);
            const rFin = this.parseHoraToMinutes(r.horaFin);
            return t < rFin && t + slotDuration > rInicio;
          });

          // Get price
          const franja = this.determinarFranja(slotInicio);
          const precioObj = precios.find(
            (p) =>
              p.tipoCancha === cancha.tipo &&
              p.tipoDia === tipoDia &&
              p.franja === franja,
          );

          slots.push({
            horaInicio: slotInicio,
            horaFin: slotFin,
            disponible: !bloqueado && !torneoBlock && !reservado,
            precio: precioObj?.precio ?? 0,
            motivo: bloqueado ? 'bloqueado' : torneoBlock ? 'torneo' : reservado ? 'reservado' : null,
          });
        }
      }

      return {
        canchaId: cancha.id,
        canchaNombre: cancha.nombre,
        canchaTipo: cancha.tipo,
        slots,
      };
    });

    return {
      sedeId,
      fecha: fechaStr,
      diaSemana,
      duracionSlotMinutos: slotDuration,
      canchas: result,
    };
  }

  async obtenerCalendarioSemanal(sedeId: string, fechaInicioStr: string) {
    const fechaInicio = new Date(fechaInicioStr + 'T00:00:00');
    const dias: any[] = [];

    for (let i = 0; i < 7; i++) {
      const fecha = new Date(fechaInicio);
      fecha.setDate(fecha.getDate() + i);
      const fechaStr = fecha.toISOString().split('T')[0];
      const disponibilidad = await this.obtenerDisponibilidadDia(sedeId, fechaStr);
      dias.push(disponibilidad);
    }

    return { sedeId, fechaInicio: fechaInicioStr, semana: dias };
  }

  // ════════════════════════════════════════════════════════
  // RESERVAS — USUARIO
  // ════════════════════════════════════════════════════════

  async crearReserva(userId: string, sedeId: string, dto: CrearReservaCanchaDto) {
    // Validar sede habilitada
    const config = await this.prisma.alquilerConfig.findUnique({
      where: { sedeId },
      include: { sede: { select: { nombre: true } } },
    });
    if (!config || !config.habilitado) {
      throw new BadRequestException('Alquiler no habilitado para esta sede');
    }

    // Validar cancha pertenece a sede
    const cancha = await this.prisma.sedeCancha.findFirst({
      where: { id: dto.sedeCanchaId, sedeId, activa: true },
    });
    if (!cancha) throw new BadRequestException('Cancha no encontrada o inactiva');

    // Validar fecha no pasada
    const fecha = new Date(dto.fecha + 'T00:00:00');
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    if (fecha < hoy) throw new BadRequestException('No se puede reservar en fecha pasada');

    // Calcular horaFin
    const inicioMins = this.parseHoraToMinutes(dto.horaInicio);
    const horaFin = this.minutesToHora(inicioMins + config.duracionSlotMinutos);

    // Validar disponibilidad
    const diaSemana = fecha.getDay();
    const disponibilidad = await this.prisma.alquilerDisponibilidad.findFirst({
      where: {
        sedeCanchaId: dto.sedeCanchaId,
        diaSemana,
        activo: true,
      },
    });
    if (!disponibilidad) {
      throw new BadRequestException('No hay disponibilidad para esta cancha en este dia');
    }

    const dispInicio = this.parseHoraToMinutes(disponibilidad.horaInicio);
    const dispFin = this.parseHoraToMinutes(disponibilidad.horaFin);
    if (inicioMins < dispInicio || inicioMins + config.duracionSlotMinutos > dispFin) {
      throw new BadRequestException('El horario seleccionado esta fuera de la disponibilidad');
    }

    // Check bloqueos
    const bloqueo = await this.prisma.alquilerBloqueo.findFirst({
      where: {
        sedeId,
        fechaInicio: { lte: fecha },
        fechaFin: { gte: fecha },
        OR: [{ sedeCanchaId: null }, { sedeCanchaId: dto.sedeCanchaId }],
      },
    });
    if (bloqueo) throw new BadRequestException('Este horario esta bloqueado');

    // Check collision with existing reservations
    const collision = await this.prisma.reservaCancha.findFirst({
      where: {
        sedeCanchaId: dto.sedeCanchaId,
        fecha,
        estado: { in: ['PENDIENTE', 'CONFIRMADA'] },
      },
    });
    if (collision) {
      const cInicio = this.parseHoraToMinutes(collision.horaInicio);
      const cFin = this.parseHoraToMinutes(collision.horaFin);
      if (inicioMins < cFin && inicioMins + config.duracionSlotMinutos > cInicio) {
        throw new BadRequestException('Este horario ya esta reservado');
      }
    }

    // Calculate price
    const precio = await this.obtenerPrecioSlot(sedeId, cancha.tipo, fecha, dto.horaInicio);

    // Create reservation
    const estado = config.requiereAprobacion ? 'PENDIENTE' : 'CONFIRMADA';
    const reserva = await this.prisma.reservaCancha.create({
      data: {
        sedeCanchaId: dto.sedeCanchaId,
        userId,
        fecha,
        horaInicio: dto.horaInicio,
        horaFin,
        duracionMinutos: config.duracionSlotMinutos,
        precio,
        estado: estado as any,
        notas: dto.notas,
      },
      include: {
        sedeCancha: { include: { sede: { select: { id: true, nombre: true } } } },
        user: { select: { id: true, nombre: true, apellido: true } },
      },
    });

    // Notify encargado
    try {
      if (config.encargadoId) {
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
          select: { nombre: true, apellido: true },
        });
        const nombre = user ? `${user.nombre} ${user.apellido}` : 'Un usuario';
        const fechaStr = fecha.toLocaleDateString('es-PY', { day: 'numeric', month: 'short' });

        await this.notificacionesService.notificar({
          userId: config.encargadoId,
          tipo: 'SISTEMA',
          titulo: 'Nueva reserva de cancha',
          contenido: `${nombre} reservo ${cancha.nombre} para el ${fechaStr} a las ${dto.horaInicio}.`,
          enlace: '/gestion-alquileres',
          smsTexto: `FairPadel: Nueva reserva de ${nombre} - ${cancha.nombre} ${fechaStr} ${dto.horaInicio}. Revisa tu panel.`,
          forzarSms: true,
        });
      }
    } catch (e) {
      this.logger.warn('Error enviando notificacion de reserva: ' + e.message);
    }

    // If auto-confirmed, notify user
    if (estado === 'CONFIRMADA') {
      try {
        const fechaStr = fecha.toLocaleDateString('es-PY', { day: 'numeric', month: 'short' });
        await this.notificacionesService.notificar({
          userId,
          tipo: 'SISTEMA',
          titulo: 'Reserva confirmada',
          contenido: `Tu reserva en ${config.sede.nombre} - ${cancha.nombre} para el ${fechaStr} a las ${dto.horaInicio} fue confirmada automaticamente.`,
          enlace: '/mis-reservas-cancha',
          smsTexto: `FairPadel: Tu reserva en ${config.sede.nombre} ${cancha.nombre} ${fechaStr} ${dto.horaInicio} fue confirmada.`,
          forzarSms: true,
        });
      } catch (e) {
        this.logger.warn('Error enviando notificacion de confirmacion: ' + e.message);
      }
    }

    return reserva;
  }

  async cancelarReserva(reservaId: string, userId: string) {
    const reserva = await this.prisma.reservaCancha.findUnique({
      where: { id: reservaId },
      include: {
        sedeCancha: { include: { sede: { select: { id: true, nombre: true, alquilerConfig: true } } } },
      },
    });
    if (!reserva) throw new NotFoundException('Reserva no encontrada');
    if (reserva.userId !== userId) throw new ForbiddenException('No es tu reserva');
    if (!['PENDIENTE', 'CONFIRMADA'].includes(reserva.estado)) {
      throw new BadRequestException('Solo se pueden cancelar reservas pendientes o confirmadas');
    }

    // Check if within cancellation window
    const config = reserva.sedeCancha.sede.alquilerConfig;
    let compromisoPago = false;

    if (config && config.cancelacionMinHoras > 0) {
      const reservaDateTime = new Date(reserva.fecha);
      const [h, m] = reserva.horaInicio.split(':').map(Number);
      reservaDateTime.setHours(h, m, 0, 0);

      const ahora = new Date();
      const horasAntes = (reservaDateTime.getTime() - ahora.getTime()) / (1000 * 60 * 60);

      if (horasAntes < config.cancelacionMinHoras) {
        compromisoPago = true;
      }
    }

    const updated = await this.prisma.reservaCancha.update({
      where: { id: reservaId },
      data: {
        estado: 'CANCELADA',
        compromisoPago,
      },
      include: {
        sedeCancha: { include: { sede: { select: { nombre: true } } } },
        user: { select: { nombre: true, apellido: true } },
      },
    });

    // Notify encargado
    try {
      if (config?.encargadoId) {
        const nombre = updated.user ? `${updated.user.nombre} ${updated.user.apellido}` : 'Un usuario';
        const fechaStr = reserva.fecha.toLocaleDateString('es-PY', { day: 'numeric', month: 'short' });

        const smsTexto = compromisoPago
          ? `FairPadel: ${nombre} cancelo tarde su reserva del ${fechaStr} ${reserva.horaInicio}. Queda compromiso de pago.`
          : `FairPadel: ${nombre} cancelo su reserva del ${fechaStr} ${reserva.horaInicio}.`;

        await this.notificacionesService.notificar({
          userId: config.encargadoId,
          tipo: 'SISTEMA',
          titulo: compromisoPago ? 'Cancelacion tardia - Compromiso de pago' : 'Reserva cancelada',
          contenido: compromisoPago
            ? `${nombre} cancelo su reserva del ${fechaStr} ${reserva.horaInicio} fuera de plazo. Queda con compromiso de pago (${reserva.precio} Gs).`
            : `${nombre} cancelo su reserva del ${fechaStr} ${reserva.horaInicio}.`,
          enlace: '/gestion-alquileres',
          smsTexto,
          forzarSms: true,
        });
      }
    } catch (e) {
      this.logger.warn('Error enviando notificacion de cancelacion: ' + e.message);
    }

    return updated;
  }

  async obtenerMisReservas(userId: string, estado?: string) {
    const where: any = { userId };
    if (estado) where.estado = estado;

    return this.prisma.reservaCancha.findMany({
      where,
      include: {
        sedeCancha: {
          include: { sede: { select: { id: true, nombre: true, ciudad: true, logoUrl: true } } },
        },
      },
      orderBy: [{ fecha: 'desc' }, { horaInicio: 'desc' }],
    });
  }

  // ════════════════════════════════════════════════════════
  // RESERVAS — ENCARGADO
  // ════════════════════════════════════════════════════════

  async obtenerMiSede(userId: string) {
    const config = await this.prisma.alquilerConfig.findFirst({
      where: { encargadoId: userId, habilitado: true },
      include: {
        sede: { select: { id: true, nombre: true, ciudad: true, logoUrl: true } },
      },
    });
    if (!config) throw new NotFoundException('No sos encargado de ninguna sede');
    return config;
  }

  async obtenerReservasSede(sedeId: string, userId: string, roles: string[], filters?: { estado?: string; fecha?: string }) {
    await this.validarEncargadoOAdmin(sedeId, userId, roles);

    const where: any = { sedeCancha: { sedeId } };
    if (filters?.estado) where.estado = filters.estado;
    if (filters?.fecha) where.fecha = new Date(filters.fecha + 'T00:00:00');

    return this.prisma.reservaCancha.findMany({
      where,
      include: {
        sedeCancha: { select: { id: true, nombre: true, tipo: true } },
        user: { select: { id: true, nombre: true, apellido: true, telefono: true, fotoUrl: true } },
      },
      orderBy: [{ fecha: 'desc' }, { horaInicio: 'desc' }],
    });
  }

  async confirmarReserva(reservaId: string, userId: string, roles: string[]) {
    const reserva = await this.prisma.reservaCancha.findUnique({
      where: { id: reservaId },
      include: { sedeCancha: { include: { sede: true } } },
    });
    if (!reserva) throw new NotFoundException('Reserva no encontrada');

    await this.validarEncargadoOAdmin(reserva.sedeCancha.sedeId, userId, roles);

    if (reserva.estado !== 'PENDIENTE') {
      throw new BadRequestException('Solo se pueden confirmar reservas pendientes');
    }

    const updated = await this.prisma.reservaCancha.update({
      where: { id: reservaId },
      data: { estado: 'CONFIRMADA' },
      include: {
        sedeCancha: { include: { sede: { select: { nombre: true } } } },
      },
    });

    // Notify user
    if (reserva.userId) {
      try {
        const fechaStr = reserva.fecha.toLocaleDateString('es-PY', { day: 'numeric', month: 'short' });
        const sedeName = updated.sedeCancha.sede.nombre;
        const canchaName = updated.sedeCancha.nombre;

        await this.notificacionesService.notificar({
          userId: reserva.userId,
          tipo: 'SISTEMA',
          titulo: 'Reserva de cancha confirmada',
          contenido: `Tu reserva en ${sedeName} - ${canchaName} para el ${fechaStr} a las ${reserva.horaInicio} fue confirmada.`,
          enlace: '/mis-reservas-cancha',
          smsTexto: `FairPadel: Tu reserva en ${sedeName} ${canchaName} ${fechaStr} ${reserva.horaInicio} fue confirmada.`,
          forzarSms: true,
        });
      } catch (e) {
        this.logger.warn('Error enviando notificacion confirmar: ' + e.message);
      }
    }

    return updated;
  }

  async rechazarReserva(reservaId: string, userId: string, roles: string[], dto: RechazarReservaCanchaDto) {
    const reserva = await this.prisma.reservaCancha.findUnique({
      where: { id: reservaId },
      include: { sedeCancha: { include: { sede: true } } },
    });
    if (!reserva) throw new NotFoundException('Reserva no encontrada');

    await this.validarEncargadoOAdmin(reserva.sedeCancha.sedeId, userId, roles);

    if (reserva.estado !== 'PENDIENTE') {
      throw new BadRequestException('Solo se pueden rechazar reservas pendientes');
    }

    const updated = await this.prisma.reservaCancha.update({
      where: { id: reservaId },
      data: { estado: 'RECHAZADA', motivoRechazo: dto.motivo },
      include: {
        sedeCancha: { include: { sede: { select: { nombre: true } } } },
      },
    });

    // Notify user
    if (reserva.userId) {
      try {
        const fechaStr = reserva.fecha.toLocaleDateString('es-PY', { day: 'numeric', month: 'short' });
        const sedeName = updated.sedeCancha.sede.nombre;

        await this.notificacionesService.notificar({
          userId: reserva.userId,
          tipo: 'SISTEMA',
          titulo: 'Reserva de cancha rechazada',
          contenido: `Tu reserva en ${sedeName} para el ${fechaStr} fue rechazada.${dto.motivo ? ' Motivo: ' + dto.motivo : ''}`,
          enlace: '/mis-reservas-cancha',
          smsTexto: `FairPadel: Tu reserva en ${sedeName} ${fechaStr} fue rechazada.`,
          forzarSms: true,
        });
      } catch (e) {
        this.logger.warn('Error enviando notificacion rechazar: ' + e.message);
      }
    }

    return updated;
  }

  async completarReserva(reservaId: string, userId: string, roles: string[]) {
    const reserva = await this.prisma.reservaCancha.findUnique({
      where: { id: reservaId },
      include: { sedeCancha: true },
    });
    if (!reserva) throw new NotFoundException('Reserva no encontrada');

    await this.validarEncargadoOAdmin(reserva.sedeCancha.sedeId, userId, roles);

    if (reserva.estado !== 'CONFIRMADA') {
      throw new BadRequestException('Solo se pueden completar reservas confirmadas');
    }

    return this.prisma.reservaCancha.update({
      where: { id: reservaId },
      data: { estado: 'COMPLETADA' },
    });
  }

  async marcarNoShow(reservaId: string, userId: string, roles: string[]) {
    const reserva = await this.prisma.reservaCancha.findUnique({
      where: { id: reservaId },
      include: { sedeCancha: true },
    });
    if (!reserva) throw new NotFoundException('Reserva no encontrada');

    await this.validarEncargadoOAdmin(reserva.sedeCancha.sedeId, userId, roles);

    if (reserva.estado !== 'CONFIRMADA') {
      throw new BadRequestException('Solo se puede marcar no-show en reservas confirmadas');
    }

    return this.prisma.reservaCancha.update({
      where: { id: reservaId },
      data: { estado: 'NO_SHOW' },
    });
  }

  async marcarPago(reservaId: string, userId: string, roles: string[], dto: MarcarPagoCanchaDto) {
    const reserva = await this.prisma.reservaCancha.findUnique({
      where: { id: reservaId },
      include: { sedeCancha: true },
    });
    if (!reserva) throw new NotFoundException('Reserva no encontrada');

    await this.validarEncargadoOAdmin(reserva.sedeCancha.sedeId, userId, roles);

    return this.prisma.reservaCancha.update({
      where: { id: reservaId },
      data: {
        pagado: dto.pagado,
        metodoPago: dto.metodoPago as any,
      },
    });
  }

  async crearReservaManual(sedeId: string, userId: string, roles: string[], dto: CrearReservaManualDto) {
    await this.validarEncargadoOAdmin(sedeId, userId, roles);

    const config = await this.prisma.alquilerConfig.findUnique({ where: { sedeId } });
    if (!config) throw new NotFoundException('Configuracion no encontrada');

    const cancha = await this.prisma.sedeCancha.findFirst({
      where: { id: dto.sedeCanchaId, sedeId, activa: true },
    });
    if (!cancha) throw new BadRequestException('Cancha no encontrada');

    if (!dto.userId && !dto.nombreExterno) {
      throw new BadRequestException('Debe indicar un usuario registrado o datos del externo');
    }

    const fecha = new Date(dto.fecha + 'T00:00:00');
    const inicioMins = this.parseHoraToMinutes(dto.horaInicio);
    const horaFin = this.minutesToHora(inicioMins + config.duracionSlotMinutos);

    const precio = await this.obtenerPrecioSlot(sedeId, cancha.tipo, fecha, dto.horaInicio);

    return this.prisma.reservaCancha.create({
      data: {
        sedeCanchaId: dto.sedeCanchaId,
        userId: dto.userId,
        fecha,
        horaInicio: dto.horaInicio,
        horaFin,
        duracionMinutos: config.duracionSlotMinutos,
        precio,
        estado: 'CONFIRMADA',
        creadoPorEncargado: true,
        nombreExterno: dto.nombreExterno,
        telefonoExterno: dto.telefonoExterno,
        notas: dto.notas,
      },
      include: {
        sedeCancha: { select: { nombre: true, tipo: true } },
        user: { select: { nombre: true, apellido: true } },
      },
    });
  }

  // ════════════════════════════════════════════════════════
  // ADMIN DASHBOARD
  // ════════════════════════════════════════════════════════

  async obtenerDashboardAlquileres() {
    const sedesHabilitadas = await this.prisma.alquilerConfig.count({
      where: { habilitado: true },
    });

    const hoy = new Date();
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const finMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);

    const reservasMes = await this.prisma.reservaCancha.count({
      where: {
        createdAt: { gte: inicioMes, lte: finMes },
      },
    });

    const reservasConfirmadas = await this.prisma.reservaCancha.count({
      where: {
        createdAt: { gte: inicioMes, lte: finMes },
        estado: { in: ['CONFIRMADA', 'COMPLETADA'] },
      },
    });

    const revenueResult = await this.prisma.reservaCancha.aggregate({
      where: {
        fecha: { gte: inicioMes, lte: finMes },
        pagado: true,
      },
      _sum: { precio: true },
    });

    return {
      sedesHabilitadas,
      reservasMes,
      reservasConfirmadas,
      revenueMes: revenueResult._sum.precio ?? 0,
    };
  }
}
