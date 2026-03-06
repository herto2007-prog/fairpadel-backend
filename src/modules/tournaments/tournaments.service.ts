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
        fechaInicioInscripcion: dto.fechaInicioInscripcion ? new Date(dto.fechaInicioInscripcion) : null,
        fechaFinInscripcion: dto.fechaFinInscripcion ? new Date(dto.fechaFinInscripcion) : null,
        maxParejas: dto.maxParejas,
        minParejas: dto.minParejas,
        puntosRanking: dto.puntosRanking,
        premio: dto.premio,
        flyerUrl: dto.flyerUrl,
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
        _count: {
          select: {
            inscripciones: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findByOrganizador(organizadorId: string) {
    return this.prisma.tournament.findMany({
      where: { organizadorId },
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
        _count: {
          select: {
            inscripciones: true,
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
        inscripciones: {
          include: {
            jugador1: {
              select: {
                id: true,
                nombre: true,
                apellido: true,
              },
            },
            jugador2: {
              select: {
                id: true,
                nombre: true,
                apellido: true,
              },
            },
          },
        },
        _count: {
          select: {
            inscripciones: true,
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

    // Update tournament
    await this.prisma.tournament.update({
      where: { id },
      data: {
        nombre: dto.nombre,
        descripcion: dto.descripcion,
        fechaInicio: dto.fechaInicio ? new Date(dto.fechaInicio) : undefined,
        fechaFin: dto.fechaFin ? new Date(dto.fechaFin) : undefined,
        fechaInicioInscripcion: dto.fechaInicioInscripcion ? new Date(dto.fechaInicioInscripcion) : undefined,
        fechaFinInscripcion: dto.fechaFinInscripcion ? new Date(dto.fechaFinInscripcion) : undefined,
        maxParejas: dto.maxParejas,
        minParejas: dto.minParejas,
        puntosRanking: dto.puntosRanking,
        premio: dto.premio,
        flyerUrl: dto.flyerUrl,
      },
    });

    // Update categories if provided
    if (dto.categoryIds) {
      // Remove existing categories
      await this.prisma.tournamentCategory.deleteMany({
        where: { tournamentId: id },
      });

      // Add new categories
      if (dto.categoryIds.length > 0) {
        await this.prisma.tournamentCategory.createMany({
          data: dto.categoryIds.map((categoryId) => ({
            tournamentId: id,
            categoryId,
          })),
        });
      }
    }

    return this.findOne(id);
  }

  async publish(id: string, organizadorId: string) {
    const tournament = await this.findOne(id);

    if (tournament.organizadorId !== organizadorId) {
      throw new ForbiddenException('No tienes permiso para publicar este torneo');
    }

    if (tournament.estado !== TournamentStatus.BORRADOR) {
      throw new ForbiddenException('Solo se pueden publicar torneos en estado borrador');
    }

    return this.prisma.tournament.update({
      where: { id },
      data: { estado: TournamentStatus.PUBLICADO },
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
  }

  async remove(id: string, organizadorId: string) {
    const tournament = await this.findOne(id);

    if (tournament.organizadorId !== organizadorId) {
      throw new ForbiddenException('No tienes permiso para eliminar este torneo');
    }

    await this.prisma.tournament.delete({ where: { id } });

    return { message: 'Torneo eliminado correctamente' };
  }

  async getCategories() {
    return this.prisma.category.findMany({
      orderBy: {
        orden: 'asc',
      },
    });
  }
}
