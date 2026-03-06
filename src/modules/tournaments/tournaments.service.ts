import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTournamentDto } from './dto/create-tournament.dto';
import { UpdateTournamentDto } from './dto/update-tournament.dto';
import { TournamentStatus } from '@prisma/client';

@Injectable()
export class TournamentsService {
  constructor(private prisma: PrismaService) {}

  async create(organizadorId: string, dto: CreateTournamentDto) {
    // Generate slug from nombre
    const slug = dto.nombre
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    const tournament = await this.prisma.tournament.create({
      data: {
        nombre: dto.nombre,
        descripcion: dto.descripcion,
        slug: `${slug}-${Date.now()}`,
        fechaInicio: new Date(dto.fechaInicio),
        fechaFin: new Date(dto.fechaFin),
        fechaLimiteInscr: new Date(dto.fechaLimiteInscr),
        ciudad: dto.ciudad,
        pais: dto.pais || 'Paraguay',
        costoInscripcion: dto.costoInscripcion ? parseFloat(dto.costoInscripcion) : 0,
        minutosPorPartido: dto.minutosPorPartido || 90,
        organizadorId,
        estado: TournamentStatus.BORRADOR,
      },
      include: {
        organizador: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            email: true,
          },
        },
      },
    });

    // Add categories if provided
    if (dto.categoryIds && dto.categoryIds.length > 0) {
      await this.prisma.tournamentCategory.createMany({
        data: dto.categoryIds.map((categoryId) => ({
          tournamentId: tournament.id,
          categoryId,
        })),
      });
    }

    return this.findOne(tournament.id);
  }

  async findAll() {
    return this.prisma.tournament.findMany({
      where: {
        estado: {
          in: [TournamentStatus.PUBLICADO, TournamentStatus.EN_CURSO, TournamentStatus.FINALIZADO],
        },
      },
      include: {
        organizador: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
          },
        },
        categories: {
          include: {
            category: true,
          },
        },
      },
      orderBy: {
        fechaInicio: 'desc',
      },
    });
  }

  async findMyTournaments(organizadorId: string) {
    return this.prisma.tournament.findMany({
      where: { organizadorId },
      include: {
        categories: {
          include: {
            category: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: string) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id },
      include: {
        organizador: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            email: true,
          },
        },
        categories: {
          include: {
            category: true,
          },
        },
      },
    });

    if (!tournament) {
      throw new NotFoundException('Torneo no encontrado');
    }

    return tournament;
  }

  async findBySlug(slug: string) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { slug },
      include: {
        organizador: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
          },
        },
        categories: {
          include: {
            category: true,
          },
        },
      },
    });

    if (!tournament) {
      throw new NotFoundException('Torneo no encontrado');
    }

    return tournament;
  }

  async update(id: string, organizadorId: string, dto: UpdateTournamentDto) {
    const tournament = await this.findOne(id);

    if (tournament.organizadorId !== organizadorId) {
      throw new ForbiddenException('No tienes permiso para editar este torneo');
    }

    return this.prisma.tournament.update({
      where: { id },
      data: {
        ...dto,
        fechaInicio: dto.fechaInicio ? new Date(dto.fechaInicio) : undefined,
        fechaFin: dto.fechaFin ? new Date(dto.fechaFin) : undefined,
        fechaLimiteInscr: dto.fechaLimiteInscr ? new Date(dto.fechaLimiteInscr) : undefined,
        costoInscripcion: dto.costoInscripcion ? parseFloat(dto.costoInscripcion) : undefined,
      },
      include: {
        organizador: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
          },
        },
        categories: {
          include: {
            category: true,
          },
        },
      },
    });
  }

  async publish(id: string, organizadorId: string) {
    const tournament = await this.findOne(id);

    if (tournament.organizadorId !== organizadorId) {
      throw new ForbiddenException('No tienes permiso para publicar este torneo');
    }

    return this.prisma.tournament.update({
      where: { id },
      data: { estado: TournamentStatus.PUBLICADO },
      include: {
        categories: {
          include: {
            category: true,
          },
        },
      },
    });
  }

  async remove(id: string, organizadorId: string) {
    const tournament = await this.findOne(id);

    if (tournament.organizadorId !== organizadorId) {
      throw new ForbiddenException('No tienes permiso para eliminar este torneo');
    }

    await this.prisma.tournament.delete({ where: { id } });
    return { message: 'Torneo eliminado correctamente' };
  }

  // Categories
  async getCategories() {
    return this.prisma.category.findMany({
      orderBy: [
        { tipo: 'asc' },
        { orden: 'asc' },
      ],
    });
  }
}
