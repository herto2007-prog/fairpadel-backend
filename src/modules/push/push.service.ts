import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, any>;
}

@Injectable()
export class PushService {
  private readonly logger = new Logger('PushService');

  constructor(private readonly prisma: PrismaService) {}

  /** Registra/actualiza el token de push de un dispositivo del usuario. */
  async registrar(userId: string, token: string, platform?: string) {
    if (!token) return { ok: false };
    // El token es único: si ya existía (incluso de otro user), se reasigna.
    await this.prisma.pushToken.upsert({
      where: { token },
      create: { userId, token, platform },
      update: { userId, platform },
    });
    return { ok: true };
  }

  /** Quita un token (al cerrar sesión). */
  async eliminar(userId: string, token: string) {
    await this.prisma.pushToken.deleteMany({ where: { token, userId } });
    return { ok: true };
  }

  /**
   * Envía un push a todos los dispositivos de un usuario (app cerrada incluida).
   * No lanza: cualquier error se loguea. Poda tokens muertos (DeviceNotRegistered).
   */
  async enviarAUsuario(userId: string, payload: PushPayload): Promise<void> {
    try {
      const tokens = await this.prisma.pushToken.findMany({
        where: { userId },
        select: { token: true },
      });
      if (tokens.length === 0) return;

      const mensajes = tokens.map((t) => ({
        to: t.token,
        title: payload.title,
        body: payload.body,
        data: payload.data ?? {},
        sound: 'default',
        priority: 'high',
      }));

      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(mensajes),
      });
      const json: any = await res.json().catch(() => null);
      const tickets: any[] = json?.data ?? [];

      // Podar tokens que Expo reporta como no registrados.
      const muertos: string[] = [];
      tickets.forEach((tk, i) => {
        if (tk?.status === 'error' && tk?.details?.error === 'DeviceNotRegistered') {
          muertos.push(tokens[i].token);
        }
      });
      if (muertos.length) {
        await this.prisma.pushToken.deleteMany({ where: { token: { in: muertos } } });
      }
    } catch (e: any) {
      this.logger.error(`Push a ${userId} falló: ${e?.message}`);
    }
  }
}
