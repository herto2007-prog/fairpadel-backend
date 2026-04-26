import { Injectable } from '@nestjs/common';
import { EmailService } from '../../email/email.service';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class NotificacionesService {
  constructor(
    private emailService: EmailService,
    private prisma: PrismaService,
  ) {}

  /**
   * Notifica al jugador 2 que fue invitado a jugar
   */
  async notificarInvitacionJugador(inscripcionId: string, nombreJugador2?: string): Promise<void> {
    try {
      const inscripcion = await this.prisma.inscripcion.findUnique({
        where: { id: inscripcionId },
        include: {
          tournament: true,
          category: true,
          jugador1: {
            select: { nombre: true, apellido: true },
          },
        },
      });

      if (!inscripcion || !inscripcion.jugador2Email) return;

      await this.emailService.sendInvitacionJugador(
        inscripcion.jugador2Email,
        nombreJugador2 || 'Jugador',
        `${inscripcion.jugador1.nombre} ${inscripcion.jugador1.apellido}`,
        inscripcion.tournament.nombre,
      );
    } catch (error) {
      console.error(`[Notificaciones] Error al enviar invitación:`, error);
    }
  }

  /**
   * Notifica a ambos jugadores que la inscripción fue confirmada
   */
  async notificarInscripcionConfirmada(inscripcionId: string): Promise<void> {
    try {
      const inscripcion = await this.prisma.inscripcion.findUnique({
        where: { id: inscripcionId },
        include: {
          tournament: true,
          category: true,
          jugador1: {
            select: { nombre: true, apellido: true, email: true },
          },
          jugador2: {
            select: { nombre: true, apellido: true, email: true },
          },
        },
      });

      if (!inscripcion) return;

      // FIX: fechaInicio es String YYYY-MM-DD, formatear manualmente
      const fechaSorteo = inscripcion.tournament.fechaInicio 
        ? inscripcion.tournament.fechaInicio.split('-').reverse().join('/') 
        : 'Próximamente';
      const categoriaNombre = inscripcion.category?.nombre || 'Categoría no especificada';

      // Notificar a jugador 1
      if (inscripcion.jugador1.email) {
        await this.emailService.sendInscripcionConfirmada(
          inscripcion.jugador1.email,
          `${inscripcion.jugador1.nombre} ${inscripcion.jugador1.apellido}`,
          inscripcion.tournament.nombre,
          categoriaNombre,
          fechaSorteo,
        );
      }

      // Notificar a jugador 2 (si tiene email)
      const jugador2Email = inscripcion.jugador2?.email || inscripcion.jugador2Email;
      const jugador2Nombre = inscripcion.jugador2 
        ? `${inscripcion.jugador2.nombre} ${inscripcion.jugador2.apellido}`
        : 'Jugador';

      if (jugador2Email) {
        await this.emailService.sendInscripcionConfirmada(
          jugador2Email,
          jugador2Nombre,
          inscripcion.tournament.nombre,
          categoriaNombre,
          fechaSorteo,
        );
      }
    } catch (error) {
      console.error(`[Notificaciones] Error al enviar confirmación:`, error);
    }
  }

  /**
   * Notifica a ambos jugadores que el partido fue programado
   */
  async notificarPartidoProgramado(matchId: string): Promise<void> {
    try {
      const partido = await this.prisma.match.findUnique({
        where: { id: matchId },
        include: {
          tournament: true,
          torneoCancha: {
            include: {
              sedeCancha: {
                include: { sede: true },
              },
            },
          },
          inscripcion1: {
            include: {
              jugador1: { select: { nombre: true, apellido: true, email: true } },
              jugador2: { select: { nombre: true, apellido: true } },
            },
          },
          inscripcion2: {
            include: {
              jugador1: { select: { nombre: true, apellido: true, email: true } },
              jugador2: { select: { nombre: true, apellido: true } },
            },
          },
        },
      });

      if (!partido || !partido.fechaProgramada || !partido.horaProgramada) return;

      // FIX: fechaProgramada es String YYYY-MM-DD, formatear manualmente
      const fecha = partido.fechaProgramada.split('-').reverse().join('/');
      const hora = partido.horaProgramada;
      const cancha = partido.torneoCancha?.sedeCancha?.nombre || 'Cancha por definir';
      const sede = partido.torneoCancha?.sedeCancha?.sede?.nombre || 'Sede por definir';

      // Notificar a pareja 1
      if (partido.inscripcion1) {
        const jugador1Email = partido.inscripcion1.jugador1?.email;
        const jugador1Nombre = `${partido.inscripcion1.jugador1?.nombre} ${partido.inscripcion1.jugador1?.apellido}`;
        const rival = partido.inscripcion2 
          ? `${partido.inscripcion2.jugador1?.nombre} ${partido.inscripcion2.jugador1?.apellido} / ${partido.inscripcion2.jugador2?.nombre} ${partido.inscripcion2.jugador2?.apellido}`
          : 'Por definir';

        if (jugador1Email) {
          await this.emailService.sendPartidoProgramado(
            jugador1Email,
            jugador1Nombre,
            partido.tournament.nombre,
            fecha,
            hora,
            cancha,
            sede,
            rival,
          );
        }
      }

      // Notificar a pareja 2
      if (partido.inscripcion2) {
        const jugador2Email = partido.inscripcion2.jugador1?.email;
        const jugador2Nombre = `${partido.inscripcion2.jugador1?.nombre} ${partido.inscripcion2.jugador1?.apellido}`;
        const rival = partido.inscripcion1
          ? `${partido.inscripcion1.jugador1?.nombre} ${partido.inscripcion1.jugador1?.apellido} / ${partido.inscripcion1.jugador2?.nombre} ${partido.inscripcion1.jugador2?.apellido}`
          : 'Por definir';

        if (jugador2Email) {
          await this.emailService.sendPartidoProgramado(
            jugador2Email,
            jugador2Nombre,
            partido.tournament.nombre,
            fecha,
            hora,
            cancha,
            sede,
            rival,
          );
        }
      }
    } catch (error) {
      console.error(`[Notificaciones] Error al enviar programación:`, error);
    }
  }
}
