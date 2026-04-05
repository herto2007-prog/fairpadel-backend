import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';

/**
 * Servicio para enviar mensajes de WhatsApp
 * 
 * Este servicio interactúa directamente con la API de Meta (WhatsApp Business API)
 * para enviar mensajes usando templates aprobados.
 * 
 * FEATURE FLAG: Si WHATSAPP_ENABLED !== 'true', simula el envío sin llamar a Meta
 */
@Injectable()
export class WhatsAppMessagingService {
  private readonly logger = new Logger(WhatsAppMessagingService.name);
  private readonly isEnabled: boolean;
  private readonly apiVersion: string;
  private readonly phoneNumberId: string;
  private readonly accessToken: string;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    this.isEnabled = this.configService.get<string>('WHATSAPP_ENABLED') === 'true';
    this.apiVersion = this.configService.get<string>('WHATSAPP_API_VERSION') || 'v17.0';
    this.phoneNumberId = this.configService.get<string>('WHATSAPP_PHONE_NUMBER_ID') || '';
    this.accessToken = this.configService.get<string>('WHATSAPP_ACCESS_TOKEN') || '';

    if (this.isEnabled && (!this.accessToken || !this.phoneNumberId)) {
      this.logger.error('⚠️  WhatsApp habilitado pero faltan credenciales (ACCESS_TOKEN o PHONE_NUMBER_ID)');
    }
  }

  /**
   * Envía un mensaje usando un template aprobado
   * 
   * @param to Número de teléfono destinatario (formato internacional +595981...)
   * @param templateName Nombre del template (ej: 'confirmacion_reserva')
   * @param variables Variables para reemplazar en el template
   * @param userId ID del usuario (para logging)
   * @param categoria Categoría del mensaje (para tracking)
   * @returns ID del mensaje enviado o null si falló
   */
  async sendTemplateMessage(
    to: string,
    templateName: string,
    variables: Record<string, string>,
    userId?: string,
    categoria: string = 'NOTIFICACION',
  ): Promise<string | null> {
    // Feature flag: modo silencioso
    if (!this.isEnabled) {
      this.logger.log(`[MODO SILENCIOSO] Simulando envío a ${to}: ${templateName}`);
      this.logger.log(`[MODO SILENCIOSO] Variables: ${JSON.stringify(variables)}`);
      return `simulated_${Date.now()}`;
    }

    // Validar configuración
    if (!this.accessToken || !this.phoneNumberId) {
      this.logger.error('No se puede enviar mensaje: faltan credenciales');
      return null;
    }

    try {
      // Buscar el template en la base de datos
      const template = await this.prisma.whatsappTemplate.findUnique({
        where: { nombre: templateName },
      });

      if (!template || !template.activo) {
        this.logger.error(`Template no encontrado o inactivo: ${templateName}`);
        return null;
      }

      // Preparar parámetros del template
      const parameters = this.buildTemplateParameters(template.variables, variables);

      // Construir payload para Meta API
      const payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: this.normalizePhoneNumber(to),
        type: 'template',
        template: {
          name: template.waTemplateName,
          language: {
            code: template.lenguaje || 'es',
          },
          components: [
            {
              type: 'body',
              parameters,
            },
          ],
        },
      };

      // Enviar a Meta API
      const response = await fetch(
        `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.accessToken}`,
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        this.logger.error(`Error de Meta API: ${JSON.stringify(data)}`);
        await this.saveMessageLog(null, userId, templateName, 'FALLIDO', JSON.stringify(data));
        return null;
      }

      const messageId = data.messages?.[0]?.id;

      if (messageId) {
        this.logger.log(`Mensaje enviado a ${to}, ID: ${messageId}`);
        await this.saveMessageLog(messageId, userId, templateName, 'ENVIADO', null, categoria);
      }

      return messageId;
    } catch (error) {
      this.logger.error(`Error enviando mensaje a ${to}:`, error);
      await this.saveMessageLog(null, userId, templateName, 'FALLIDO', error.message);
      return null;
    }
  }

  /**
   * Envía un mensaje de texto simple (solo dentro de ventana de 24h)
   * 
   * @param to Número de teléfono destinatario
   * @param text Texto del mensaje
   * @param userId ID del usuario
   * @returns ID del mensaje o null
   */
  async sendTextMessage(
    to: string,
    text: string,
    userId?: string,
  ): Promise<string | null> {
    if (!this.isEnabled) {
      this.logger.log(`[MODO SILENCIOSO] Simulando texto a ${to}: ${text.substring(0, 50)}...`);
      return `simulated_${Date.now()}`;
    }

    if (!this.accessToken || !this.phoneNumberId) {
      this.logger.error('No se puede enviar mensaje: faltan credenciales');
      return null;
    }

    try {
      const payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: this.normalizePhoneNumber(to),
        type: 'text',
        text: {
          preview_url: false,
          body: text,
        },
      };

      const response = await fetch(
        `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.accessToken}`,
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        this.logger.error(`Error de Meta API: ${JSON.stringify(data)}`);
        return null;
      }

      return data.messages?.[0]?.id;
    } catch (error) {
      this.logger.error(`Error enviando texto a ${to}:`, error);
      return null;
    }
  }

  /**
   * Construye los parámetros para el template
   */
  private buildTemplateParameters(
    parametrosConfig: any,
    variables: Record<string, string>,
  ): Array<{ type: string; text: string }> {
    const parametros = typeof parametrosConfig === 'string' 
      ? JSON.parse(parametrosConfig) 
      : parametrosConfig;

    const variableNames = parametros?.variables || [];

    return variableNames.map((varName: string) => ({
      type: 'text',
      text: variables[varName] || `{{${varName}}}`,
    }));
  }

  /**
   * Normaliza el número de teléfono al formato requerido por Meta
   * Elimina espacios, guiones, y asegura formato internacional
   */
  private normalizePhoneNumber(phone: string): string {
    // Eliminar todo excepto números y el signo +
    let normalized = phone.replace(/[^\d+]/g, '');

    // Asegurar que tenga el código de país
    if (!normalized.startsWith('+')) {
      // Si empieza con 0, asumimos Paraguay (+595)
      if (normalized.startsWith('0')) {
        normalized = '+595' + normalized.substring(1);
      } else if (normalized.startsWith('595')) {
        normalized = '+' + normalized;
      } else {
        // Asumimos Paraguay por defecto
        normalized = '+595' + normalized;
      }
    }

    return normalized;
  }

  /**
   * Guarda log del mensaje en la base de datos
   */
  private async saveMessageLog(
    messageId: string | null,
    userId: string | undefined,
    templateName: string,
    estado: string,
    errorInfo: string | null,
    categoria: string = 'NOTIFICACION',
  ): Promise<void> {
    try {
      if (!userId) return;

      // Obtener conversación activa o crear una nueva
      let conversation = await this.prisma.whatsappConversation.findFirst({
        where: { userId, estado: 'ACTIVA' },
      });

      if (!conversation) {
        // Obtener el teléfono del usuario
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
          select: { telefono: true },
        });

        const now = new Date();
        conversation = await this.prisma.whatsappConversation.create({
          data: {
            userId,
            waId: user?.telefono || 'unknown',
            estado: 'ACTIVA',
            categoria,
            fechaExpiracion: new Date(now.getTime() + 24 * 60 * 60 * 1000), // +24h
          },
        });
      }

      await this.prisma.whatsappMensaje.create({
        data: {
          conversationId: conversation.id,
          userId,
          waMessageId: messageId || `local_${Date.now()}`,
          direccion: 'SALIENTE',
          tipo: 'TEMPLATE',
          contenido: templateName,
          estado,
          errorMsg: errorInfo || undefined,
          templateName,
        },
      });
    } catch (error) {
      this.logger.error('Error guardando log de mensaje:', error);
    }
  }
}
