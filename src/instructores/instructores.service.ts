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
import {
  CrearReservaDto,
  RechazarReservaDto,
  CrearClaseManualDto,
  MarcarAsistenciaDto,
  MarcarPagoDto,
  GuardarNotasDto,
} from './dto/reserva.dto';
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

  async getHorariosSemana(instructorId: string, fechaInicio: string) {
    const instructor = await this.prisma.instructor.findUnique({ where: { id: instructorId } });
    if (!instructor || instructor.estado !== 'APROBADO') {
      throw new NotFoundException('Instructor no encontrado');
    }

    const startDate = new Date(fechaInicio + 'T00:00:00');
    const semana: { fecha: string; slots: { horaInicio: string; horaFin: string; disponible: boolean }[] }[] = [];

    // Fetch all data once for the week
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6);

    const [disponibilidades, bloqueos, reservas] = await Promise.all([
      this.prisma.instructorDisponibilidad.findMany({
        where: { instructorId, activo: true },
        orderBy: { horaInicio: 'asc' },
      }),
      this.prisma.instructorBloqueo.findMany({
        where: {
          instructorId,
          fechaInicio: { lte: endDate },
          fechaFin: { gte: startDate },
        },
      }),
      this.prisma.reservaInstructor.findMany({
        where: {
          instructorId,
          fecha: { gte: startDate, lte: endDate },
          estado: { in: ['CONFIRMADA', 'PENDIENTE'] },
        },
      }),
    ]);

    const duracion = 60;

    for (let d = 0; d < 7; d++) {
      const current = new Date(startDate);
      current.setDate(current.getDate() + d);
      const fechaStr = current.toISOString().split('T')[0];
      const diaSemana = current.getDay();

      // Check if blocked
      const isBloqueado = bloqueos.some(
        (b) => b.fechaInicio <= current && b.fechaFin >= current,
      );

      if (isBloqueado) {
        semana.push({ fecha: fechaStr, slots: [] });
        continue;
      }

      // Get disponibilidades for this weekday
      const dispDia = disponibilidades.filter((dd) => dd.diaSemana === diaSemana);
      if (dispDia.length === 0) {
        semana.push({ fecha: fechaStr, slots: [] });
        continue;
      }

      // Get reservas for this date
      const reservasDia = reservas.filter((r) => {
        const rFecha = r.fecha instanceof Date ? r.fecha : new Date(r.fecha);
        return rFecha.toISOString().split('T')[0] === fechaStr;
      });

      const daySlots: { horaInicio: string; horaFin: string; disponible: boolean }[] = [];

      for (const disp of dispDia) {
        const startMin = this.parseHoraToMinutes(disp.horaInicio);
        const endMin = this.parseHoraToMinutes(disp.horaFin);

        for (let m = startMin; m + duracion <= endMin; m += duracion) {
          const slotInicio = this.minutesToHora(m);
          const slotFin = this.minutesToHora(m + duracion);

          const ocupado = reservasDia.some((r) => {
            const rStart = this.parseHoraToMinutes(r.horaInicio);
            const rEnd = this.parseHoraToMinutes(r.horaFin);
            return m < rEnd && m + duracion > rStart;
          });

          daySlots.push({ horaInicio: slotInicio, horaFin: slotFin, disponible: !ocupado });
        }
      }

      semana.push({ fecha: fechaStr, slots: daySlots });
    }

    return { instructorId, fechaInicio, semana };
  }

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

  // ── Fase 3: Gestión de clases (instructor) ──────────

  async crearClaseManual(userId: string, dto: CrearClaseManualDto) {
    const instructor = await this.prisma.instructor.findUnique({ where: { userId } });
    if (!instructor) throw new NotFoundException('No sos instructor');

    // Validar: debe tener alumno registrado o externo
    if (!dto.solicitanteId && !dto.alumnoExternoNombre) {
      throw new BadRequestException('Debe indicar un alumno registrado o un nombre de alumno externo');
    }

    // Si hay solicitanteId, verificar que existe
    if (dto.solicitanteId) {
      const alumno = await this.prisma.user.findUnique({ where: { id: dto.solicitanteId } });
      if (!alumno) throw new NotFoundException('Alumno no encontrado');
    }

    const duracion = dto.duracionMinutos || 60;
    const inicioMin = this.parseHoraToMinutes(dto.horaInicio);
    const horaFin = this.minutesToHora(inicioMin + duracion);

    // Verificar colisiones con reservas existentes
    const fecha = new Date(dto.fecha + 'T00:00:00');
    const colision = await this.prisma.reservaInstructor.findFirst({
      where: {
        instructorId: instructor.id,
        fecha,
        estado: { in: ['PENDIENTE', 'CONFIRMADA'] },
      },
    });

    // Check time overlap among existing reservas
    if (colision) {
      const existentes = await this.prisma.reservaInstructor.findMany({
        where: {
          instructorId: instructor.id,
          fecha,
          estado: { in: ['PENDIENTE', 'CONFIRMADA'] },
        },
      });
      for (const ex of existentes) {
        const exInicio = this.parseHoraToMinutes(ex.horaInicio);
        const exFin = this.parseHoraToMinutes(ex.horaFin);
        if (inicioMin < exFin && (inicioMin + duracion) > exInicio) {
          throw new ConflictException(`El horario se superpone con una reserva existente (${ex.horaInicio}-${ex.horaFin})`);
        }
      }
    }

    // Determinar precio
    let precio = dto.precio;
    if (precio === undefined || precio === null) {
      precio = dto.tipo === 'INDIVIDUAL'
        ? (instructor.precioIndividual || 0)
        : (instructor.precioGrupal || 0);
    }

    return this.prisma.reservaInstructor.create({
      data: {
        instructorId: instructor.id,
        solicitanteId: dto.solicitanteId || null,
        alumnoExternoNombre: dto.alumnoExternoNombre || null,
        alumnoExternoTelefono: dto.alumnoExternoTelefono || null,
        tipo: dto.tipo,
        fecha,
        horaInicio: dto.horaInicio,
        horaFin,
        duracionMinutos: duracion,
        precio,
        estado: 'CONFIRMADA',
        creadoPorInstructor: true,
        notas: dto.notas || null,
      },
      include: {
        solicitante: { select: { id: true, nombre: true, apellido: true, fotoUrl: true } },
      },
    });
  }

  async marcarAsistencia(reservaId: string, userId: string, dto: MarcarAsistenciaDto) {
    const instructor = await this.prisma.instructor.findUnique({ where: { userId } });
    if (!instructor) throw new NotFoundException('No sos instructor');

    const reserva = await this.prisma.reservaInstructor.findUnique({ where: { id: reservaId } });
    if (!reserva || reserva.instructorId !== instructor.id) {
      throw new NotFoundException('Reserva no encontrada');
    }
    if (!['CONFIRMADA', 'COMPLETADA'].includes(reserva.estado)) {
      throw new BadRequestException('Solo se puede marcar asistencia en clases confirmadas o completadas');
    }

    return this.prisma.reservaInstructor.update({
      where: { id: reservaId },
      data: { asistio: dto.asistio },
    });
  }

  async marcarPago(reservaId: string, userId: string, dto: MarcarPagoDto) {
    const instructor = await this.prisma.instructor.findUnique({ where: { userId } });
    if (!instructor) throw new NotFoundException('No sos instructor');

    const reserva = await this.prisma.reservaInstructor.findUnique({ where: { id: reservaId } });
    if (!reserva || reserva.instructorId !== instructor.id) {
      throw new NotFoundException('Reserva no encontrada');
    }

    return this.prisma.reservaInstructor.update({
      where: { id: reservaId },
      data: {
        pagado: dto.pagado,
        metodoPago: dto.metodoPago || null,
      },
    });
  }

  async guardarNotas(reservaId: string, userId: string, dto: GuardarNotasDto) {
    const instructor = await this.prisma.instructor.findUnique({ where: { userId } });
    if (!instructor) throw new NotFoundException('No sos instructor');

    const reserva = await this.prisma.reservaInstructor.findUnique({ where: { id: reservaId } });
    if (!reserva || reserva.instructorId !== instructor.id) {
      throw new NotFoundException('Reserva no encontrada');
    }

    return this.prisma.reservaInstructor.update({
      where: { id: reservaId },
      data: { notas: dto.notas },
    });
  }

  async obtenerAlumnos(userId: string) {
    const instructor = await this.prisma.instructor.findUnique({ where: { userId } });
    if (!instructor) throw new NotFoundException('No sos instructor');

    const reservas = await this.prisma.reservaInstructor.findMany({
      where: {
        instructorId: instructor.id,
        estado: { notIn: ['CANCELADA', 'RECHAZADA'] },
      },
      include: {
        solicitante: { select: { id: true, nombre: true, apellido: true, fotoUrl: true, telefono: true } },
      },
      orderBy: { fecha: 'desc' },
    });

    // Agrupar por alumno
    const alumnosMap = new Map<string, {
      tipo: 'registrado' | 'externo';
      id?: string;
      nombre: string;
      apellido?: string;
      telefono?: string;
      fotoUrl?: string | null;
      totalClases: number;
      ultimaClase: string;
      deudaPendiente: number;
    }>();

    for (const r of reservas) {
      const key = r.solicitanteId
        ? `reg_${r.solicitanteId}`
        : `ext_${(r.alumnoExternoNombre || 'Sin nombre').toLowerCase()}_${r.alumnoExternoTelefono || ''}`;

      const existing = alumnosMap.get(key);
      if (existing) {
        existing.totalClases++;
        if (!r.pagado) existing.deudaPendiente += r.precio;
        // ultimaClase ya es la primera (ordenado desc)
      } else {
        alumnosMap.set(key, {
          tipo: r.solicitanteId ? 'registrado' : 'externo',
          id: r.solicitanteId || undefined,
          nombre: r.solicitante?.nombre || r.alumnoExternoNombre || 'Sin nombre',
          apellido: r.solicitante?.apellido || undefined,
          telefono: (r.solicitante as any)?.telefono || r.alumnoExternoTelefono || undefined,
          fotoUrl: r.solicitante?.fotoUrl || null,
          totalClases: 1,
          ultimaClase: r.fecha.toISOString().split('T')[0],
          deudaPendiente: r.pagado ? 0 : r.precio,
        });
      }
    }

    return Array.from(alumnosMap.values());
  }

  async obtenerHistorialAlumno(userId: string, alumnoId?: string, externoNombre?: string) {
    const instructor = await this.prisma.instructor.findUnique({ where: { userId } });
    if (!instructor) throw new NotFoundException('No sos instructor');

    const where: any = {
      instructorId: instructor.id,
      estado: { notIn: ['CANCELADA', 'RECHAZADA'] },
    };

    if (alumnoId) {
      where.solicitanteId = alumnoId;
    } else if (externoNombre) {
      where.alumnoExternoNombre = { contains: externoNombre, mode: 'insensitive' };
      where.solicitanteId = null;
    } else {
      throw new BadRequestException('Debe indicar alumnoId o externoNombre');
    }

    return this.prisma.reservaInstructor.findMany({
      where,
      include: {
        solicitante: { select: { id: true, nombre: true, apellido: true, fotoUrl: true } },
      },
      orderBy: { fecha: 'desc' },
    });
  }

  async obtenerFinanzas(userId: string, desde?: string, hasta?: string) {
    const instructor = await this.prisma.instructor.findUnique({ where: { userId } });
    if (!instructor) throw new NotFoundException('No sos instructor');

    // Default: mes actual
    const now = new Date();
    const desdeDate = desde
      ? new Date(desde + 'T00:00:00')
      : new Date(now.getFullYear(), now.getMonth(), 1);
    const hastaDate = hasta
      ? new Date(hasta + 'T23:59:59')
      : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const reservas = await this.prisma.reservaInstructor.findMany({
      where: {
        instructorId: instructor.id,
        fecha: { gte: desdeDate, lte: hastaDate },
      },
    });

    let totalCobrado = 0;
    let totalPendiente = 0;
    let clasesCompletadas = 0;
    let clasesCanceladas = 0;

    for (const r of reservas) {
      if (r.estado === 'COMPLETADA' || r.estado === 'CONFIRMADA') {
        if (r.pagado) {
          totalCobrado += r.precio;
        } else {
          totalPendiente += r.precio;
        }
      }
      if (r.estado === 'COMPLETADA') clasesCompletadas++;
      if (r.estado === 'CANCELADA') clasesCanceladas++;
    }

    return {
      totalCobrado,
      totalPendiente,
      clasesCompletadas,
      clasesCanceladas,
      periodo: {
        desde: desdeDate.toISOString().split('T')[0],
        hasta: hastaDate.toISOString().split('T')[0],
      },
    };
  }

  async obtenerFinanzasMensual(userId: string, anio: number, mes: number) {
    const instructor = await this.prisma.instructor.findUnique({ where: { userId } });
    if (!instructor) throw new NotFoundException('No sos instructor');

    const desdeDate = new Date(anio, mes - 1, 1);
    const hastaDate = new Date(anio, mes, 0, 23, 59, 59);

    const reservas = await this.prisma.reservaInstructor.findMany({
      where: {
        instructorId: instructor.id,
        fecha: { gte: desdeDate, lte: hastaDate },
        estado: { in: ['CONFIRMADA', 'COMPLETADA'] },
      },
      orderBy: { fecha: 'asc' },
    });

    // Agrupar por día
    const diasMap = new Map<string, { clases: number; cobrado: number; pendiente: number }>();

    for (const r of reservas) {
      const fechaKey = r.fecha.toISOString().split('T')[0];
      const existing = diasMap.get(fechaKey);
      if (existing) {
        existing.clases++;
        if (r.pagado) existing.cobrado += r.precio;
        else existing.pendiente += r.precio;
      } else {
        diasMap.set(fechaKey, {
          clases: 1,
          cobrado: r.pagado ? r.precio : 0,
          pendiente: r.pagado ? 0 : r.precio,
        });
      }
    }

    return Array.from(diasMap.entries())
      .map(([fecha, data]) => ({ fecha, ...data }))
      .sort((a, b) => a.fecha.localeCompare(b.fecha));
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

  // ── Probar Módulo ──────────────────────────────────────

  async probarModulo(userId: string) {
    // Check if user is already an instructor
    const existingInstructor = await this.prisma.instructor.findUnique({
      where: { userId },
    });
    if (existingInstructor) {
      throw new ConflictException('Ya sos instructor');
    }

    // Get user info
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { nombre: true, apellido: true, documento: true },
    });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Find all admin users
    const adminRole = await this.prisma.role.findUnique({ where: { nombre: 'admin' } });
    if (!adminRole) {
      throw new BadRequestException('Rol admin no configurado');
    }
    const adminUsers = await this.prisma.userRole.findMany({
      where: { roleId: adminRole.id },
      select: { userId: true },
    });

    // Create notification for each admin
    if (adminUsers.length > 0) {
      await this.prisma.notificacion.createMany({
        data: adminUsers.map((au) => ({
          userId: au.userId,
          tipo: 'SISTEMA',
          titulo: 'Solicitud: Probar Módulo Instructor',
          contenido: `El usuario ${user.nombre} ${user.apellido} (CI: ${user.documento}) quiere probar el módulo de instructor. Podés asignarle el rol desde Admin → Roles → Instructores.`,
          enlace: '/admin/roles',
        })),
      });
    }

    return { message: 'Solicitud enviada. Un administrador revisará tu pedido.' };
  }
}
