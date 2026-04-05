import { Controller, Post, Get, Body, Param, UseGuards, ValidationPipe } from '@nestjs/common';
import { WhatsAppService } from '../services/whatsapp.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { SendNotificationDto } from '../dto/send-notification.dto';
import { RequestConsentDto } from '../dto/request-consent.dto';

/**
 * Controlador interno para operaciones de WhatsApp
 * Protegido por JWT - solo usuarios autenticados
 */
@Controller('whatsapp')
@UseGuards(JwtAuthGuard)
export class WhatsAppController {
  constructor(private whatsAppService: WhatsAppService) {}

  /**
   * POST /whatsapp/send-notification
   * Enviar notificación a un usuario (usado por otros módulos)
   */
  @Post('send-notification')
  async sendNotification(
    @Body(new ValidationPipe()) body: SendNotificationDto,
  ) {
    const success = await this.whatsAppService.sendNotification(
      body.userId,
      body.template,
      body.variables || {},
    );

    return {
      success,
      message: success 
        ? 'Notificación enviada' 
        : 'No se pudo enviar (WhatsApp deshabilitado o usuario no confirmado)',
    };
  }

  /**
   * POST /whatsapp/request-consent
   * Solicitar consentimiento de WhatsApp a un usuario
   */
  @Post('request-consent')
  async requestConsent(@Body(new ValidationPipe()) body: RequestConsentDto) {
    await this.whatsAppService.requestConsent(body.userId);
    return {
      success: true,
      message: 'Solicitud de consentimiento enviada',
    };
  }

  /**
   * GET /whatsapp/consent-status/:userId
   * Verificar estado de consentimiento de un usuario
   */
  @Get('consent-status/:userId')
  async checkConsentStatus(@Param('userId') userId: string) {
    const status = await this.whatsAppService.checkUserWhatsAppStatus(userId);
    return status;
  }

  /**
   * GET /whatsapp/status
   * Verificar si WhatsApp está habilitado en el sistema
   */
  @Get('status')
  async getStatus() {
    return {
      enabled: this.whatsAppService.isWhatsAppEnabled(),
    };
  }
}
