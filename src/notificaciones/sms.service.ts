import { Injectable } from '@nestjs/common';

@Injectable()
export class SmsService {
  private readonly twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
  private readonly twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
  private readonly twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

  async enviarSms(to: string, message: string) {
    // En producción, aquí usarías Twilio
    // Por ahora, solo logueamos
    console.log('📱 Enviando SMS:');
    console.log('To:', to);
    console.log('Message:', message);

    // Simular envío exitoso
    return { success: true };
  }

  async enviarNotificacion(telefono: string, contenido: string) {
    // Limitar contenido a 160 caracteres (SMS estándar)
    const mensajeCorto = contenido.length > 140 
      ? contenido.substring(0, 137) + '...' 
      : contenido;

    return this.enviarSms(telefono, `FairPadel: ${mensajeCorto}`);
  }

  async recordatorioPartido(telefono: string, detalles: string) {
    return this.enviarSms(
      telefono,
      `FairPadel: Recordatorio de partido - ${detalles}`,
    );
  }

  async notificacionPagoConfirmado(telefono: string) {
    return this.enviarSms(
      telefono,
      'FairPadel: Tu pago fue confirmado exitosamente',
    );
  }

  async cambioHorarioTorneo(telefono: string, torneo: string) {
    return this.enviarSms(
      telefono,
      `FairPadel: El torneo "${torneo}" cambió de horario. Revisa tu email.`,
    );
  }
}