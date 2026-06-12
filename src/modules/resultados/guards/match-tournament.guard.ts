import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

/**
 * Verifica que el usuario autenticado pueda gestionar el torneo al que
 * pertenece el partido (:matchId de la ruta).
 *
 * Permite: admin global, el organizador dueño del torneo y sus
 * coorganizadores. Cualquier otro organizador/ayudante -> 403.
 *
 * Esto cierra el agujero por el que cualquier organizador podía cargar o
 * editar resultados de torneos ajenos (los endpoints solo validaban el rol
 * global, no la propiedad del torneo).
 */
@Injectable()
export class MatchTournamentGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const user = req.user;

    if (!user) {
      throw new ForbiddenException('Usuario no autenticado');
    }

    // Admin global puede gestionar cualquier torneo.
    if (Array.isArray(user.roles) && user.roles.includes('admin')) {
      return true;
    }

    const userId = user.userId ?? user.id;
    const matchId = req.params?.matchId;

    // Sin matchId no hay alcance de torneo que verificar.
    if (!matchId) {
      return true;
    }

    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      select: {
        tournament: {
          select: {
            organizadorId: true,
            coorganizadores: { select: { userId: true } },
          },
        },
      },
    });

    if (!match) {
      throw new NotFoundException('Partido no encontrado');
    }

    const torneo = match.tournament;
    const esDueno = torneo.organizadorId === userId;
    const esCoorganizador = torneo.coorganizadores.some((c) => c.userId === userId);

    if (!esDueno && !esCoorganizador) {
      throw new ForbiddenException(
        'No tienes permiso para gestionar resultados de este torneo',
      );
    }

    return true;
  }
}
