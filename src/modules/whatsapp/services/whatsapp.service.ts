import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { WhatsAppMessagingService } from './whatsapp-messaging.service';
import { WhatsAppConsentService } from './whatsapp-consent.service';

/**
 * Servicio principal de WhatsApp
 * 
 * Este es el punto de entrada para otros módulos que quieran enviar notificaciones.
 * Implementa el feature flag WHATSAPP_ENABLED para operar en modo silencioso
 * cuando no está configurado o no se tienen credenciales.
 */
@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);
  private readonly isEnabled: boolean;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private messagingService: WhatsAppMessagingService,
    private consentService: WhatsAppConsentService,
  ) {
    // Feature flag: WHATSAPP_ENABLED
    this.isEnabled = this.configService.get<string>('WHATSAPP_ENABLED') === 'true';
    
    if (!this.isEnabled) {
      this.logger.warn('⚠️  WhatsApp está DESHABILITADO (WHATSAPP_ENABLED !== true)');
      this.logger.warn('   Los mensajes se loguearán pero NO se enviarán.');
    } else {
      this.logger.log('✅ WhatsApp está HABILITADO');
    }
  }

  /**
   * Verifica si WhatsApp está habilitado
   */
  isWhatsAppEnabled(): boolean {
    return this.isEnabled;
  }

  /**
   * Envía una notificación a un usuario
   * 
   * @param userId ID del usuario destinatario
   * @param template Nombre del template (ej: 'confirmacion_reserva')
   * @param variables Variables para reemplazar en el template
   * @returns true si se envió (o se simuló en modo desarrollo), false si no
   */
  async sendNotification(
    userId: string,
    template: string,
    variables: Record<string, string>,
  ): Promise<boolean> {
    // Feature flag check
    if (!this.isEnabled) {
      this.logger.debug(`[MODO SILENCIOSO] No se envió notificación a ${userId}: ${template}`);
      return false;
    }

    try {
      // Verificar que el usuario tiene WhatsApp confirmado
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          telefono: true,
          consentWhatsappStatus: true,
          preferenciaNotificacion: true,
        },
      });

      if (!user) {
        this.logger.warn(`Usuario ${userId} no encontrado`);
        return false;
      }

      // Validar consentimiento
      if (user.consentWhatsappStatus !== 'CONFIRMADO') {
        this.logger.debug(`Usuario ${userId} no tiene WhatsApp confirmado`);
        return false;
      }

      // Validar preferencia
      if (user.preferenciaNotificacion === 'EMAIL') {
        this.logger.debug(`Usuario ${userId} prefiere solo email`);
        return false;
      }

      // Validar teléfono
      if (!user.telefono) {
        this.logger.warn(`Usuario ${userId} no tiene teléfono registrado`);
        return false;
      }

      // Enviar mensaje
      const messageId = await this.messagingService.sendTemplateMessage(
        user.telefono,
        template,
        variables,
        userId,
      );
      
      return !!messageId;
    } catch (error) {
      this.logger.error(`Error enviando notificación a ${userId}:`, error);
      return false;
    }
  }

  /**
   * Solicita consentimiento de WhatsApp a un usuario
   * Envía el mensaje de "Responde SI para confirmar"
   * 
   * @param userId ID del usuario
   */
  async requestConsent(userId: string): Promise<void> {
    // Feature flag check
    if (!this.isEnabled) {
      this.logger.debug(`[MODO SILENCIOSO] No se solicitó consentimiento a ${userId}`);
      return;
    }

    await this.consentService.requestConsent(userId);
  }

  /**
   * Verifica si un usuario puede recibir notificaciones por WhatsApp
   * 
   * @param userId ID del usuario
   * @returns Objeto con estado del consentimiento y preferencias
   */
  async checkUserWhatsAppStatus(userId: string): Promise<{
    canSend: boolean;
    phone?: string;
    consentStatus?: string;
    preference?: string;
    reason?: string;
  }> {
    // Si WhatsApp está deshabilitado globalmente
    if (!this.isEnabled) {
      return {
        canSend: false,
        reason: 'WhatsApp no está habilitado en el sistema',
      };
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        telefono: true,
        consentCheckboxWhatsapp: true,
        consentWhatsappStatus: true,
        preferenciaNotificacion: true,
      },
    });

    if (!user) {
      return { canSend: false, reason: 'Usuario no encontrado' };
    }

    if (!user.telefono) {
      return { canSend: false, reason: 'Usuario no tiene teléfono' };
    }

    if (!user.consentCheckboxWhatsapp) {
      return { canSend: false, reason: 'Usuario no aceptó el checkbox' };
    }

    if (user.consentWhatsappStatus !== 'CONFIRMADO') {
      return { 
        canSend: false, 
        reason: 'Usuario no confirmó por mensaje',
        consentStatus: user.consentWhatsappStatus,
      };
    }

    if (user.preferenciaNotificacion === 'EMAIL') {
      return { 
        canSend: false, 
        reason: 'Usuario prefiere solo email',
        preference: user.preferenciaNotificacion,
      };
    }

    return {
      canSend: true,
      phone: user.telefono,
      consentStatus: user.consentWhatsappStatus,
      preference: user.preferenciaNotificacion,
    };
  }
}
