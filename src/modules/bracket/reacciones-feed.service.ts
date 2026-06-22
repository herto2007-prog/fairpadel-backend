import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PushService } from '../push/push.service';
import { parseFeedItemId, esReaccionable } from './reacciones-feed.util';

export interface ResumenReaccion {
  count: number;
  yaReaccione: boolean;
}

export interface Reaccionador {
  id: string;
  nombre: string;
  apellido: string;
  fotoUrl: string | null;
}

@Injectable()
export class ReaccionesFeedService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pushService: PushService,
  ) {}

  /** Agrega "me gusta" del usuario al ítem (idempotente). */
  async reaccionar(userId: string, feedItemId: string): Promise<ResumenReaccion> {
    if (!esReaccionable(feedItemId)) {
      throw new BadRequestException('Esta publicación no admite reacciones');
    }
    // Detectamos si es una reacción NUEVA para avisar al dueño una sola vez
    // (si reacciona, quita y vuelve a reaccionar, no spameamos).
    const existente = await this.prisma.reaccionFeed.findUnique({
      where: { feedItemId_userId: { feedItemId, userId } },
    });
    if (!existente) {
      await this.prisma.reaccionFeed.create({ data: { feedItemId, userId } });
      // El aviso no debe romper la reacción si algo falla.
      await this.notificarDuenos(feedItemId, userId).catch(() => undefined);
    }
    const count = await this.prisma.reaccionFeed.count({ where: { feedItemId } });
    return { count, yaReaccione: true };
  }

  /** Avisa (notificación in-app) a los dueños de la publicación que recibieron un "me gusta". */
  private async notificarDuenos(feedItemId: string, reactorId: string): Promise<void> {
    const duenos = await this.resolverDuenos(feedItemId);
    const destinatarios = duenos.filter((id) => id !== reactorId); // no avisarse a uno mismo
    if (destinatarios.length === 0) return;

    const reactor = await this.prisma.user.findUnique({
      where: { id: reactorId },
      select: { nombre: true, apellido: true },
    });
    const nombre = reactor ? `${reactor.nombre} ${reactor.apellido}`.trim() : 'Alguien';

    await this.prisma.notificacion.createMany({
      data: destinatarios.map((uid) => ({
        userId: uid,
        tipo: 'SOCIAL' as const,
        titulo: '¡Le gustó tu jugada!',
        contenido: `A ${nombre} le gustó tu publicación.`,
      })),
    });

    // Push (app cerrada). No bloquea ni rompe si falla.
    await Promise.all(
      destinatarios.map((uid) =>
        this.pushService.enviarAUsuario(uid, {
          title: '¡Le gustó tu jugada! 🎾',
          body: `A ${nombre} le gustó tu publicación.`,
          data: { tipo: 'SOCIAL' },
        }),
      ),
    );
  }

  /** Quita el "me gusta" del usuario. */
  async quitarReaccion(userId: string, feedItemId: string): Promise<ResumenReaccion> {
    await this.prisma.reaccionFeed.deleteMany({ where: { feedItemId, userId } });
    const count = await this.prisma.reaccionFeed.count({ where: { feedItemId } });
    return { count, yaReaccione: false };
  }

  /**
   * Resumen (contador + si el usuario ya reaccionó) para muchos ítems de una vez.
   * Devuelve un Map feedItemId -> { count, yaReaccione }.
   */
  async resumen(feedItemIds: string[], userId: string): Promise<Map<string, ResumenReaccion>> {
    const out = new Map<string, ResumenReaccion>();
    if (feedItemIds.length === 0) return out;

    const [conteos, mias] = await Promise.all([
      this.prisma.reaccionFeed.groupBy({
        by: ['feedItemId'],
        where: { feedItemId: { in: feedItemIds } },
        _count: { _all: true },
      }),
      this.prisma.reaccionFeed.findMany({
        where: { userId, feedItemId: { in: feedItemIds } },
        select: { feedItemId: true },
      }),
    ]);

    const countPorId = new Map(conteos.map((c) => [c.feedItemId, c._count._all]));
    const miasSet = new Set(mias.map((m) => m.feedItemId));

    for (const id of feedItemIds) {
      out.set(id, { count: countPorId.get(id) ?? 0, yaReaccione: miasSet.has(id) });
    }
    return out;
  }

  /**
   * Lista quién reaccionó a un ítem. PRIVADO: solo el dueño de la publicación
   * puede verlo (los demás solo ven el contador). El dueño se resuelve desde el
   * feedItemId (jugadores del partido ganado / de la inscripción).
   */
  async listarReaccionadores(feedItemId: string, requesterId: string): Promise<Reaccionador[]> {
    const duenos = await this.resolverDuenos(feedItemId);
    if (!duenos.includes(requesterId)) {
      throw new ForbiddenException('Solo el dueño de la publicación puede ver quiénes reaccionaron');
    }
    const reacciones = await this.prisma.reaccionFeed.findMany({
      where: { feedItemId },
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { id: true, nombre: true, apellido: true, fotoUrl: true } } },
    });
    return reacciones.map((r) => r.user);
  }

  /** Resuelve los userIds "dueños" de la publicación a partir del feedItemId. */
  async resolverDuenos(feedItemId: string): Promise<string[]> {
    const { origen, refId } = parseFeedItemId(feedItemId);
    if (origen === 'resultado') {
      const match = await this.prisma.match.findUnique({
        where: { id: refId },
        select: {
          inscripcionGanadora: { select: { jugador1Id: true, jugador2Id: true } },
        },
      });
      const g = match?.inscripcionGanadora;
      return [g?.jugador1Id, g?.jugador2Id].filter((x): x is string => !!x);
    }
    if (origen === 'inscripcion') {
      const insc = await this.prisma.inscripcion.findUnique({
        where: { id: refId },
        select: { jugador1Id: true, jugador2Id: true },
      });
      return [insc?.jugador1Id, insc?.jugador2Id].filter((x): x is string => !!x);
    }
    if (origen === 'publicacion') {
      const pub = await this.prisma.publicacionFeed.findUnique({
        where: { id: refId },
        select: { userId: true },
      });
      return pub ? [pub.userId] : [];
    }
    return [];
  }
}
