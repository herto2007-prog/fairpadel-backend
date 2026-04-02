import { Controller, Post, Param, UseGuards, Get, Req, Query } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Request } from 'express';

@Controller('admin/torneos')
@UseGuards(JwtAuthGuard)
export class TournamentPublicationController {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  @Post(':id/publicar-bracket')
  async publicarBracket(
    @Param('id') tournamentId: string,
    @Req() req: Request,
    @Query('force') force?: string,
  ) {
    const user = (req as any).user;
    
    // Verificar que el usuario sea el organizador
    const torneo = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { 
        id: true, 
        organizadorId: true,
        nombre: true,
        bracketPublicado: true,
      },
    });

    if (!torneo) {
      return { success: false, message: 'Torneo no encontrado' };
    }

    if (torneo.organizadorId !== user.userId) {
      return { success: false, message: 'No tienes permiso para publicar este bracket' };
    }

    // TODO: Implementar auditoría real
    // Por ahora, solo publicamos si no hay force o si se fuerza
    if (force !== 'true') {
      // Aquí iría la auditoría
      // Por ahora permitimos publicar siempre
    }

    // Publicar el bracket
    await this.prisma.tournament.update({
      where: { id: tournamentId },
      data: { bracketPublicado: true },
    });

    return {
      success: true,
      message: 'Bracket publicado exitosamente',
      urlPublica: `/torneo/${tournamentId}/fixture`,
    };
  }

  @Post(':id/despublicar-bracket')
  async despublicarBracket(
    @Param('id') tournamentId: string,
    @Req() req: Request,
  ) {
    const user = (req as any).user;
    
    // Verificar que el usuario sea el organizador
    const torneo = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { 
        id: true, 
        organizadorId: true,
        nombre: true,
      },
    });

    if (!torneo) {
      return { success: false, message: 'Torneo no encontrado' };
    }

    if (torneo.organizadorId !== user.userId) {
      return { success: false, message: 'No tienes permiso para despublicar este bracket' };
    }

    // Despublicar el bracket
    await this.prisma.tournament.update({
      where: { id: tournamentId },
      data: { bracketPublicado: false },
    });

    return {
      success: true,
      message: 'Bracket despublicado exitosamente',
    };
  }

  @Get(':id/estado-publicacion')
  async getEstadoPublicacion(
    @Param('id') tournamentId: string,
    @Req() req: Request,
  ) {
    const user = (req as any).user;
    
    const torneo = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { 
        id: true, 
        nombre: true,
        bracketPublicado: true,
        organizadorId: true,
      },
    });

    if (!torneo) {
      return { success: false, message: 'Torneo no encontrado' };
    }

    // Solo el organizador puede ver el estado completo
    const esOrganizador = torneo.organizadorId === user.userId;

    if (!esOrganizador) {
      return {
        success: true,
        publicado: torneo.bracketPublicado,
      };
    }

    return {
      success: true,
      torneo: {
        id: torneo.id,
        nombre: torneo.nombre,
        bracketPublicado: torneo.bracketPublicado,
      },
      urlPublica: `/torneo/${tournamentId}/fixture`,
    };
  }
}
