import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Guard que verifica permisos por torneo para cargar resultados.
 * Permite acceso a:
 * 1. Admins (role 'admin')
 * 2. Organizador del torneo (tournament.organizadorId === user.id)
 * 3. Ayudantes/árbitros/mesa del torneo (TorneoAyudante por userId o documento)
 *
 * Obtiene el tournamentId a partir del match (params.id = matchId).
 */
@Injectable()
export class TournamentRoleGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) return false;

    // 1. Admin pasa siempre
    if (user.roles?.includes('admin')) return true;

    // Obtener tournamentId — puede venir del param directamente o vía matchId
    const matchId = request.params.id;
    let tournamentId = request.params.tournamentId;

    if (!tournamentId && matchId) {
      const match = await this.prisma.match.findUnique({
        where: { id: matchId },
        select: { tournamentId: true },
      });
      if (!match) return false;
      tournamentId = match.tournamentId;
    }

    if (!tournamentId) return false;

    // 2. Organizador del torneo
    if (user.roles?.includes('organizador')) {
      const tournament = await this.prisma.tournament.findUnique({
        where: { id: tournamentId },
        select: { organizadorId: true },
      });
      if (tournament?.organizadorId === user.id) return true;
    }

    // 3. Ayudante/árbitro/mesa del torneo (por userId o documento)
    const ayudante = await this.prisma.torneoAyudante.findFirst({
      where: {
        tournamentId,
        OR: [
          ...(user.id ? [{ userId: user.id }] : []),
          ...(user.documento ? [{ documento: user.documento }] : []),
        ],
      },
    });

    return !!ayudante;
  }
}
