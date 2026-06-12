import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Verifica que el usuario autenticado pueda gestionar el torneo sobre el que
 * opera la request. Permite: admin global, el organizador dueño del torneo y
 * sus coorganizadores. Cualquier otro usuario -> 403.
 *
 * Resuelve el torneo desde (en orden):
 *  - params.tournamentId
 *  - params.id            (rutas tipo torneos/:id/... — aplicar solo en
 *                          controllers donde :id ES un torneo)
 *  - body.tournamentId
 *  - params.matchId / params.partidoId  (busca el partido y usa su torneo)
 *  - params.diaId         (busca el día de disponibilidad y usa su torneo)
 *  - params.tournamentCategoryId        (categoría del torneo -> torneo)
 *  - params.fixtureVersionId            (versión de fixture -> torneo)
 *
 * Si no puede resolver un torneo, NIEGA el acceso (fail-closed): toda ruta
 * protegida por este guard debe tener el torneo identificable.
 */
@Injectable()
export class TorneoGestionGuard implements CanActivate {
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
    const tournamentId = await this.resolverTournamentId(req);

    if (!tournamentId) {
      throw new ForbiddenException('No se pudo determinar el torneo de la operación');
    }

    const torneo = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: {
        organizadorId: true,
        coorganizadores: { select: { userId: true } },
      },
    });

    if (!torneo) {
      throw new NotFoundException('Torneo no encontrado');
    }

    const esDueno = torneo.organizadorId === userId;
    const esCoorganizador = torneo.coorganizadores.some((c) => c.userId === userId);

    if (!esDueno && !esCoorganizador) {
      throw new ForbiddenException('No tienes permiso para gestionar este torneo');
    }

    return true;
  }

  private async resolverTournamentId(req: any): Promise<string | null> {
    const params = req.params ?? {};
    const body = req.body ?? {};

    if (params.tournamentId) return params.tournamentId;
    if (params.id) return params.id;
    if (body.tournamentId) return body.tournamentId;

    const matchId = params.matchId ?? params.partidoId;
    if (matchId) {
      const match = await this.prisma.match.findUnique({
        where: { id: matchId },
        select: { tournamentId: true },
      });
      if (!match) {
        throw new NotFoundException('Partido no encontrado');
      }
      return match.tournamentId;
    }

    if (params.diaId) {
      const dia = await this.prisma.torneoDisponibilidadDia.findUnique({
        where: { id: params.diaId },
        select: { tournamentId: true },
      });
      if (!dia) {
        throw new NotFoundException('Día de juego no encontrado');
      }
      return dia.tournamentId;
    }

    if (params.tournamentCategoryId) {
      const categoria = await this.prisma.tournamentCategory.findUnique({
        where: { id: params.tournamentCategoryId },
        select: { tournamentId: true },
      });
      if (!categoria) {
        throw new NotFoundException('Categoría no encontrada');
      }
      return categoria.tournamentId;
    }

    if (params.fixtureVersionId) {
      const fixture = await this.prisma.fixtureVersion.findUnique({
        where: { id: params.fixtureVersionId },
        select: { tournamentId: true },
      });
      if (!fixture) {
        throw new NotFoundException('Fixture no encontrado');
      }
      return fixture.tournamentId;
    }

    return null;
  }
}
