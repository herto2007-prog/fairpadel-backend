import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { WhatsAppMessagingService } from './whatsapp-messaging.service';

/**
 * Servicio para gestionar el consentimiento de WhatsApp (Doble Opt-in)
 * 
 * Flujo:
 * 1. Usuario marca checkbox en registro
 * 2. Se envía mensaje de WhatsApp pidiendo confirmación
 * 3. Usuario responde "SI"
 * 4. Se confirma el consentimiento
 */
@Injectable()
export class WhatsAppConsentService {
  private readonly logger = new Logger(WhatsAppConsentService.name);
  private readonly isEnabled: boolean;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private messagingService: WhatsAppMessagingService,
  ) {
    this.isEnabled = this.configService.get<string>('WHATSAPP_ENABLED') === 'true';
  }

  /**
   * Solicita consentimiento a un usuario
   * Envia mensaje de "Responde SI para confirmar"
   * 
   * @param userId ID del usuario
   */
  async requestConsent(userId: string): Promise<void> {
    if (!this.isEnabled) {
      this.logger.debug(`[MODO SILENCIOSO] Consentimiento no solicitado para ${userId}`);
      return;
    }

    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          telefono: true,
          nombre: true,
          consentWhatsappStatus: true,
        },
      });

      if (!user || !user.telefono) {
        this.logger.warn(`No se puede solicitar consentimiento: usuario ${userId} sin teléfono`);
        return;
      }

      // Verificar que esté pendiente
      if (user.consentWhatsappStatus !== 'PENDIENTE') {
        this.logger.debug(`Usuario ${userId} no está pendiente de consentimiento`);
        return;
      }

      // Enviar mensaje de solicitud
      const messageId = await this.messagingService.sendTemplateMessage(
        user.telefono,
        'confirmacion_consentimiento',
        { nombre: user.nombre || 'Jugador' },
        userId,
        'CONSENTIMIENTO',
      );

      if (messageId) {
        this.logger.log(`Solicitud de consentimiento enviada a ${user.telefono}`);
      }
    } catch (error) {
      this.logger.error(`Error solicitando consentimiento para ${userId}:`, error);
    }
  }

  /**
   * Confirma el consentimiento de un usuario
   * Llamado cuando el usuario responde "SI" al mensaje
   * 
   * @param userId ID del usuario
   */
  async confirmConsent(userId: string): Promise<void> {
    if (!this.isEnabled) {
      this.logger.debug(`[MODO SILENCIOSO] Consentimiento no confirmado para ${userId}`);
      return;
    }

    try {
      const user = await this.prisma.user.update({
        where: { id: userId },
        data: {
          consentWhatsappStatus: 'CONFIRMADO',
          consentWhatsappDate: new Date(),
          preferenciaNotificacion: 'AMBOS',
        },
      });

      this.logger.log(`✅ Consentimiento confirmado para usuario ${userId}`);

      // Enviar mensaje de bienvenida
      if (user.telefono) {
        await this.messagingService.sendTemplateMessage(
          user.telefono,
          'bienvenida_consentimiento',
          { nombre: user.nombre || 'Jugador' },
          userId,
          'CONSENTIMIENTO',
        );
      }
    } catch (error) {
      this.logger.error(`Error confirmando consentimiento para ${userId}:`, error);
    }
  }

  /**
   * Rechaza el consentimiento de un usuario
   * Llamado cuando el usuario responde algo diferente a "SI"
   * 
   * @param userId ID del usuario
   */
  async rejectConsent(userId: string): Promise<void> {
    if (!this.isEnabled) {
      this.logger.debug(`[MODO SILENCIOSO] Consentimiento no rechazado para ${userId}`);
      return;
    }

    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          consentWhatsappStatus: 'RECHAZADO',
          consentWhatsappDate: new Date(),
        },
      });

      this.logger.log(`❌ Consentimiento rechazado para usuario ${userId}`);
    } catch (error) {
      this.logger.error(`Error rechazando consentimiento para ${userId}:`, error);
    }
  }

  /**
   * Procesa una respuesta entrante de consentimiento
   * Llamado desde el webhook cuando llega un mensaje
   * 
   * @param phoneNumber Número de teléfono del remitente
   * @param messageText Texto del mensaje recibido
   */
  async processConsentResponse(phoneNumber: string, messageText: string): Promise<void> {
    if (!this.isEnabled) {
      this.logger.debug(`[MODO SILENCIOSO] Respuesta de consentimiento no procesada`);
      return;
    }

    try {
      // Buscar usuario por teléfono
      const user = await this.prisma.user.findFirst({
        where: {
          telefono: phoneNumber,
          consentWhatsappStatus: 'PENDIENTE',
        },
      });

      if (!user) {
        this.logger.debug(`No se encontró usuario pendiente con teléfono ${phoneNumber}`);
        return;
      }

      // Normalizar respuesta
      const respuesta = messageText.trim().toUpperCase();

      if (respuesta === 'SI' || respuesta === 'SÍ' || respuesta === 'S') {
        await this.confirmConsent(user.id);
      } else {
        await this.rejectConsent(user.id);
      }
    } catch (error) {
      this.logger.error(`Error procesando respuesta de consentimiento:`, error);
    }
  }
}
