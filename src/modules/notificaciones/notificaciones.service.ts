import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class NotificacionesService {
  constructor(private prisma: PrismaService) {}

  /**
   * Enviar invitación a jugador 2
   * Cuando un jugador inscribe a su compañero que no está registrado
   */
  async enviarInvitacionJugador(data: {
    inscripcionId: string;
    tournamentId: string;
    emailJugador: string;
    telefonoJugador?: string;
    nombreJugador1: string;
    nombreTorneo: string;
    linkRegistro: string;
  }) {
    const { inscripcionId, tournamentId, emailJugador, telefonoJugador, nombreJugador1, nombreTorneo, linkRegistro } = data;

    // Guardar registro de la invitación
    const invitacion = await this.prisma.invitacionJugador.create({
      data: {
        inscripcionId,
        email: emailJugador,
        token: this.generarToken(),
        expiraAt: new Date(Date.now() + 48 * 60 * 60 * 1000), // 48 horas
      },
    });

    // Preparar mensaje
    const mensajeSMS = this.generarMensajeSMS({
      nombreJugador1,
      nombreTorneo,
      linkRegistro: `${linkRegistro}?token=${invitacion.token}`,
    });

    const mensajeEmail = this.generarMensajeEmail({
      nombreJugador1,
      nombreTorneo,
      linkRegistro: `${linkRegistro}?token=${invitacion.token}`,
    });

    // Registrar notificaciones (envío real se implementa con Tigo/Email provider)
    const notificaciones = [];

    if (telefonoJugador) {
      const sms = await this.prisma.notificacionEnviada.create({
        data: {
          tournamentId,
          inscripcionId,
          tipo: 'SMS',
          destinatario: telefonoJugador,
          template: 'INVITACION_JUGADOR',
          contenido: mensajeSMS,
          estado: 'PENDIENTE', // Cambia a ENVIADO cuando el provider confirme
        },
      });
      notificaciones.push(sms);
    }

    const email = await this.prisma.notificacionEnviada.create({
      data: {
        tournamentId,
        inscripcionId,
        tipo: 'EMAIL',
        destinatario: emailJugador,
        template: 'INVITACION_JUGADOR',
        contenido: mensajeEmail,
        estado: 'PENDIENTE',
      },
    });
    notificaciones.push(email);

    return {
      success: true,
      invitacion,
      notificaciones,
      mensajePreview: {
        sms: mensajeSMS,
        email: mensajeEmail,
      },
    };
  }

  /**
   * Enviar recordatorio de checklist al organizador
   */
  async enviarRecordatorioChecklist(data: {
    tournamentId: string;
    itemId: string;
    telefonoOrganizador: string;
    emailOrganizador: string;
    tituloItem: string;
    nombreTorneo: string;
  }) {
    const { tournamentId, itemId, telefonoOrganizador, emailOrganizador, tituloItem, nombreTorneo } = data;

    const mensaje = `Recordatorio FairPadel: "${tituloItem}" para el torneo "${nombreTorneo}". Revisa tu checklist en la plataforma.`;

    // Marcar como enviado el recordatorio
    await this.prisma.checklistItem.update({
      where: { id: itemId },
      data: { recordatorioEnviado: true },
    });

    // Registrar notificación SMS
    const notificacion = await this.prisma.notificacionEnviada.create({
      data: {
        tournamentId,
        tipo: 'SMS',
        destinatario: telefonoOrganizador,
        template: 'RECORDATORIO_CHECKLIST',
        contenido: mensaje,
        estado: 'PENDIENTE',
      },
    });

    return {
      success: true,
      notificacion,
      mensajePreview: mensaje,
    };
  }

  /**
   * Obtener notificaciones pendientes de envío
   * Para procesar con Tigo/Email cron job
   */
  async getPendientes(tipo?: 'SMS' | 'EMAIL') {
    const where: any = { estado: 'PENDIENTE' };
    if (tipo) where.tipo = tipo;

    return this.prisma.notificacionEnviada.findMany({
      where,
      orderBy: { enviadoAt: 'asc' },
      take: 50, // Lote de 50
    });
  }

  /**
   * Marcar notificación como enviada
   */
  async marcarEnviada(id: string, estado: 'ENTREGADO' | 'FALLIDO', errorMsg?: string) {
    return this.prisma.notificacionEnviada.update({
      where: { id },
      data: {
        estado,
        errorMsg,
      },
    });
  }

  private generarToken(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  private generarMensajeSMS(data: { nombreJugador1: string; nombreTorneo: string; linkRegistro: string }): string {
    const { nombreJugador1, nombreTorneo, linkRegistro } = data;
    // SMS corto para Tigo (límite de caracteres)
    return `${nombreJugador1} te invita a jugar el torneo "${nombreTorneo}". Registrate aqui: ${linkRegistro} (valido 48hs)`;
  }

  private generarMensajeEmail(data: { nombreJugador1: string; nombreTorneo: string; linkRegistro: string }): string {
    const { nombreJugador1, nombreTorneo, linkRegistro } = data;
    return `
Hola,

${nombreJugador1} te ha invitado a ser su compañero en el torneo "${nombreTorneo}".

Para confirmar tu participación, registrate en FairPadel:
${linkRegistro}

Este enlace expira en 48 horas.

Saludos,
Equipo FairPadel
    `.trim();
  }
}
