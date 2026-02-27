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
