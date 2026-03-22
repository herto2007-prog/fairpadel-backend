import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSolicitudInstructorDto } from './dto/create-solicitud.dto';
import { CreateReservaInstructorDto, ConfirmarReservaInstructorDto, CancelarReservaInstructorDto } from './dto/create-reserva-instructor.dto';
import { CreatePagoInstructorDto } from './dto/create-pago.dto';
import { ReservaEstado, SolicitudEstado, InstructorEstado } from '@prisma/client';

@Injectable()
export class InstructoresService {
  constructor(private prisma: PrismaService) {}

  // ============ SOLICITUDES ============

  async crearSolicitud(userId: string, createDto: CreateSolicitudInstructorDto) {
    // Verificar que no tenga solicitud pendiente
    const solicitudExistente = await this.prisma.solicitudInstructor.findFirst({
      where: { userId, estado: SolicitudEstado.PENDIENTE },
    });

    if (solicitudExistente) {
      throw new BadRequestException('Ya tienes una solicitud pendiente');
    }

    // Verificar que no sea instructor ya
    const instructorExistente = await this.prisma.instructor.findUnique({
      where: { userId },
    });

    if (instructorExistente) {
      throw new BadRequestException('Ya eres instructor');
    }

    return this.prisma.solicitudInstructor.create({
      data: { ...createDto, userId },
    });
  }

  async obtenerMisSolicitudes(userId: string) {
    return this.prisma.solicitudInstructor.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async obtenerSolicitudesPendientes() {
    return this.prisma.solicitudInstructor.findMany({
      where: { estado: SolicitudEstado.PENDIENTE },
      include: { user: { select: { id: true, nombre: true, apellido: true, email: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async aprobarSolicitud(solicitudId: string) {
    const solicitud = await this.prisma.solicitudInstructor.findUnique({
      where: { id: solicitudId },
    });

    if (!solicitud) {
      throw new NotFoundException('Solicitud no encontrada');
    }

    if (solicitud.estado !== SolicitudEstado.PENDIENTE) {
      throw new BadRequestException('La solicitud no está pendiente');
    }

    // Aprobar solicitud y crear instructor en transacción
    return this.prisma.$transaction(async (tx) => {
      await tx.solicitudInstructor.update({
        where: { id: solicitudId },
        data: { estado: SolicitudEstado.APROBADA },
      });

      const instructor = await tx.instructor.create({
        data: {
          userId: solicitud.userId,
          experienciaAnios: solicitud.experienciaAnios,
          certificaciones: solicitud.certificaciones,
          especialidades: solicitud.especialidades,
          nivelesEnsenanza: solicitud.nivelesEnsenanza,
          descripcion: solicitud.descripcion,
          precioIndividual: solicitud.precioIndividual,
          precioGrupal: solicitud.precioGrupal,
        },
      });

      // Asignar rol de instructor al usuario
      const rolInstructor = await tx.role.findUnique({
        where: { nombre: 'instructor' },
      });

      if (rolInstructor) {
        await tx.userRole.create({
          data: {
            userId: solicitud.userId,
            roleId: rolInstructor.id,
          },
        });
      }

      return instructor;
    });
  }

  async rechazarSolicitud(solicitudId: string, motivo?: string) {
    const solicitud = await this.prisma.solicitudInstructor.findUnique({
      where: { id: solicitudId },
    });

    if (!solicitud) {
      throw new NotFoundException('Solicitud no encontrada');
    }

    return this.prisma.solicitudInstructor.update({
      where: { id: solicitudId },
      data: { 
        estado: SolicitudEstado.RECHAZADA,
        motivo,
      },
    });
  }

  // ============ INSTRUCTORES PÚBLICOS ============

  async obtenerInstructores(ciudad?: string) {
    const where: any = { estado: InstructorEstado.APROBADO };
    
    if (ciudad) {
      where.ubicaciones = {
        some: { ciudad, activa: true },
      };
    }

    return this.prisma.instructor.findMany({
      where,
      include: {
        user: {
          select: { id: true, nombre: true, apellido: true, fotoUrl: true },
        },
        ubicaciones: {
          where: { activa: true },
          include: { sede: true },
        },
        disponibilidades: {
          where: { activo: true },
        },
        _count: {
          select: { reservas: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async obtenerInstructor(instructorId: string) {
    const instructor = await this.prisma.instructor.findUnique({
      where: { id: instructorId },
      include: {
        user: {
          select: { id: true, nombre: true, apellido: true, fotoUrl: true, telefono: true },
        },
        ubicaciones: {
          where: { activa: true },
          include: { sede: true },
        },
        disponibilidades: {
          where: { activo: true },
        },
        _count: {
          select: { reservas: true },
        },
      },
    });

    if (!instructor) {
      throw new NotFoundException('Instructor no encontrado');
    }

    return instructor;
  }

  // ============ PERFIL INSTRUCTOR ============

  async obtenerMiPerfil(userId: string) {
    const instructor = await this.prisma.instructor.findUnique({
      where: { userId },
      include: {
        ubicaciones: true,
        disponibilidades: true,
        reservas: {
          where: { estado: { in: [ReservaEstado.PENDIENTE, ReservaEstado.CONFIRMADA] } },
          include: { solicitante: { select: { id: true, nombre: true, apellido: true } } },
          orderBy: [{ fecha: 'asc' }, { horaInicio: 'asc' }],
        },
        pagos: {
          orderBy: { fecha: 'desc' },
          take: 10,
        },
      },
    });

    if (!instructor) {
      throw new NotFoundException('No eres instructor');
    }

    return instructor;
  }

  async actualizarPerfil(userId: string, data: Partial<any>) {
    const instructor = await this.prisma.instructor.findUnique({
      where: { userId },
    });

    if (!instructor) {
      throw new NotFoundException('No eres instructor');
    }

    return this.prisma.instructor.update({
      where: { userId },
      data,
    });
  }

  // ============ RESERVAS ============

  async crearReserva(solicitanteId: string, createDto: CreateReservaInstructorDto) {
    const instructor = await this.prisma.instructor.findUnique({
      where: { id: createDto.instructorId },
    });

    if (!instructor) {
      throw new NotFoundException('Instructor no encontrado');
    }

    // FIX: fecha es String YYYY-MM-DD
    const fecha = createDto.fecha;

    // Verificar disponibilidad (simplificado - se puede mejorar)
    const reservaConflicto = await this.prisma.reservaInstructor.findFirst({
      where: {
        instructorId: createDto.instructorId,
        fecha,
        estado: { in: [ReservaEstado.PENDIENTE, ReservaEstado.CONFIRMADA] },
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

    if (reservaConflicto) {
      throw new BadRequestException('El instructor no está disponible en ese horario');
    }

    return this.prisma.reservaInstructor.create({
      data: {
        ...createDto,
        fecha,
        solicitanteId,
        duracionMinutos: createDto.duracionMinutos || 60,
      },
      include: {
        instructor: {
          include: { user: { select: { nombre: true, apellido: true } } },
        },
      },
    });
  }

  async obtenerMisReservasComoAlumno(userId: string) {
    return this.prisma.reservaInstructor.findMany({
      where: { solicitanteId: userId },
      include: {
        instructor: {
          include: { user: { select: { nombre: true, apellido: true } } },
        },
      },
      orderBy: { fecha: 'desc' },
    });
  }

  async confirmarReserva(reservaId: string, instructorUserId: string, confirmarDto: ConfirmarReservaInstructorDto) {
    const instructor = await this.prisma.instructor.findUnique({
      where: { userId: instructorUserId },
    });

    if (!instructor) {
      throw new NotFoundException('No eres instructor');
    }

    const reserva = await this.prisma.reservaInstructor.findFirst({
      where: { id: reservaId, instructorId: instructor.id },
    });

    if (!reserva) {
      throw new NotFoundException('Reserva no encontrada');
    }

    return this.prisma.reservaInstructor.update({
      where: { id: reservaId },
      data: {
        estado: ReservaEstado.CONFIRMADA,
        respuesta: confirmarDto.respuesta,
      },
    });
  }

  async cancelarReserva(reservaId: string, instructorUserId: string, cancelarDto: CancelarReservaInstructorDto) {
    const instructor = await this.prisma.instructor.findUnique({
      where: { userId: instructorUserId },
    });

    if (!instructor) {
      throw new NotFoundException('No eres instructor');
    }

    const reserva = await this.prisma.reservaInstructor.findFirst({
      where: { id: reservaId, instructorId: instructor.id },
    });

    if (!reserva) {
      throw new NotFoundException('Reserva no encontrada');
    }

    return this.prisma.reservaInstructor.update({
      where: { id: reservaId },
      data: {
        estado: ReservaEstado.CANCELADA,
        respuesta: cancelarDto.motivo,
      },
    });
  }

  async completarReserva(reservaId: string, instructorUserId: string, asistio: boolean) {
    const instructor = await this.prisma.instructor.findUnique({
      where: { userId: instructorUserId },
    });

    if (!instructor) {
      throw new NotFoundException('No eres instructor');
    }

    const reserva = await this.prisma.reservaInstructor.findFirst({
      where: { id: reservaId, instructorId: instructor.id },
    });

    if (!reserva) {
      throw new NotFoundException('Reserva no encontrada');
    }

    return this.prisma.reservaInstructor.update({
      where: { id: reservaId },
      data: {
        estado: ReservaEstado.COMPLETADA,
        asistio,
      },
    });
  }

  // ============ PAGOS ============

  async registrarPago(instructorUserId: string, createDto: CreatePagoInstructorDto) {
    const instructor = await this.prisma.instructor.findUnique({
      where: { userId: instructorUserId },
    });

    if (!instructor) {
      throw new NotFoundException('No eres instructor');
    }

    // FIX: fecha es String YYYY-MM-DD
    return this.prisma.pagoInstructor.create({
      data: {
        ...createDto,
        fecha: createDto.fecha,
        instructorId: instructor.id,
      },
    });
  }

  async obtenerMisPagos(instructorUserId: string) {
    const instructor = await this.prisma.instructor.findUnique({
      where: { userId: instructorUserId },
    });

    if (!instructor) {
      throw new NotFoundException('No eres instructor');
    }

    return this.prisma.pagoInstructor.findMany({
      where: { instructorId: instructor.id },
      include: {
        alumno: { select: { nombre: true, apellido: true } },
        reserva: true,
      },
      orderBy: { fecha: 'desc' },
    });
  }
}
