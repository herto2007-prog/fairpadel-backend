import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { verificationEmailTemplate, passwordResetEmailTemplate } from './templates/auth.templates';
import {
  invitacionJugadorTemplate,
  inscripcionConfirmadaTemplate,
  partidoProgramadoTemplate,
} from './templates/torneos.templates';
import {
  pagoExitosoTemplate,
  pagoCanceladoTemplate,
  pagoErrorTemplate,
  suscripcionCanceladaTemplate,
} from './templates/pagos.templates';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private resend: Resend;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    if (!apiKey) {
      this.logger.warn('RESEND_API_KEY no está configurado. Los emails no se enviarán.');
    } else {
      this.resend = new Resend(apiKey);
    }
  }

  private getFromEmail(): string {
    const fromEmail = this.configService.get<string>('FROM_EMAIL');
    return fromEmail || 'FairPadel <noreply@fairpadel.com>';
  }

  /**
   * Envía email de verificación de cuenta
   */
  async sendVerificationEmail(
    to: string,
    name: string,
    verificationLink: string,
  ): Promise<void> {
    const html = verificationEmailTemplate(name, verificationLink);
    
    try {
      if (!this.resend) {
        this.logger.warn(`[MODO DESARROLLO] Email de verificación para ${to}:`);
        this.logger.warn(`Link: ${verificationLink}`);
        return;
      }

      const { data, error } = await this.resend.emails.send({
        from: this.getFromEmail(),
        to: [to],
        subject: 'Verifica tu cuenta - FairPadel',
        html,
      });

      if (error) {
        this.logger.error('Error enviando email:', error);
        throw new Error(`Error enviando email: ${error.message}`);
      }

      this.logger.log(`Email de verificación enviado a ${to}, ID: ${data?.id}`);
    } catch (error) {
      this.logger.error(`Error enviando email de verificación a ${to}:`, error);
      throw error;
    }
  }

  /**
   * Envía email de recuperación de contraseña
   */
  async sendPasswordResetEmail(
    to: string,
    name: string,
    resetLink: string,
  ): Promise<void> {
    const html = passwordResetEmailTemplate(name, resetLink);
    
    try {
      if (!this.resend) {
        this.logger.warn(`[MODO DESARROLLO] Email de reset para ${to}:`);
        this.logger.warn(`Link: ${resetLink}`);
        return;
      }

      const { data, error } = await this.resend.emails.send({
        from: this.getFromEmail(),
        to: [to],
        subject: 'Recupera tu contraseña - FairPadel',
        html,
      });

      if (error) {
        this.logger.error('Error enviando email:', error);
        throw new Error(`Error enviando email: ${error.message}`);
      }

      this.logger.log(`Email de reset enviado a ${to}, ID: ${data?.id}`);
    } catch (error) {
      this.logger.error(`Error enviando email de reset a ${to}:`, error);
      throw error;
    }
  }

  /**
   * Envía email de invitación a jugador 2 no registrado
   */
  async sendInvitacionJugador(
    to: string,
    nombreJugador2: string,
    nombreJugador1: string,
    torneoNombre: string,
  ): Promise<void> {
    const html = invitacionJugadorTemplate(to, nombreJugador2, nombreJugador1, torneoNombre);
    
    try {
      if (!this.resend) {
        this.logger.warn(`[MODO DESARROLLO] Invitación para ${to}: ${torneoNombre}`);
        return;
      }

      const { data, error } = await this.resend.emails.send({
        from: this.getFromEmail(),
        to: [to],
        subject: `¡Te invitaron a jugar en ${torneoNombre}! - FairPadel`,
        html,
      });

      if (error) {
        this.logger.error('Error enviando email:', error);
        throw new Error(`Error enviando email: ${error.message}`);
      }

      this.logger.log(`Invitación enviada a ${to}, ID: ${data?.id}`);
    } catch (error) {
      this.logger.error(`Error enviando invitación a ${to}:`, error);
      throw error;
    }
  }

  /**
   * Envía email de confirmación de inscripción
   */
  async sendInscripcionConfirmada(
    to: string,
    nombre: string,
    torneoNombre: string,
    categoria: string,
    fechaSorteo: string,
  ): Promise<void> {
    const html = inscripcionConfirmadaTemplate(nombre, torneoNombre, categoria, fechaSorteo);
    
    try {
      if (!this.resend) {
        this.logger.warn(`[MODO DESARROLLO] Confirmación inscripción para ${to}`);
        return;
      }

      const { data, error } = await this.resend.emails.send({
        from: this.getFromEmail(),
        to: [to],
        subject: `✅ Inscripción confirmada - ${torneoNombre}`,
        html,
      });

      if (error) {
        this.logger.error('Error enviando email:', error);
        throw new Error(`Error enviando email: ${error.message}`);
      }

      this.logger.log(`Confirmación enviada a ${to}, ID: ${data?.id}`);
    } catch (error) {
      this.logger.error(`Error enviando confirmación a ${to}:`, error);
      throw error;
    }
  }

  /**
   * Envía email de inscripción pendiente de pago
   */
  async sendInscripcionPendientePago(
    to: string,
    nombre: string,
    torneoNombre: string,
    categoria: string,
    costo: string,
  ): Promise<void> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #df2531;">¡Inscripción realizada!</h2>
        <p>Hola ${nombre},</p>
        <p>Tu inscripción en el torneo <strong>${torneoNombre}</strong> ha sido registrada exitosamente.</p>
        
        <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Detalles:</strong></p>
          <ul>
            <li><strong>Torneo:</strong> ${torneoNombre}</li>
            <li><strong>Categoría:</strong> ${categoria}</li>
            <li><strong>Costo:</strong> Gs. ${costo}</li>
          </ul>
        </div>
        
        <p><strong>Próximos pasos:</strong></p>
        <p>El organizador se pondrá en contacto contigo para coordinar el pago de la inscripción.</p>
        
        <p style="margin-top: 30px; color: #666; font-size: 12px;">
          Este es un mensaje automático de FairPadel.
        </p>
      </div>
    `;
    
    try {
      if (!this.resend) {
        this.logger.warn(`[MODO DESARROLLO] Inscripción pendiente de pago para ${to}`);
        return;
      }

      const { data, error } = await this.resend.emails.send({
        from: this.getFromEmail(),
        to: [to],
        subject: `✅ Inscripción registrada - ${torneoNombre}`,
        html,
      });

      if (error) {
        this.logger.error('Error enviando email:', error);
        throw new Error(`Error enviando email: ${error.message}`);
      }

      this.logger.log(`Email de inscripción pendiente enviado a ${to}, ID: ${data?.id}`);
    } catch (error) {
      this.logger.error(`Error enviando inscripción pendiente a ${to}:`, error);
      throw error;
    }
  }

  /**
   * Envía email cuando un partido es programado (recordatorio)
   */
  async sendPartidoProgramado(
    to: string,
    nombre: string,
    torneoNombre: string,
    fecha: string,
    hora: string,
    cancha: string,
    sede: string,
    rival: string,
  ): Promise<void> {
    const html = partidoProgramadoTemplate(nombre, torneoNombre, fecha, hora, cancha, sede, rival);
    
    try {
      if (!this.resend) {
        this.logger.warn(`[MODO DESARROLLO] Partido programado para ${to}`);
        return;
      }

      const { data, error } = await this.resend.emails.send({
        from: this.getFromEmail(),
        to: [to],
        subject: `📅 Tu partido está programado - ${torneoNombre}`,
        html,
      });

      if (error) {
        this.logger.error('Error enviando email:', error);
        throw new Error(`Error enviando email: ${error.message}`);
      }

      this.logger.log(`Partido programado enviado a ${to}, ID: ${data?.id}`);
    } catch (error) {
      this.logger.error(`Error enviando partido programado a ${to}:`, error);
      throw error;
    }
  }

  /**
   * Aviso al organizador: las inscripciones de su torneo cierran hoy/mañana
   */
  async sendDeadlineInscripciones(
    to: string,
    nombre: string,
    torneoNombre: string,
    cuando: string, // 'hoy' | 'mañana'
    fechaLimite: string,
    confirmadas: number,
    pendientes: number,
    categoriasAbiertas: number,
  ): Promise<void> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #df2531;">⏰ Las inscripciones cierran ${cuando}</h2>
        <p>Hola ${nombre},</p>
        <p>Las inscripciones de tu torneo <strong>${torneoNombre}</strong> cierran <strong>${cuando}</strong> (fecha límite: ${fechaLimite}).</p>

        <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Estado actual:</strong></p>
          <ul>
            <li><strong>Inscripciones confirmadas:</strong> ${confirmadas}</li>
            <li><strong>Pendientes de confirmar/pagar:</strong> ${pendientes}</li>
            <li><strong>Categorías abiertas:</strong> ${categoriasAbiertas}</li>
          </ul>
        </div>

        <p><strong>Próximos pasos:</strong></p>
        <p>Revisá las inscripciones pendientes y prepará el cierre de categorías para poder sortear.</p>

        <p style="margin-top: 30px; color: #666; font-size: 12px;">
          FairPadel - Plataforma de torneos de pádel
        </p>
      </div>
    `;

    try {
      if (!this.resend) {
        this.logger.warn(`[MODO DESARROLLO] Deadline de inscripciones para ${to}`);
        return;
      }

      const { data, error } = await this.resend.emails.send({
        from: this.getFromEmail(),
        to: [to],
        subject: `⏰ Inscripciones cierran ${cuando} - ${torneoNombre}`,
        html,
      });

      if (error) {
        this.logger.error('Error enviando email:', error);
        throw new Error(`Error enviando email: ${error.message}`);
      }

      this.logger.log(`Deadline de inscripciones enviado a ${to}, ID: ${data?.id}`);
    } catch (error) {
      this.logger.error(`Error enviando deadline de inscripciones a ${to}:`, error);
      throw error;
    }
  }

  // ============================================================
  // EMAILS DE CONFIRMACIÓN DE PAGO (Bancard)
  // ============================================================

  /**
   * Envía email de pago exitoso
   */
  async sendPagoExitoso(
    to: string,
    nombre: string,
    sedeNombre: string,
    planNombre: string,
    monto: number,
    moneda: string,
    fechaPago: string,
    fechaVencimiento: string,
  ): Promise<void> {
    const html = pagoExitosoTemplate(nombre, sedeNombre, planNombre, monto, moneda, fechaPago, fechaVencimiento);
    
    try {
      if (!this.resend) {
        this.logger.warn(`[MODO DESARROLLO] Pago exitoso para ${to}`);
        return;
      }

      const { data, error } = await this.resend.emails.send({
        from: this.getFromEmail(),
        to: [to],
        subject: `✅ Pago confirmado - Suscripción ${sedeNombre}`,
        html,
      });

      if (error) {
        this.logger.error('Error enviando email:', error);
        throw new Error(`Error enviando email: ${error.message}`);
      }

      this.logger.log(`Email de pago exitoso enviado a ${to}, ID: ${data?.id}`);
    } catch (error) {
      this.logger.error(`Error enviando email de pago a ${to}:`, error);
      throw error;
    }
  }

  /**
   * Envía email de pago cancelado/rollback
   */
  async sendPagoCancelado(
    to: string,
    nombre: string,
    sedeNombre: string,
    planNombre: string,
    monto: number,
    moneda: string,
    motivo?: string,
  ): Promise<void> {
    const html = pagoCanceladoTemplate(nombre, sedeNombre, planNombre, monto, moneda, motivo);
    
    try {
      if (!this.resend) {
        this.logger.warn(`[MODO DESARROLLO] Pago cancelado para ${to}`);
        return;
      }

      const { data, error } = await this.resend.emails.send({
        from: this.getFromEmail(),
        to: [to],
        subject: `❌ Pago cancelado - Suscripción ${sedeNombre}`,
        html,
      });

      if (error) {
        this.logger.error('Error enviando email:', error);
        throw new Error(`Error enviando email: ${error.message}`);
      }

      this.logger.log(`Email de pago cancelado enviado a ${to}, ID: ${data?.id}`);
    } catch (error) {
      this.logger.error(`Error enviando email de cancelación a ${to}:`, error);
      throw error;
    }
  }

  /**
   * Envía email de error en el pago
   */
  async sendPagoError(
    to: string,
    nombre: string,
    sedeNombre: string,
    planNombre: string,
    monto: number,
    moneda: string,
    mensajeError?: string,
  ): Promise<void> {
    const html = pagoErrorTemplate(nombre, sedeNombre, planNombre, monto, moneda, mensajeError);
    
    try {
      if (!this.resend) {
        this.logger.warn(`[MODO DESARROLLO] Error de pago para ${to}`);
        return;
      }

      const { data, error } = await this.resend.emails.send({
        from: this.getFromEmail(),
        to: [to],
        subject: `⚠️ Error en el pago - Suscripción ${sedeNombre}`,
        html,
      });

      if (error) {
        this.logger.error('Error enviando email:', error);
        throw new Error(`Error enviando email: ${error.message}`);
      }

      this.logger.log(`Email de error de pago enviado a ${to}, ID: ${data?.id}`);
    } catch (error) {
      this.logger.error(`Error enviando email de error a ${to}:`, error);
      throw error;
    }
  }

  // ============================================================
  // EMAIL DE CANCELACIÓN DE SUSCRIPCIÓN
  // ============================================================

  /**
   * Envía email de confirmación de cancelación de suscripción
   */
  async sendSuscripcionCancelada(
    to: string,
    nombre: string,
    sedeNombre: string,
    diasRestantes: number,
    fechaVencimiento?: string,
  ): Promise<void> {
    const html = suscripcionCanceladaTemplate(nombre, sedeNombre, diasRestantes, fechaVencimiento);
    
    try {
      if (!this.resend) {
        this.logger.warn(`[MODO DESARROLLO] Suscripción cancelada para ${to}`);
        return;
      }

      const { data, error } = await this.resend.emails.send({
        from: this.getFromEmail(),
        to: [to],
        subject: `❌ Suscripción cancelada - ${sedeNombre}`,
        html,
      });

      if (error) {
        this.logger.error('Error enviando email:', error);
        throw new Error(`Error enviando email: ${error.message}`);
      }

      this.logger.log(`Email de cancelación enviado a ${to}, ID: ${data?.id}`);
    } catch (error) {
      this.logger.error(`Error enviando email de cancelación a ${to}:`, error);
      throw error;
    }
  }
}
