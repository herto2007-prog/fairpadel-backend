import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTournamentDto } from './dto/create-tournament.dto';
import { UpdateTournamentDto } from './dto/update-tournament.dto';

@Injectable()
export class TournamentsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.tournament.findMany({
      where: { estado: 'PUBLICADO' },
      include: {
        organizador: {
          select: { id: true, nombre: true, apellido: true },
        },
        categorias: {
          include: { category: true },
        },
      },
      orderBy: { fechaInicio: 'asc' },
    });
  }

  async findOne(id: string) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id },
      include: {
        organizador: {
          select: { id: true, nombre: true, apellido: true },
        },
        categorias: {
          include: { category: true },
        },
        sedePrincipal: true,
        torneoSedes: {
          include: { sede: true },
        },
        torneoCanchas: {
          include: { sedeCancha: true },
        },
      },
    });

    if (!tournament) {
      throw new NotFoundException('Torneo no encontrado');
    }

    return tournament;
  }

  async findById(id: string) {
    return this.findOne(id);
  }

  async getCategories() {
    return this.prisma.category.findMany({
      orderBy: { orden: 'asc' },
    });
  }

  async findByOrganizador(organizadorId: string) {
    return this.prisma.tournament.findMany({
      where: { organizadorId },
      include: {
        categorias: {
          include: { category: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(organizadorId: string, dto: CreateTournamentDto) {
    const data: any = {
      nombre: dto.nombre,
      descripcion: dto.descripcion,
      fechaInicio: dto.fechaInicio,
      fechaFin: dto.fechaFin,
      fechaLimiteInscr: dto.fechaLimiteInscripcion,
      ciudad: dto.ciudad,
      costoInscripcion: dto.costoInscripcion,
      organizadorId,
      estado: 'BORRADOR',
      pais: dto.pais || 'Paraguay',
      region: dto.region || dto.ciudad,
      flyerUrl: dto.flyerUrl || '',
    };
    
    if (dto.sedeId) {
      data.sedeId = dto.sedeId;
    }
    
    return this.prisma.tournament.create({ data });
  }

  async update(id: string, userId: string, dto: UpdateTournamentDto) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id },
    });

    if (!tournament) {
      throw new NotFoundException('Torneo no encontrado');
    }

    if (tournament.organizadorId !== userId) {
      throw new ForbiddenException('No tienes permiso para editar este torneo');
    }

    return this.prisma.tournament.update({
      where: { id },
      data: dto,
    });
  }

  async publish(id: string, userId: string) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id },
    });

    if (!tournament) {
      throw new NotFoundException('Torneo no encontrado');
    }

    if (tournament.organizadorId !== userId) {
      throw new ForbiddenException('No tienes permiso para publicar este torneo');
    }

    return this.prisma.tournament.update({
      where: { id },
      data: { estado: 'PUBLICADO' },
    });
  }

  async remove(id: string, userId: string) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id },
    });

    if (!tournament) {
      throw new NotFoundException('Torneo no encontrado');
    }

    if (tournament.organizadorId !== userId) {
      throw new ForbiddenException('No tienes permiso para eliminar este torneo');
    }

    return this.prisma.tournament.delete({
      where: { id },
    });
  }
}
