import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { WhatsAppConsentService } from './whatsapp-consent.service';

/**
 * Servicio para procesar webhooks de Meta (WhatsApp)
 * 
 * Meta envía webhooks para:
 * - Actualizaciones de estado de mensajes (sent, delivered, read)
 * - Mensajes entrantes de usuarios
 * - Errores de entrega
 */
@Injectable()
export class WhatsAppWebhookService {
  private readonly logger = new Logger(WhatsAppWebhookService.name);
  private readonly isEnabled: boolean;
  private readonly webhookSecret: string;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private consentService: WhatsAppConsentService,
  ) {
    this.isEnabled = this.configService.get<string>('WHATSAPP_ENABLED') === 'true';
    this.webhookSecret = this.configService.get<string>('WHATSAPP_WEBHOOK_SECRET') || '';
  }

  /**
   * Verifica el webhook (usado durante configuración en Meta)
   * Meta envía un challenge que debemos retornar
   * 
   * @param mode Modo de suscripción
   * @param token Token de verificación
   * @param challenge Challenge a retornar
   * @returns Challenge si la verificación es exitosa
   */
  verifyWebhook(mode: string, token: string, challenge: string): string | null {
    const verifyToken = this.configService.get<string>('WHATSAPP_VERIFY_TOKEN') || 'fairpadel_webhook_verify';

    if (mode === 'subscribe' && token === verifyToken) {
      this.logger.log('Webhook verificado exitosamente');
      return challenge;
    }

    this.logger.warn('Verificación de webhook fallida');
    return null;
  }

  /**
   * Procesa un webhook entrante de Meta
   * 
   * @param payload Payload JSON del webhook
   */
  async processWebhook(payload: any): Promise<void> {
    if (!this.isEnabled) {
      this.logger.debug('[MODO SILENCIOSO] Webhook recibido pero no procesado');
      return;
    }

    try {
      this.logger.debug(`Webhook recibido: ${JSON.stringify(payload).substring(0, 200)}...`);

      // El payload tiene estructura: { object: 'whatsapp_business_account', entry: [...] }
      if (payload.object !== 'whatsapp_business_account') {
        this.logger.warn(`Tipo de webhook no soportado: ${payload.object}`);
        return;
      }

      for (const entry of payload.entry || []) {
        for (const change of entry.changes || []) {
          if (change.field === 'messages') {
            await this.processMessagesChange(change.value);
          }
        }
      }
    } catch (error) {
      this.logger.error('Error procesando webhook:', error);
    }
  }

  /**
   * Procesa cambios en mensajes
   */
  private async processMessagesChange(value: any): Promise<void> {
    // Procesar mensajes entrantes
    if (value.messages) {
      for (const message of value.messages) {
        await this.processIncomingMessage(message, value.contacts?.[0]);
      }
    }

    // Procesar actualizaciones de estado
    if (value.statuses) {
      for (const status of value.statuses) {
        await this.processStatusUpdate(status);
      }
    }
  }

  /**
   * Procesa un mensaje entrante de un usuario
   */
  private async processIncomingMessage(
    message: any,
    contact?: any,
  ): Promise<void> {
    try {
      const from = message.from; // Número de teléfono del remitente
      const messageType = message.type;
      const messageId = message.id;

      this.logger.log(`Mensaje recibido de ${from}, tipo: ${messageType}`);

      // Extraer contenido según tipo
      let textContent = '';
      switch (messageType) {
        case 'text':
          textContent = message.text?.body || '';
          break;
        case 'button':
          textContent = message.button?.text || '';
          break;
        case 'interactive':
          textContent = message.interactive?.button_reply?.title || 
                       message.interactive?.list_reply?.title || '';
          break;
        default:
          this.logger.debug(`Tipo de mensaje no manejado: ${messageType}`);
          return;
      }

      // Guardar mensaje recibido
      await this.saveIncomingMessage(messageId, from, textContent, messageType);

      // Verificar si es respuesta de consentimiento
      await this.consentService.processConsentResponse(from, textContent);

      // Aquí se pueden agregar más handlers para otros tipos de mensajes
      // Por ejemplo: consultas de soporte, cancelaciones, etc.

    } catch (error) {
      this.logger.error('Error procesando mensaje entrante:', error);
    }
  }

  /**
   * Procesa actualización de estado de un mensaje enviado
   */
  private async processStatusUpdate(status: any): Promise<void> {
    try {
      const messageId = status.id;
      const newStatus = status.status; // 'sent', 'delivered', 'read', 'failed'

      this.logger.debug(`Estado actualizado para ${messageId}: ${newStatus}`);

      // Actualizar en base de datos
      await this.prisma.whatsappMensaje.updateMany({
        where: { waMessageId: messageId },
        data: {
          estado: newStatus.toUpperCase(),
        },
      });

      // Si falló, guardar error
      if (newStatus === 'failed' && status.errors) {
        await this.prisma.whatsappMensaje.updateMany({
          where: { waMessageId: messageId },
          data: {
            errorMsg: JSON.stringify({ errors: status.errors }),
          },
        });
      }
    } catch (error) {
      this.logger.error('Error actualizando estado:', error);
    }
  }

  /**
   * Guarda mensaje entrante en la base de datos
   * Guarda mensajes de usuarios registrados y desconocidos (potenciales leads)
   */
  private async saveIncomingMessage(
    messageId: string,
    from: string,
    content: string,
    type: string,
  ): Promise<void> {
    try {
      // Buscar usuario por teléfono
      const user = await this.prisma.user.findFirst({
        where: { telefono: from },
      });

      // Crear o actualizar conversación (para usuarios registrados o desconocidos)
      const conversationId = await this.updateOrCreateConversation(user?.id, from);

      if (!conversationId) {
        this.logger.warn(`No se pudo crear conversación para número: ${from}`);
        return;
      }

      // Guardar mensaje (con o sin userId)
      await this.prisma.whatsappMensaje.create({
        data: {
          conversationId,
          userId: user?.id || null, // null si es desconocido
          waMessageId: messageId,
          direccion: 'ENTRANTE',
          tipo: type.toUpperCase(),
          contenido: content,
          estado: 'ENTREGADO', // Ya lo recibimos
          errorMsg: user ? null : 'Usuario no registrado - Potencial lead',
        },
      });

      if (!user) {
        this.logger.log(`💡 Mensaje guardado de número NO registrado (lead potencial): ${from}`);
      }
    } catch (error) {
      this.logger.error('Error guardando mensaje entrante:', error);
    }
  }

  /**
   * Actualiza o crea una conversación activa
   * @returns ID de la conversación actualizada o creada
   */
  private async updateOrCreateConversation(
    userId: string | undefined, 
    phoneNumber: string,
  ): Promise<string | undefined> {
    try {
      const now = new Date();
      const expiration = new Date(now.getTime() + 24 * 60 * 60 * 1000); // +24h

      // Buscar conversación activa (por userId si existe, o por waId si es desconocido)
      const existing = await this.prisma.whatsappConversation.findFirst({
        where: {
          waId: phoneNumber,
          estado: 'ACTIVA',
        },
      });

      if (existing) {
        // Actualizar
        await this.prisma.whatsappConversation.update({
          where: { id: existing.id },
          data: {
            ultimoMensajeAt: now,
            fechaExpiracion: expiration,
          },
        });
        return existing.id;
      } else {
        // Crear nueva conversación
        const newConv = await this.prisma.whatsappConversation.create({
          data: {
            userId: userId || 'desconocido', // Marcador temporal para desconocidos
            waId: phoneNumber,
            estado: 'ACTIVA',
            categoria: userId ? 'SERVICE' : 'LEAD', // LEAD para desconocidos
            fechaExpiracion: expiration,
            ultimoMensajeAt: now,
            iniciadaPor: 'USUARIO', // El usuario inició la conversación (mensaje entrante)
          },
        });
        return newConv.id;
      }
    } catch (error) {
      this.logger.error('Error actualizando conversación:', error);
      return undefined;
    }
  }
}
