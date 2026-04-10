import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WhatsAppMessagingService } from '../whatsapp/services/whatsapp-messaging.service';
import { normalizarTelefono } from '../../common/utils/phone.utils';

/**
 * Servicio para enviar notificaciones automáticas por WhatsApp
 * 
 * Integra reservas, torneos y otros eventos con las plantillas de WhatsApp
 * Solo envía si el usuario tiene consentimiento confirmado
 */
@Injectable()
export class NotificacionesWhatsAppService {
  private readonly logger = new Logger(NotificacionesWhatsAppService.name);

  constructor(
    private prisma: PrismaService,
    private messagingService: WhatsAppMessagingService,
  ) {}

  /**
   * Notificar confirmación de reserva
   * Plantilla: fairpadel_reserva_ok (2 variables: cancha, fecha)
   * Nota: Eliminadas sede y hora para cumplir ratio variable:texto Meta 2026
   */
  async notificarReservaConfirmada(reservaId: string): Promise<void> {
    try {
      const reserva = await this.prisma.reservaCancha.findUnique({
        where: { id: reservaId },
        include: {
          user: { select: { id: true, telefono: true, consentWhatsappStatus: true } },
          sedeCancha: { include: { sede: true } },
        },
      });

      if (!reserva || !reserva.user) return;
      if (!this.puedeEnviarWhatsApp(reserva.user)) return;

      const telefono = reserva.user.telefono;
      if (!telefono) return;

      // Formatear fecha
      const fechaFormateada = this.formatearFecha(reserva.fecha);

      await this.messagingService.sendTemplateMessage(
        telefono,
        'reserva_confirmada', // nombre interno en DB
        {
          '1': reserva.sedeCancha.nombre, // numero_cancha
          '2': fechaFormateada, // fecha
        },
        reserva.user.id,
        'RESERVA'
      );

      this.logger.log(`✅ Notificación de reserva enviada a ${reserva.user.id}`);
    } catch (error) {
      this.logger.error(`Error notificando reserva ${reservaId}:`, error);
    }
  }

  /**
   * Notificar recordatorio 24h antes
   * Plantilla: fairpadel_recordatorio_24h
   */
  async notificarRecordatorio24h(reservaId: string): Promise<void> {
    try {
      const reserva = await this.prisma.reservaCancha.findUnique({
        where: { id: reservaId },
        include: {
          user: { select: { id: true, telefono: true, consentWhatsappStatus: true } },
          sedeCancha: { include: { sede: true } },
        },
      });

      if (!reserva || !reserva.user) return;
      if (!this.puedeEnviarWhatsApp(reserva.user)) return;

      const telefono = reserva.user.telefono;
      if (!telefono) return;

      const horaFormateada = this.formatearHora(reserva.horaInicio);

      await this.messagingService.sendTemplateMessage(
        telefono,
        'recordatorio_24h', // nombre interno en DB
        {
          '1': reserva.sedeCancha.sede.nombre,
          '2': horaFormateada,
        },
        reserva.user.id,
        'RECORDATORIO'
      );

      this.logger.log(`✅ Recordatorio 24h enviado a ${reserva.user.id}`);
    } catch (error) {
      this.logger.error(`Error enviando recordatorio 24h ${reservaId}:`, error);
    }
  }

  /**
   * Notificar recordatorio 4h antes
   * Plantilla: fairpadel_recordatorio_4h
   */
  async notificarRecordatorio4h(reservaId: string): Promise<void> {
    try {
      const reserva = await this.prisma.reservaCancha.findUnique({
        where: { id: reservaId },
        include: {
          user: { select: { id: true, telefono: true, consentWhatsappStatus: true } },
          sedeCancha: { include: { sede: true } },
        },
      });

      if (!reserva || !reserva.user) return;
      if (!this.puedeEnviarWhatsApp(reserva.user)) return;

      const telefono = reserva.user.telefono;
      if (!telefono) return;

      const horaFormateada = this.formatearHora(reserva.horaInicio);

      await this.messagingService.sendTemplateMessage(
        telefono,
        'recordatorio_4h', // nombre interno en DB
        {
          '1': reserva.sedeCancha.sede.nombre,
          '2': horaFormateada,
        },
        reserva.user.id,
        'RECORDATORIO'
      )

      this.logger.log(`✅ Recordatorio 4h enviado a ${reserva.user.id}`);
    } catch (error) {
      this.logger.error(`Error enviando recordatorio 4h ${reservaId}:`, error);
    }
  }

  /**
   * Notificar inscripción a torneo
   * Plantilla: fairpadel_torneo_insc_ok
   */
  async notificarInscripcionTorneo(inscripcionId: string): Promise<void> {
    try {
      const inscripcion = await this.prisma.inscripcion.findUnique({
        where: { id: inscripcionId },
        include: {
          tournament: true,
          category: true,
        },
      });

      if (!inscripcion) return;

      // Notificar a jugador 1
      const user1 = await this.prisma.user.findUnique({
        where: { id: inscripcion.jugador1Id },
        select: { id: true, telefono: true, consentWhatsappStatus: true },
      });

      if (user1 && this.puedeEnviarWhatsApp(user1) && user1.telefono) {
        await this.messagingService.sendTemplateMessage(
          user1.telefono,
          'torneo_inscripcion_confirmada', // nombre interno en DB
          {
            '1': inscripcion.tournament.nombre,
            '2': inscripcion.category.nombre,
          },
          user1.id,
          'TORNEO'
        );
        this.logger.log(`✅ Notificación de inscripción enviada a jugador 1 (${user1.id})`);
      }

      // Notificar a jugador 2 (solo si está registrado y tiene consentimiento)
      if (inscripcion.jugador2Id) {
        const user2 = await this.prisma.user.findUnique({
          where: { id: inscripcion.jugador2Id },
          select: { id: true, telefono: true, consentWhatsappStatus: true },
        });

        if (user2 && this.puedeEnviarWhatsApp(user2) && user2.telefono) {
          await this.messagingService.sendTemplateMessage(
            user2.telefono,
            'torneo_inscripcion_confirmada', // nombre interno en DB
            {
              '1': inscripcion.tournament.nombre,
              '2': inscripcion.category.nombre,
            },
            user2.id,
            'TORNEO'
          );
          this.logger.log(`✅ Notificación de inscripción enviada a jugador 2 (${user2.id})`);
        }
      }
    } catch (error) {
      this.logger.error(`Error notificando inscripción ${inscripcionId}:`, error);
    }
  }

  /**
   * Notificar datos del partido (cuando se publica fixture)
   * Plantilla: fairpadel_torneo_fecha
   */
  async notificarDatosPartido(matchId: string): Promise<void> {
    try {
      const match = await this.prisma.match.findUnique({
        where: { id: matchId },
        include: {
          tournament: true,
          inscripcion1: true,
          inscripcion2: true,
        },
      });

      if (!match || !match.tournament) return;

      // Obtener IDs de inscripciones
      const inscripcionIds = [match.inscripcion1Id, match.inscripcion2Id].filter(Boolean) as string[];

      // Notificar a jugadores de ambas inscripciones
      for (const inscripcionId of inscripcionIds) {
        const inscripcion = await this.prisma.inscripcion.findUnique({
          where: { id: inscripcionId },
        });

        if (!inscripcion) continue;

        // Buscar usuario del jugador 1 (y jugador 2 si existe)
        const jugadoresIds = [inscripcion.jugador1Id, inscripcion.jugador2Id].filter(Boolean) as string[];

        for (const jugadorId of jugadoresIds) {
          const user = await this.prisma.user.findUnique({
            where: { id: jugadorId },
            select: { id: true, telefono: true, consentWhatsappStatus: true },
          });

          if (!user || !this.puedeEnviarWhatsApp(user)) continue;

          const telefono = user.telefono;
          if (!telefono) continue;

          const fechaFormateada = match.fechaProgramada ? this.formatearFecha(match.fechaProgramada) : 'Por definir';
          const horaFormateada = match.horaProgramada || 'Por definir';

          await this.messagingService.sendTemplateMessage(
            telefono,
            'torneo_fecha_partido', // nombre interno en DB
            {
              '1': fechaFormateada,
              '2': horaFormateada,
            },
            user.id,
            'TORNEO'
          );
        }
      }

      this.logger.log(`✅ Notificación de partido enviada para match ${matchId}`);
    } catch (error) {
      this.logger.error(`Error notificando partido ${matchId}:`, error);
    }
  }

  /**
   * Notificar pareja asignada en torneo
   * Plantilla: fairpadel_torneo_pareja
   */
  async notificarParejaAsignada(inscripcionId: string): Promise<void> {
    try {
      const inscripcion = await this.prisma.inscripcion.findUnique({
        where: { id: inscripcionId },
        include: {
          tournament: true,
          category: true,
        },
      });

      if (!inscripcion) return;

      // Notificar a ambos jugadores
      const jugadoresIds = [inscripcion.jugador1Id, inscripcion.jugador2Id].filter(Boolean) as string[];

      for (const jugadorId of jugadoresIds) {
        const user = await this.prisma.user.findUnique({
          where: { id: jugadorId },
          select: { id: true, telefono: true, consentWhatsappStatus: true },
        });

        if (!user || !this.puedeEnviarWhatsApp(user) || !user.telefono) continue;

        // Obtener nombre de la pareja (el otro jugador)
        const parejaId = jugadorId === inscripcion.jugador1Id ? inscripcion.jugador2Id : inscripcion.jugador1Id;
        let nombrePareja = 'Por definir';
        
        if (parejaId) {
          const pareja = await this.prisma.jugadorDemo.findUnique({
            where: { id: parejaId },
            select: { nombre: true, apellido: true },
          });
          if (pareja) {
            nombrePareja = `${pareja.nombre} ${pareja.apellido}`;
          }
        }

        await this.messagingService.sendTemplateMessage(
          user.telefono,
          'torneo_pareja_asignada',
          {
            '1': nombrePareja,
            '2': inscripcion.category.nombre,
          },
          user.id,
          'TORNEO'
        );
        this.logger.log(`✅ Notificación de pareja enviada a ${user.id}`);
      }
    } catch (error) {
      this.logger.error(`Error notificando pareja ${inscripcionId}:`, error);
    }
  }

  /**
   * Notificar rival asignado para un partido
   * Plantilla: fairpadel_torneo_rival
   */
  async notificarRivalAsignado(matchId: string): Promise<void> {
    try {
      const match = await this.prisma.match.findUnique({
        where: { id: matchId },
        include: {
          tournament: true,
          inscripcion1: true,
          inscripcion2: true,
        },
      });

      if (!match || !match.tournament) return;

      // Obtener nombres de rivales
      const getRivalName = async (inscripcionId: string | null) => {
        if (!inscripcionId) return 'Por definir';
        const insc = await this.prisma.inscripcion.findUnique({
          where: { id: inscripcionId },
          include: { jugador1: true },
        });
        return insc?.jugador1 ? `${insc.jugador1.nombre} ${insc.jugador1.apellido}` : 'Por definir';
      };

      const rival1Nombre = await getRivalName(match.inscripcion2Id);
      const rival2Nombre = await getRivalName(match.inscripcion1Id);

      // Notificar a ambas inscripciones
      const inscripciones = [
        { id: match.inscripcion1Id, rivalNombre: rival1Nombre },
        { id: match.inscripcion2Id, rivalNombre: rival2Nombre },
      ].filter(i => i.id) as { id: string; rivalNombre: string }[];

      for (const { id: inscripcionId, rivalNombre } of inscripciones) {
        const inscripcion = await this.prisma.inscripcion.findUnique({
          where: { id: inscripcionId },
        });
        if (!inscripcion) continue;

        const jugadoresIds = [inscripcion.jugador1Id, inscripcion.jugador2Id].filter(Boolean) as string[];

        for (const jugadorId of jugadoresIds) {
          const user = await this.prisma.user.findUnique({
            where: { id: jugadorId },
            select: { id: true, telefono: true, consentWhatsappStatus: true },
          });

          if (!user || !this.puedeEnviarWhatsApp(user) || !user.telefono) continue;

          await this.messagingService.sendTemplateMessage(
            user.telefono,
            'torneo_rival_asignado',
            {
              '1': rivalNombre,
              '2': match.tournament.nombre,
            },
            user.id,
            'TORNEO'
          );
          this.logger.log(`✅ Notificación de rival enviada a ${user.id}`);
        }
      }
    } catch (error) {
      this.logger.error(`Error notificando rival ${matchId}:`, error);
    }
  }

  /**
   * Verificar si se puede enviar WhatsApp al usuario
   */
  private puedeEnviarWhatsApp(user: { telefono?: string | null; consentWhatsappStatus?: string | null }): boolean {
    if (!user.telefono) return false;
    if (user.consentWhatsappStatus !== 'CONFIRMADO') return false;
    return true;
  }

  /**
   * Formatear fecha YYYY-MM-DD a formato legible
   */
  private formatearFecha(fecha: string | Date): string {
    const date = typeof fecha === 'string' ? new Date(fecha + 'T00:00:00') : fecha;
    return date.toLocaleDateString('es-PY', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  /**
   * Formatear hora (puede venir como string o Date)
   */
  private formatearHora(hora: string | Date): string {
    if (typeof hora === 'string') {
      // Si ya viene en formato HH:mm
      if (hora.includes(':')) return hora.substring(0, 5);
      return hora;
    }
    return hora.toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' });
  }
}
