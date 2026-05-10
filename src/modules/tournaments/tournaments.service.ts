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

  async getCategories(tipo?: string) {
    const where = tipo ? { tipoCategoria: tipo as any } : {};
    return this.prisma.category.findMany({
      where,
      orderBy: { orden: 'asc' },
    });
  }

  async findByOrganizador(organizadorId: string) {
    return this.prisma.tournament.findMany({
      where: {
        OR: [
          { organizadorId },
          { coorganizadores: { some: { userId: organizadorId } } },
        ],
      },
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
    
    // Configuración de finales
    if (dto.fechaFinales) {
      data.fechaFinales = dto.fechaFinales;
    }
    if (dto.canchasFinales) {
      data.canchasFinales = dto.canchasFinales;
    }
    if (dto.horaInicioFinales) {
      data.horaInicioFinales = dto.horaInicioFinales;
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

    const puede = await this.puedeGestionarTorneo(id, userId);
    if (!puede) {
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

    const puede = await this.puedeGestionarTorneo(id, userId);
    if (!puede) {
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

    const puede = await this.puedeGestionarTorneo(id, userId);
    if (!puede) {
      throw new ForbiddenException('No tienes permiso para eliminar este torneo');
    }

    return this.prisma.tournament.delete({
      where: { id },
    });
  }

  /**
   * Verifica si un usuario puede gestionar un torneo
   * (es organizador, co-organizador o admin)
   */
  async puedeGestionarTorneo(torneoId: string, userId: string, roles?: string[]): Promise<boolean> {
    let userRoles = roles;
    if (!userRoles) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { roles: { include: { role: true } } },
      });
      userRoles = user?.roles.map((ur) => ur.role.nombre) ?? [];
    }

    if (userRoles.includes('admin')) return true;

    const torneo = await this.prisma.tournament.findUnique({
      where: { id: torneoId },
      select: { organizadorId: true },
    });

    if (!torneo) return false;
    if (torneo.organizadorId === userId) return true;

    const coorganizador = await this.prisma.tournamentOrganizador.findUnique({
      where: {
        torneoId_userId: {
          torneoId,
          userId,
        },
      },
    });

    return !!coorganizador;
  }

  async listarCoorganizadores(torneoId: string) {
    return this.prisma.tournamentOrganizador.findMany({
      where: { torneoId },
      include: {
        user: {
          select: { id: true, nombre: true, apellido: true, email: true, fotoUrl: true },
        },
      },
    });
  }

  async agregarCoorganizador(torneoId: string, userId: string) {
    return this.prisma.tournamentOrganizador.create({
      data: { torneoId, userId },
      include: {
        user: {
          select: { id: true, nombre: true, apellido: true, email: true, fotoUrl: true },
        },
      },
    });
  }

  async removerCoorganizador(torneoId: string, userId: string) {
    return this.prisma.tournamentOrganizador.delete({
      where: {
        torneoId_userId: {
          torneoId,
          userId,
        },
      },
    });
  }
}
