import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../../email/email.service';
import { PushService } from '../push/push.service';
import { TipoAlertaPersonalizada } from '@prisma/client';
import { CreateAlertaDto } from './dto/create-alerta.dto';

/**
 * Alertas personalizadas del jugador. Hoy soporta "torneos en mi ciudad":
 * el usuario se suscribe a una ciudad y recibe un aviso (in-app) cuando se
 * publica un torneo en esa ciudad. El disparo (notificarNuevoTorneo) es
 * best-effort e idempotente para poder llamarse desde varios puntos de
 * publicación sin avisar dos veces.
 */
@Injectable()
export class AlertasService {
  private readonly logger = new Logger(AlertasService.name);

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    private configService: ConfigService,
    private pushService: PushService,
  ) {}

  /** Normaliza una ciudad para comparar: sin acentos, minúsculas, recortada. */
  private normalizarCiudad(ciudad: string): string {
    return (ciudad || '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '') // quita acentos/diacríticos
      .trim()
      .toLowerCase();
  }

  /**
   * Crea (o reactiva/actualiza) la alerta del usuario. El esquema tiene
   * UNIQUE(userId, tipo), así que hay una sola alerta por tipo y usuario.
   */
  async crearOActualizar(userId: string, dto: CreateAlertaDto) {
    let config: any = {};

    if (dto.tipo === TipoAlertaPersonalizada.TORNEO_EN_MI_CIUDAD) {
      const ciudad = (dto.ciudad || '').trim();
      if (!ciudad) {
        throw new BadRequestException(
          'La ciudad es obligatoria para una alerta de torneos en tu ciudad',
        );
      }
      config = { ciudad };
    }

    return this.prisma.alertaPersonalizada.upsert({
      where: { userId_tipo: { userId, tipo: dto.tipo } },
      create: { userId, tipo: dto.tipo, activa: true, config },
      update: { activa: true, config },
    });
  }

  async listarMisAlertas(userId: string) {
    return this.prisma.alertaPersonalizada.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async eliminar(userId: string, id: string) {
    const alerta = await this.prisma.alertaPersonalizada.findUnique({
      where: { id },
    });
    if (!alerta || alerta.userId !== userId) {
      throw new NotFoundException('Alerta no encontrada');
    }
    await this.prisma.alertaPersonalizada.delete({ where: { id } });
    return { success: true };
  }

  /**
   * Avisa a los usuarios suscritos a "torneos en mi ciudad" cuando un torneo
   * queda PUBLICADO en esa ciudad. Idempotente (deduplica por usuario+enlace)
   * y best-effort: nunca lanza, para no romper el flujo de publicación.
   */
  async notificarNuevoTorneo(torneoId: string): Promise<{ avisados: number }> {
    try {
      const torneo = await this.prisma.tournament.findUnique({
        where: { id: torneoId },
        select: {
          id: true,
          nombre: true,
          ciudad: true,
          slug: true,
          estado: true,
          organizadorId: true,
        },
      });

      if (!torneo || torneo.estado !== 'PUBLICADO' || !torneo.ciudad) {
        return { avisados: 0 };
      }

      const ciudadNorm = this.normalizarCiudad(torneo.ciudad);
      const enlace = torneo.slug ? `/t/${torneo.slug}` : '/torneos';

      // config es JSON → filtramos la ciudad en memoria (case-insensitive).
      const alertas = await this.prisma.alertaPersonalizada.findMany({
        where: { tipo: 'TORNEO_EN_MI_CIUDAD', activa: true },
        select: {
          userId: true,
          config: true,
          user: { select: { email: true, nombre: true } },
        },
      });

      const frontendUrl =
        this.configService.get<string>('FRONTEND_URL') || 'https://www.fairpadel.com';
      const urlTorneo = `${frontendUrl}${enlace}`;
      let avisados = 0;

      for (const alerta of alertas) {
        const ciudadAlerta = this.normalizarCiudad(
          ((alerta.config as any)?.ciudad || '').toString(),
        );
        if (!ciudadAlerta || ciudadAlerta !== ciudadNorm) continue;
        if (alerta.userId === torneo.organizadorId) continue; // no avisar al creador

        // Dedup: un aviso por torneo y usuario, aunque se llame desde varios puntos.
        const yaAvisado = await this.prisma.notificacion.findFirst({
          where: { userId: alerta.userId, enlace },
          select: { id: true },
        });
        if (yaAvisado) continue;

        await this.prisma.notificacion.create({
          data: {
            userId: alerta.userId,
            tipo: 'TORNEO',
            titulo: `Nuevo torneo en ${torneo.ciudad}`,
            contenido: `Se abrió "${torneo.nombre}" en ${torneo.ciudad}. ¡Mirá los detalles e inscribite!`,
            enlace,
          },
        });

        // Push (la notif in-app ya quedó creada arriba; acá solo el envío).
        await this.pushService.enviarAUsuario(alerta.userId, {
          title: `Nuevo torneo en ${torneo.ciudad} 🎾`,
          body: `Se abrió "${torneo.nombre}". ¡Mirá los detalles e inscribite!`,
          data: { tipo: 'TORNEO', enlace },
        });

        // Email best-effort: si falla, el aviso in-app ya quedó creado.
        if (alerta.user?.email) {
          try {
            await this.emailService.sendNuevoTorneoCiudad(
              alerta.user.email,
              alerta.user.nombre || 'jugador',
              torneo.nombre,
              torneo.ciudad,
              urlTorneo,
            );
          } catch (error) {
            this.logger.error(
              `Email de nuevo torneo falló para usuario ${alerta.userId}:`,
              error,
            );
          }
        }

        avisados++;
      }

      if (avisados > 0) {
        this.logger.log(
          `Alertas de ciudad: ${avisados} aviso(s) por torneo ${torneo.id} (${torneo.ciudad})`,
        );
      }
      return { avisados };
    } catch (error) {
      this.logger.error(
        `Error disparando alertas de ciudad para torneo ${torneoId}:`,
        error,
      );
      return { avisados: 0 };
    }
  }
}
