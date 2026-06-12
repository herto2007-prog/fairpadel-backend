import { Injectable, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TournamentsService } from '../tournaments/tournaments.service';

@Injectable()
export class AmericanoComunService {
  constructor(
    private prisma: PrismaService,
    private tournamentsService: TournamentsService,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════════════
  // PERMISOS
  // ═══════════════════════════════════════════════════════════════════════════════

  async verificarPermiso(torneoId: string, userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { roles: { include: { role: true } } },
    });
    const roles = user?.roles.map((ur) => ur.role.nombre) ?? [];
    const puede = await this.tournamentsService.puedeGestionarTorneo(torneoId, userId, roles);
    if (!puede) {
      throw new ForbiddenException('No tenés permisos para este torneo');
    }
  }

  async validarRateLimit(torneoId: string, segundos = 3) {
    const torneo = await this.prisma.tournament.findUnique({ where: { id: torneoId } });
    if (torneo?.ultimaAccionEn) {
      const diff = Date.now() - new Date(torneo.ultimaAccionEn).getTime();
      if (diff < segundos * 1000) {
        throw new BadRequestException('Acción demasiado rápida. Esperá unos segundos.');
      }
    }
    await this.prisma.tournament.update({
      where: { id: torneoId },
      data: { ultimaAccionEn: new Date() },
    });
  }
}
