import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Query, 
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { WhatsAppWebhookService } from '../services/whatsapp-webhook.service';

/**
 * Controlador de Webhook para Meta (WhatsApp)
 * 
 * Este endpoint es PÚBLICO - Meta lo llama directamente
 * No requiere autenticación JWT
 * 
 * Rutas:
 * - GET  /webhooks/whatsapp - Verificación inicial por Meta
 * - POST /webhooks/whatsapp - Recepción de eventos
 */
@Controller('webhooks/whatsapp')
export class WhatsAppWebhookController {
  private readonly logger = new Logger(WhatsAppWebhookController.name);

  constructor(private webhookService: WhatsAppWebhookService) {}

  /**
   * GET /webhooks/whatsapp
   * 
   * Meta usa este endpoint para verificar el webhook durante la configuración
   * Debe retornar el challenge que Meta envía
   */
  @Get()
  verifyWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ): string {
    this.logger.log(`Verificación de webhook solicitada`);

    const result = this.webhookService.verifyWebhook(mode, token, challenge);

    if (result) {
      this.logger.log('Webhook verificado exitosamente');
      return result;
    }

    this.logger.warn('Verificación de webhook fallida');
    throw new Error('Verification failed');
  }

  /**
   * POST /webhooks/whatsapp
   * 
   * Meta envía aquí todos los eventos:
   * - Mensajes entrantes de usuarios
   * - Actualizaciones de estado (sent, delivered, read)
   * - Errores de entrega
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  async receiveWebhook(
    @Body() payload: any,
    @Headers('x-hub-signature-256') signature: string,
  ): Promise<void> {
    this.logger.debug('Webhook recibido de Meta');

    // Opcional: verificar firma del webhook para seguridad
    // if (signature) { ... }

    // Procesar el webhook (async, no bloqueamos la respuesta)
    this.webhookService.processWebhook(payload).catch(error => {
      this.logger.error('Error procesando webhook:', error);
    });

    // Responder rápido a Meta (200 OK)
    // El procesamiento real se hace en background
  }
}
