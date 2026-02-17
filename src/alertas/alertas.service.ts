import {
  Injectable,
  Logger,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { CreateAlertaDto } from './dto/create-alerta.dto';
import { UpdateAlertaDto } from './dto/update-alerta.dto';
import { TipoAlertaPersonalizada } from '@prisma/client';

@Injectable()
export class AlertasService {
  private readonly logger = new Logger(AlertasService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificacionesService: NotificacionesService,
  ) {}

  // ═══════════════════════════════════════
  // CRUD
  // ═══════════════════════════════════════

  async getMisAlertas(userId: string) {
    this.verificarPremium(userId);

    return this.prisma.alertaPersonalizada.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async crearAlerta(userId: string, dto: CreateAlertaDto) {
    await this.verificarPremium(userId);

    return this.prisma.alertaPersonalizada.upsert({
      where: {
        userId_tipo: {
          userId,
          tipo: dto.tipo,
        },
      },
      update: {
        activa: dto.activa ?? true,
        config: dto.config ?? undefined,
      },
      create: {
        userId,
        tipo: dto.tipo,
        activa: dto.activa ?? true,
        config: dto.config ?? undefined,
      },
    });
  }

  async actualizarAlerta(userId: string, alertaId: string, dto: UpdateAlertaDto) {
    await this.verificarPremium(userId);

    const alerta = await this.prisma.alertaPersonalizada.findUnique({
      where: { id: alertaId },
    });

    if (!alerta || alerta.userId !== userId) {
      throw new NotFoundException('Alerta no encontrada');
    }

    return this.prisma.alertaPersonalizada.update({
      where: { id: alertaId },
      data: {
        activa: dto.activa ?? alerta.activa,
        config: dto.config ?? alerta.config,
      },
    });
  }

  async eliminarAlerta(userId: string, alertaId: string) {
    await this.verificarPremium(userId);

    const alerta = await this.prisma.alertaPersonalizada.findUnique({
      where: { id: alertaId },
    });

    if (!alerta || alerta.userId !== userId) {
      throw new NotFoundException('Alerta no encontrada');
    }

    return this.prisma.alertaPersonalizada.delete({
      where: { id: alertaId },
    });
  }

  // ═══════════════════════════════════════
  // TRIGGERS (called from other services)
  // ═══════════════════════════════════════

  /**
   * When a tournament is published, notify premium users who have
   * TORNEO_EN_MI_CIUDAD or TORNEO_MI_CATEGORIA alerts active.
   */
  async notificarTorneoPublicado(
    tournamentId: string,
    torneoNombre: string,
    torneoCiudad: string,
    categoriaIds: string[],
  ) {
    try {
      // TORNEO_EN_MI_CIUDAD alerts
      const alertasCiudad = await this.prisma.alertaPersonalizada.findMany({
        where: {
          tipo: TipoAlertaPersonalizada.TORNEO_EN_MI_CIUDAD,
          activa: true,
          user: {
            esPremium: true,
            estado: 'ACTIVO',
            ciudad: torneoCiudad,
          },
        },
        select: { userId: true },
      });

      for (const alerta of alertasCiudad) {
        await this.notificacionesService.crearNotificacion(
          alerta.userId,
          'TORNEO',
          `Nuevo torneo en tu ciudad: "${torneoNombre}" en ${torneoCiudad}`,
          true, // email
          false,
        );
      }

      // TORNEO_MI_CATEGORIA alerts
      if (categoriaIds.length > 0) {
        const alertasCategoria = await this.prisma.alertaPersonalizada.findMany({
          where: {
            tipo: TipoAlertaPersonalizada.TORNEO_MI_CATEGORIA,
            activa: true,
            user: {
              esPremium: true,
              estado: 'ACTIVO',
              categoriaActualId: { in: categoriaIds },
            },
          },
          select: { userId: true },
        });

        for (const alerta of alertasCategoria) {
          await this.notificacionesService.crearNotificacion(
            alerta.userId,
            'TORNEO',
            `Nuevo torneo con tu categoría: "${torneoNombre}"`,
            true,
            false,
          );
        }
      }

      this.logger.log(
        `Alertas torneo publicado: ${alertasCiudad.length} ciudad, categorías procesadas`,
      );
    } catch (e) {
      this.logger.error(`Error notificando alertas torneo: ${e.message}`);
    }
  }

  /**
   * When ranking positions change, notify premium users with RANKING_CAMBIO alert.
   */
  async notificarCambioRanking(
    userId: string,
    posicionNueva: number,
    posicionAnterior: number,
  ) {
    try {
      const alerta = await this.prisma.alertaPersonalizada.findUnique({
        where: {
          userId_tipo: {
            userId,
            tipo: TipoAlertaPersonalizada.RANKING_CAMBIO,
          },
        },
      });

      if (!alerta || !alerta.activa) return;

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { esPremium: true },
      });

      if (!user?.esPremium) return;

      const diff = posicionAnterior - posicionNueva;
      const direction = diff > 0 ? 'subiste' : 'bajaste';
      const absChange = Math.abs(diff);

      await this.notificacionesService.crearNotificacion(
        userId,
        'RANKING',
        `Tu ranking cambió: ${direction} ${absChange} posición${absChange > 1 ? 'es' : ''} (#${posicionAnterior} → #${posicionNueva})`,
        true,
        false,
      );
    } catch (e) {
      this.logger.error(`Error notificando cambio ranking: ${e.message}`);
    }
  }

  // ═══════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════

  private async verificarPremium(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { esPremium: true },
    });

    if (!user?.esPremium) {
      throw new ForbiddenException(
        'Las alertas personalizadas requieren suscripción Premium',
      );
    }
  }
}
