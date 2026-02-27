import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SolicitarInstructorDto } from './dto/solicitar-instructor.dto';
import { ActualizarInstructorDto, ActualizarUbicacionesDto } from './dto/actualizar-instructor.dto';
import { ActualizarDisponibilidadDto, CrearBloqueoDto } from './dto/disponibilidad.dto';
import { CrearReservaDto, RechazarReservaDto } from './dto/reserva.dto';
import { ForbiddenException } from '@nestjs/common';

@Injectable()
export class InstructoresService {
  private readonly logger = new Logger(InstructoresService.name);

  constructor(private prisma: PrismaService) {}

  // ── Solicitud ──────────────────────────────────────────

  async solicitarSerInstructor(userId: string, dto: SolicitarInstructorDto) {
    // Verificar que no sea instructor ya
    const existingInstructor = await this.prisma.instructor.findUnique({
      where: { userId },
    });
    if (existingInstructor) {
      throw new ConflictException('Ya sos instructor');
    }

    // Verificar que no tenga solicitud pendiente
    const existingSolicitud = await this.prisma.solicitudInstructor.findFirst({
      where: { userId, estado: 'PENDIENTE' },
    });
    if (existingSolicitud) {
      throw new ConflictException('Ya tenés una solicitud pendiente');
    }

    const solicitud = await this.prisma.solicitudInstructor.create({
      data: {
        userId,
        experienciaAnios: dto.experienciaAnios,
        certificaciones: dto.certificaciones || null,
        especialidades: dto.especialidades || null,
        nivelesEnsenanza: dto.nivelesEnsenanza || null,
        descripcion: dto.descripcion || null,
        precioIndividual: dto.precioIndividual || null,
        precioGrupal: dto.precioGrupal || null,
        ciudades: dto.ciudades || null,
      },
    });

    this.logger.log(`Solicitud de instructor creada: ${solicitud.id} por usuario ${userId}`);
    return { message: 'Solicitud enviada. Te notificaremos cuando sea revisada.', solicitud };
  }

  async obtenerMiSolicitud(userId: string) {
    const solicitud = await this.prisma.solicitudInstructor.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return solicitud;
  }

  // ── Perfil Instructor (logueado) ──────────────────────

  async obtenerMiPerfil(userId: string) {
    const instructor = await this.prisma.instructor.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            email: true,
            telefono: true,
            ciudad: true,
            fotoUrl: true,
          },
        },
        ubicaciones: {
          where: { activa: true },
          include: {
            sede: { select: { id: true, nombre: true, ciudad: true } },
          },
          orderBy: { esPrincipal: 'desc' },
        },
      },
    });

    if (!instructor) {
      throw new NotFoundException('No sos instructor');
    }

    return instructor;
  }

  async actualizarPerfil(userId: string, dto: ActualizarInstructorDto) {
    const instructor = await this.prisma.instructor.findUnique({
      where: { userId },
    });
    if (!instructor) {
      throw new NotFoundException('No sos instructor');
    }

    const updated = await this.prisma.instructor.update({
      where: { userId },
      data: {
        ...(dto.experienciaAnios !== undefined && { experienciaAnios: dto.experienciaAnios }),
        ...(dto.certificaciones !== undefined && { certificaciones: dto.certificaciones }),
        ...(dto.especialidades !== undefined && { especialidades: dto.especialidades }),
        ...(dto.nivelesEnsenanza !== undefined && { nivelesEnsenanza: dto.nivelesEnsenanza }),
        ...(dto.descripcion !== undefined && { descripcion: dto.descripcion }),
        ...(dto.precioIndividual !== undefined && { precioIndividual: dto.precioIndividual }),
        ...(dto.precioGrupal !== undefined && { precioGrupal: dto.precioGrupal }),
        ...(dto.aceptaDomicilio !== undefined && { aceptaDomicilio: dto.aceptaDomicilio }),
      },
    });

    return updated;
  }

  async actualizarUbicaciones(userId: string, dto: ActualizarUbicacionesDto) {
    const instructor = await this.prisma.instructor.findUnique({
      where: { userId },
    });
    if (!instructor) {
      throw new NotFoundException('No sos instructor');
    }

    // Delete all existing, recreate
    await this.prisma.$transaction(async (tx) => {
      await tx.instructorUbicacion.deleteMany({
        where: { instructorId: instructor.id },
      });

      if (dto.ubicaciones.length > 0) {
        await tx.instructorUbicacion.createMany({
          data: dto.ubicaciones.map((u) => ({
            instructorId: instructor.id,
            sedeId: u.sedeId || null,
            nombreCustom: u.nombreCustom || null,
            ciudad: u.ciudad,
            esPrincipal: u.esPrincipal || false,
          })),
        });
      }
    });

    return { message: 'Ubicaciones actualizadas' };
  }

  // ── Disponibilidad (instructor) ───────────────────────

  async obtenerMiDisponibilidad(userId: string) {
    const instructor = await this.prisma.instructor.findUnique({ where: { userId } });
    if (!instructor) throw new NotFoundException('No sos instructor');

    return this.prisma.instructorDisponibilidad.findMany({
      where: { instructorId: instructor.id, activo: true },
      orderBy: [{ diaSemana: 'asc' }, { horaInicio: 'asc' }],
    });
  }

  async actualizarDisponibilidad(userId: string, dto: ActualizarDisponibilidadDto) {
    const instructor = await this.prisma.instructor.findUnique({ where: { userId } });
    if (!instructor) throw new NotFoundException('No sos instructor');

    // Validate each slot: horaInicio < horaFin
    for (const slot of dto.slots) {
      if (slot.horaInicio >= slot.horaFin) {
        throw new BadRequestException(`Horario inválido: ${slot.horaInicio} debe ser antes que ${slot.horaFin}`);
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.instructorDisponibilidad.deleteMany({ where: { instructorId: instructor.id } });

      if (dto.slots.length > 0) {
        await tx.instructorDisponibilidad.createMany({
          data: dto.slots.map((s) => ({
            instructorId: instructor.id,
            diaSemana: s.diaSemana,
            horaInicio: s.horaInicio,
            horaFin: s.horaFin,
          })),
        });
      }
    });

    return { message: 'Disponibilidad actualizada' };
  }

  // ── Bloqueos (instructor) ────────────────────────────

  async obtenerMisBloqueos(userId: string) {
    const instructor = await this.prisma.instructor.findUnique({ where: { userId } });
    if (!instructor) throw new NotFoundException('No sos instructor');

    return this.prisma.instructorBloqueo.findMany({
      where: { instructorId: instructor.id },
      orderBy: { fechaInicio: 'asc' },
    });
  }

  async crearBloqueo(userId: string, dto: CrearBloqueoDto) {
    const instructor = await this.prisma.instructor.findUnique({ where: { userId } });
    if (!instructor) throw new NotFoundException('No sos instructor');

    if (new Date(dto.fechaInicio) > new Date(dto.fechaFin)) {
      throw new BadRequestException('La fecha de inicio debe ser anterior o igual a la fecha de fin');
    }

    return this.prisma.instructorBloqueo.create({
      data: {
        instructorId: instructor.id,
        fechaInicio: new Date(dto.fechaInicio),
        fechaFin: new Date(dto.fechaFin),
        motivo: dto.motivo || null,
      },
    });
  }

  async eliminarBloqueo(userId: string, bloqueoId: string) {
    const instructor = await this.prisma.instructor.findUnique({ where: { userId } });
    if (!instructor) throw new NotFoundException('No sos instructor');

    const bloqueo = await this.prisma.instructorBloqueo.findUnique({ where: { id: bloqueoId } });
    if (!bloqueo || bloqueo.instructorId !== instructor.id) {
      throw new NotFoundException('Bloqueo no encontrado');
    }

    await this.prisma.instructorBloqueo.delete({ where: { id: bloqueoId } });
    return { message: 'Bloqueo eliminado' };
  }

  // ── Horarios disponibles (público) ──────────────────

  async getHorariosDisponibles(instructorId: string, fecha: string) {
    const instructor = await this.prisma.instructor.findUnique({ where: { id: instructorId } });
    if (!instructor || instructor.estado !== 'APROBADO') {
      throw new NotFoundException('Instructor no encontrado');
    }

    const dateObj = new Date(fecha + 'T00:00:00');
    const diaSemana = dateObj.getDay(); // 0=dom..6=sab

    // 1. Get weekly availability for this day
    const disponibilidades = await this.prisma.instructorDisponibilidad.findMany({
      where: { instructorId, diaSemana, activo: true },
      orderBy: { horaInicio: 'asc' },
    });

    if (disponibilidades.length === 0) {
      return { fecha, slots: [] };
    }

    // 2. Check if date is blocked
    const bloqueado = await this.prisma.instructorBloqueo.findFirst({
      where: {
        instructorId,
        fechaInicio: { lte: dateObj },
        fechaFin: { gte: dateObj },
      },
    });

    if (bloqueado) {
      return { fecha, slots: [], bloqueado: true };
    }

    // 3. Get confirmed/pending reservations on this date
    const reservas = await this.prisma.reservaInstructor.findMany({
      where: {
        instructorId,
        fecha: dateObj,
        estado: { in: ['CONFIRMADA', 'PENDIENTE'] },
      },
    });

    // 4. Generate 60-minute slots from availability ranges
    const duracion = 60; // minutes, hardcoded for now
    const allSlots: { horaInicio: string; horaFin: string; disponible: boolean }[] = [];

    for (const disp of disponibilidades) {
      const startMin = this.parseHoraToMinutes(disp.horaInicio);
      const endMin = this.parseHoraToMinutes(disp.horaFin);

      for (let m = startMin; m + duracion <= endMin; m += duracion) {
        const slotInicio = this.minutesToHora(m);
        const slotFin = this.minutesToHora(m + duracion);

        // Check if slot overlaps with any reservation
        const ocupado = reservas.some((r) => {
          const rStart = this.parseHoraToMinutes(r.horaInicio);
          const rEnd = this.parseHoraToMinutes(r.horaFin);
          return m < rEnd && m + duracion > rStart; // overlap check
        });

        allSlots.push({
          horaInicio: slotInicio,
          horaFin: slotFin,
          disponible: !ocupado,
        });
      }
    }

    return { fecha, slots: allSlots };
  }

  // ── Reservas — lado alumno ──────────────────────────

  async crearReserva(instructorId: string, userId: string, dto: CrearReservaDto) {
    // Validate not reserving own class
    const instructor = await this.prisma.instructor.findUnique({ where: { id: instructorId } });
    if (!instructor || instructor.estado !== 'APROBADO') {
      throw new NotFoundException('Instructor no encontrado');
    }
    if (instructor.userId === userId) {
      throw new BadRequestException('No podés reservar una clase con vos mismo');
    }

    const duracion = dto.duracionMinutos || 60;
    const horaFin = this.minutesToHora(this.parseHoraToMinutes(dto.horaInicio) + duracion);

    // Validate slot is available
    const fechaDate = new Date(dto.fecha + 'T00:00:00');
    const diaSemana = fechaDate.getDay();

    const disponible = await this.prisma.instructorDisponibilidad.findFirst({
      where: {
        instructorId,
        diaSemana,
        activo: true,
        horaInicio: { lte: dto.horaInicio },
        horaFin: { gte: horaFin },
      },
    });
    if (!disponible) {
      throw new BadRequestException('El instructor no tiene disponibilidad en ese horario');
    }

    // Check blocks
    const bloqueado = await this.prisma.instructorBloqueo.findFirst({
      where: {
        instructorId,
        fechaInicio: { lte: fechaDate },
        fechaFin: { gte: fechaDate },
      },
    });
    if (bloqueado) {
      throw new BadRequestException('El instructor tiene un bloqueo en esa fecha');
    }

    // Check existing reservations (overlap)
    const startMin = this.parseHoraToMinutes(dto.horaInicio);
    const existingReservas = await this.prisma.reservaInstructor.findMany({
      where: {
        instructorId,
        fecha: fechaDate,
        estado: { in: ['CONFIRMADA', 'PENDIENTE'] },
      },
    });
    const overlap = existingReservas.some((r) => {
      const rStart = this.parseHoraToMinutes(r.horaInicio);
      const rEnd = this.parseHoraToMinutes(r.horaFin);
      return startMin < rEnd && startMin + duracion > rStart;
    });
    if (overlap) {
      throw new ConflictException('Ese horario ya está reservado');
    }

    // Calculate price
    const precio = dto.tipo === 'INDIVIDUAL'
      ? (instructor.precioIndividual || 0)
      : (instructor.precioGrupal || 0);

    const reserva = await this.prisma.reservaInstructor.create({
      data: {
        instructorId,
        solicitanteId: userId,
        tipo: dto.tipo,
        fecha: fechaDate,
        horaInicio: dto.horaInicio,
        horaFin,
        duracionMinutos: duracion,
        precio,
        mensaje: dto.mensaje || null,
      },
      include: {
        instructor: { include: { user: { select: { nombre: true, apellido: true } } } },
      },
    });

    this.logger.log(`Reserva creada: ${reserva.id} por usuario ${userId} con instructor ${instructorId}`);
    return reserva;
  }

  async obtenerMisReservasComoAlumno(userId: string, estado?: string) {
    const where: any = { solicitanteId: userId };
    if (estado) where.estado = estado;

    return this.prisma.reservaInstructor.findMany({
      where,
      include: {
        instructor: {
          include: {
            user: { select: { id: true, nombre: true, apellido: true, fotoUrl: true } },
          },
        },
      },
      orderBy: [{ fecha: 'desc' }, { horaInicio: 'asc' }],
    });
  }

  async cancelarMiReserva(reservaId: string, userId: string) {
    const reserva = await this.prisma.reservaInstructor.findUnique({ where: { id: reservaId } });
    if (!reserva || reserva.solicitanteId !== userId) {
      throw new NotFoundException('Reserva no encontrada');
    }
    if (reserva.estado !== 'PENDIENTE' && reserva.estado !== 'CONFIRMADA') {
      throw new BadRequestException('Solo se pueden cancelar reservas pendientes o confirmadas');
    }

    return this.prisma.reservaInstructor.update({
      where: { id: reservaId },
      data: { estado: 'CANCELADA' },
    });
  }

  // ── Reservas — lado instructor ──────────────────────

  async obtenerMisReservasComoInstructor(userId: string, estado?: string) {
    const instructor = await this.prisma.instructor.findUnique({ where: { userId } });
    if (!instructor) throw new NotFoundException('No sos instructor');

    const where: any = { instructorId: instructor.id };
    if (estado) where.estado = estado;

    return this.prisma.reservaInstructor.findMany({
      where,
      include: {
        solicitante: {
          select: { id: true, nombre: true, apellido: true, email: true, telefono: true, fotoUrl: true },
        },
      },
      orderBy: [{ fecha: 'desc' }, { horaInicio: 'asc' }],
    });
  }

  async confirmarReserva(reservaId: string, userId: string) {
    const instructor = await this.prisma.instructor.findUnique({ where: { userId } });
    if (!instructor) throw new NotFoundException('No sos instructor');

    const reserva = await this.prisma.reservaInstructor.findUnique({ where: { id: reservaId } });
    if (!reserva || reserva.instructorId !== instructor.id) {
      throw new NotFoundException('Reserva no encontrada');
    }
    if (reserva.estado !== 'PENDIENTE') {
      throw new BadRequestException('Solo se pueden confirmar reservas pendientes');
    }

    return this.prisma.reservaInstructor.update({
      where: { id: reservaId },
      data: { estado: 'CONFIRMADA' },
    });
  }

  async rechazarReserva(reservaId: string, userId: string, dto: RechazarReservaDto) {
    const instructor = await this.prisma.instructor.findUnique({ where: { userId } });
    if (!instructor) throw new NotFoundException('No sos instructor');

    const reserva = await this.prisma.reservaInstructor.findUnique({ where: { id: reservaId } });
    if (!reserva || reserva.instructorId !== instructor.id) {
      throw new NotFoundException('Reserva no encontrada');
    }
    if (reserva.estado !== 'PENDIENTE') {
      throw new BadRequestException('Solo se pueden rechazar reservas pendientes');
    }

    return this.prisma.reservaInstructor.update({
      where: { id: reservaId },
      data: { estado: 'RECHAZADA', respuesta: dto.motivo || null },
    });
  }

  async completarReserva(reservaId: string, userId: string) {
    const instructor = await this.prisma.instructor.findUnique({ where: { userId } });
    if (!instructor) throw new NotFoundException('No sos instructor');

    const reserva = await this.prisma.reservaInstructor.findUnique({ where: { id: reservaId } });
    if (!reserva || reserva.instructorId !== instructor.id) {
      throw new NotFoundException('Reserva no encontrada');
    }
    if (reserva.estado !== 'CONFIRMADA') {
      throw new BadRequestException('Solo se pueden completar reservas confirmadas');
    }

    return this.prisma.reservaInstructor.update({
      where: { id: reservaId },
      data: { estado: 'COMPLETADA' },
    });
  }

  // ── Agenda: reservas de la semana (instructor) ──────

  async obtenerAgendaSemana(userId: string, fechaInicioSemana: string) {
    const instructor = await this.prisma.instructor.findUnique({ where: { userId } });
    if (!instructor) throw new NotFoundException('No sos instructor');

    const start = new Date(fechaInicioSemana + 'T00:00:00');
    const end = new Date(start);
    end.setDate(end.getDate() + 7);

    const [reservas, bloqueos, disponibilidades] = await Promise.all([
      this.prisma.reservaInstructor.findMany({
        where: {
          instructorId: instructor.id,
          fecha: { gte: start, lt: end },
          estado: { in: ['PENDIENTE', 'CONFIRMADA'] },
        },
        include: {
          solicitante: { select: { id: true, nombre: true, apellido: true, fotoUrl: true } },
        },
        orderBy: [{ fecha: 'asc' }, { horaInicio: 'asc' }],
      }),
      this.prisma.instructorBloqueo.findMany({
        where: {
          instructorId: instructor.id,
          OR: [
            { fechaInicio: { gte: start, lt: end } },
            { fechaFin: { gte: start, lt: end } },
            { fechaInicio: { lte: start }, fechaFin: { gte: end } },
          ],
        },
      }),
      this.prisma.instructorDisponibilidad.findMany({
        where: { instructorId: instructor.id, activo: true },
        orderBy: [{ diaSemana: 'asc' }, { horaInicio: 'asc' }],
      }),
    ]);

    return { reservas, bloqueos, disponibilidades, fechaInicio: fechaInicioSemana };
  }

  // ── Time helpers ────────────────────────────────────

  private parseHoraToMinutes(hora: string): number {
    const [h, m] = hora.split(':').map(Number);
    return h * 60 + m;
  }

  private minutesToHora(totalMinutos: number): string {
    const h = Math.floor(totalMinutos / 60);
    const m = totalMinutos % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  }

  // ── Público ────────────────────────────────────────────

  async buscarInstructores(filters: {
    ciudad?: string;
    especialidad?: string;
    page?: number;
    limit?: number;
  }) {
    const { ciudad, especialidad, page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;

    const where: any = {
      estado: 'APROBADO',
    };

    if (ciudad) {
      where.OR = [
        { user: { ciudad: { contains: ciudad, mode: 'insensitive' } } },
        { ubicaciones: { some: { ciudad: { contains: ciudad, mode: 'insensitive' }, activa: true } } },
      ];
    }

    if (especialidad) {
      where.especialidades = { contains: especialidad, mode: 'insensitive' };
    }

    const [instructores, total] = await Promise.all([
      this.prisma.instructor.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              nombre: true,
              apellido: true,
              ciudad: true,
              fotoUrl: true,
            },
          },
          ubicaciones: {
            where: { activa: true },
            include: {
              sede: { select: { id: true, nombre: true, ciudad: true } },
            },
          },
        },
        orderBy: [{ verificado: 'desc' }, { createdAt: 'asc' }],
        skip,
        take: limit,
      }),
      this.prisma.instructor.count({ where }),
    ]);

    return { instructores, total, page, limit };
  }

  async obtenerInstructorPublico(instructorId: string) {
    const instructor = await this.prisma.instructor.findUnique({
      where: { id: instructorId },
      include: {
        user: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            ciudad: true,
            fotoUrl: true,
          },
        },
        ubicaciones: {
          where: { activa: true },
          include: {
            sede: { select: { id: true, nombre: true, ciudad: true } },
          },
          orderBy: { esPrincipal: 'desc' },
        },
      },
    });

    if (!instructor || instructor.estado !== 'APROBADO') {
      throw new NotFoundException('Instructor no encontrado');
    }

    return instructor;
  }
}
